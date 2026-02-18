use crate::utils::log::write_operation_log;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PlanVersionItem {
    pub plan_id: i32,
    pub plan_no: String,
    pub name: String,
    pub version: i32,
    pub status: String,
    pub score_overall: i32,
    pub total_count: i32,
    pub total_weight: f64,
    pub roll_change_count: i32,
    pub risk_high: i32,
    pub risk_medium: i32,
    pub risk_low: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub async fn get_plan_versions(plan_id: i32) -> Result<Vec<PlanVersionItem>, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::{self, Entity as Plan};
    use sea_orm::*;

    let db = get_db();

    // 查找当前方案
    let current = Plan::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    // 找到根方案 ID（沿 parent_id 向上追溯）
    let mut root_id = current.id;
    let mut visited = std::collections::HashSet::new();
    visited.insert(root_id);

    loop {
        let plan = Plan::find_by_id(root_id).one(db).await?;
        match plan.and_then(|p| p.parent_id) {
            Some(pid) if !visited.contains(&pid) => {
                root_id = pid;
                visited.insert(pid);
            }
            _ => break,
        }
    }

    // 收集版本树：root + 所有以 root 为祖先的方案
    let mut version_ids = vec![root_id];
    let mut idx = 0;
    while idx < version_ids.len() {
        let pid = version_ids[idx];
        let children = Plan::find()
            .filter(schedule_plan::Column::ParentId.eq(pid))
            .all(db)
            .await?;
        for child in children {
            if !version_ids.contains(&child.id) {
                version_ids.push(child.id);
            }
        }
        idx += 1;
    }

    // 加载所有版本并排序
    let plans = Plan::find()
        .filter(schedule_plan::Column::Id.is_in(version_ids))
        .order_by_asc(schedule_plan::Column::Version)
        .order_by_asc(schedule_plan::Column::CreatedAt)
        .all(db)
        .await?;

    let result: Vec<PlanVersionItem> = plans
        .into_iter()
        .map(|p| PlanVersionItem {
            plan_id: p.id,
            plan_no: p.plan_no,
            name: p.name,
            version: p.version.unwrap_or(1),
            status: p.status.unwrap_or_default(),
            score_overall: p.score_overall.unwrap_or(0),
            total_count: p.total_count.unwrap_or(0),
            total_weight: p.total_weight.unwrap_or(0.0),
            roll_change_count: p.roll_change_count.unwrap_or(0),
            risk_high: p.risk_count_high.unwrap_or(0),
            risk_medium: p.risk_count_medium.unwrap_or(0),
            risk_low: p.risk_count_low.unwrap_or(0),
            created_at: p.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
            updated_at: p.updated_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
        })
        .collect();

    Ok(result)
}

async fn find_plan_root_id(
    db: &sea_orm::DatabaseConnection,
    plan_id: i32,
) -> Result<i32, AppError> {
    use crate::models::schedule_plan::Entity as Plan;
    use sea_orm::*;

    let mut root_id = plan_id;
    let mut visited = std::collections::HashSet::new();
    visited.insert(root_id);

    loop {
        let plan = Plan::find_by_id(root_id)
            .one(db)
            .await?
            .ok_or(AppError::PlanNotFound(root_id))?;
        match plan.parent_id {
            Some(pid) if !visited.contains(&pid) => {
                root_id = pid;
                visited.insert(pid);
            }
            _ => break,
        }
    }

    Ok(root_id)
}

#[tauri::command]
pub async fn rollback_plan_version(
    plan_id: i32,
    target_plan_id: i32,
) -> Result<crate::models::schedule_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::{schedule_item, schedule_plan};
    use sea_orm::*;

    if plan_id == target_plan_id {
        return Err(AppError::ConstraintViolation(
            "不能回滚到当前版本".to_string(),
        ));
    }

    let db = get_db();
    let current = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;
    let target = schedule_plan::Entity::find_by_id(target_plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(target_plan_id))?;

    let current_root = find_plan_root_id(db, current.id).await?;
    let target_root = find_plan_root_id(db, target.id).await?;
    if current_root != target_root {
        return Err(AppError::ConstraintViolation(
            "仅支持回滚同一版本链中的方案".to_string(),
        ));
    }

    let target_items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(target_plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let tx = db.begin().await?;

    schedule_item::Entity::delete_many()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .exec(&tx)
        .await?;

    for item in target_items {
        let active = schedule_item::ActiveModel {
            plan_id: Set(plan_id),
            material_id: Set(item.material_id),
            sequence: Set(item.sequence),
            shift_date: Set(item.shift_date),
            shift_no: Set(item.shift_no),
            shift_type: Set(item.shift_type),
            planned_start: Set(item.planned_start),
            planned_end: Set(item.planned_end),
            cumulative_weight: Set(item.cumulative_weight),
            is_roll_change: Set(item.is_roll_change),
            is_locked: Set(item.is_locked),
            lock_reason: Set(item.lock_reason),
            risk_flags: Set(item.risk_flags),
            ..Default::default()
        };
        active.insert(&tx).await?;
    }

    let mut active_plan: schedule_plan::ActiveModel = current.into();
    active_plan.status = Set(Some("draft".to_string()));
    active_plan.total_count = Set(target.total_count);
    active_plan.total_weight = Set(target.total_weight);
    active_plan.roll_change_count = Set(target.roll_change_count);
    active_plan.score_overall = Set(target.score_overall);
    active_plan.score_sequence = Set(target.score_sequence);
    active_plan.score_delivery = Set(target.score_delivery);
    active_plan.score_efficiency = Set(target.score_efficiency);
    active_plan.risk_count_high = Set(target.risk_count_high);
    active_plan.risk_count_medium = Set(target.risk_count_medium);
    active_plan.risk_count_low = Set(target.risk_count_low);
    active_plan.risk_summary = Set(target.risk_summary);
    active_plan.updated_at = Set(Some(chrono::Utc::now()));
    let updated = active_plan.update(&tx).await?;

    tx.commit().await?;

    write_operation_log(
        "plan",
        "rollback_version",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "版本回滚: plan_id={} 回滚到 plan_id={} (v{})",
            plan_id,
            target_plan_id,
            target.version.unwrap_or(1)
        )),
    )
    .await;

    Ok(updated)
}

use crate::utils::log::write_operation_log;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePlanInput {
    pub name: String,
    pub period_type: String,
    pub start_date: String,
    pub end_date: String,
    pub strategy_id: Option<i32>,
    pub parent_id: Option<i32>,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlanFilter {
    pub status: Option<String>,
    pub period_type: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScheduleResult {
    pub plan_id: i32,
    pub total_count: i32,
    pub total_weight: f64,
    pub roll_change_count: i32,
    pub score: Option<i32>,
    /// 滚动适温材料数量（期内待温→适温的材料）
    pub future_ready_count: Option<i32>,
    /// 本次排程实际使用模式（beam/hybrid/greedy/none）
    pub scheduler_mode_used: Option<String>,
    /// 是否触发了 Beam -> 贪心兜底
    pub fallback_triggered: Option<bool>,
}

#[tauri::command]
pub async fn create_plan(
    input: CreatePlanInput,
) -> Result<crate::models::schedule_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::{self, Column as PlanColumn, Entity as Plan};
    use sea_orm::*;

    let db = get_db();
    let plan_no = format!("SP-{}", chrono::Utc::now().format("%Y%m%d%H%M%S"));

    let (parent_id, version) = if let Some(parent_id) = input.parent_id {
        let parent = Plan::find_by_id(parent_id)
            .one(db)
            .await?
            .ok_or(AppError::PlanNotFound(parent_id))?;

        let mut root_id = parent.id;
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

        let mut version_ids = vec![root_id];
        let mut idx = 0usize;
        while idx < version_ids.len() {
            let pid = version_ids[idx];
            let children = Plan::find()
                .filter(PlanColumn::ParentId.eq(pid))
                .all(db)
                .await?;
            for child in children {
                if !version_ids.contains(&child.id) {
                    version_ids.push(child.id);
                }
            }
            idx += 1;
        }

        let max_version = Plan::find()
            .filter(PlanColumn::Id.is_in(version_ids))
            .all(db)
            .await?
            .into_iter()
            .map(|p| p.version.unwrap_or(1))
            .max()
            .unwrap_or(1);

        (Some(parent_id), Some(max_version + 1))
    } else {
        (None, Some(1))
    };

    let plan = schedule_plan::ActiveModel {
        plan_no: Set(plan_no),
        name: Set(input.name),
        period_type: Set(input.period_type),
        start_date: Set(input.start_date),
        end_date: Set(input.end_date),
        strategy_id: Set(input.strategy_id),
        status: Set(Some("draft".to_string())),
        parent_id: Set(parent_id),
        version: Set(version),
        remarks: Set(input.remarks),
        ..Default::default()
    };

    let result = plan.insert(db).await?;
    write_operation_log(
        "plan",
        "create",
        Some("plan"),
        Some(result.id),
        Some(format!(
            "创建方案 {} ({})，版本 v{}",
            result.name,
            result.plan_no,
            result.version.unwrap_or(1)
        )),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn get_plan(id: i32) -> Result<crate::models::schedule_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::Entity as Plan;
    use sea_orm::*;

    let db = get_db();
    Plan::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(id))
}

#[tauri::command]
pub async fn get_plans(
    filter: Option<PlanFilter>,
) -> Result<Vec<crate::models::schedule_plan::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::Entity as Plan;
    use sea_orm::*;

    let db = get_db();
    let mut query = Plan::find();

    if let Some(ref f) = filter {
        if let Some(ref status) = f.status {
            query = query.filter(crate::models::schedule_plan::Column::Status.eq(status.clone()));
        }
        if let Some(ref period_type) = f.period_type {
            query = query
                .filter(crate::models::schedule_plan::Column::PeriodType.eq(period_type.clone()));
        }
    }

    let plans = query
        .order_by_desc(crate::models::schedule_plan::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(plans)
}

#[tauri::command]
pub async fn save_plan(id: i32) -> Result<crate::models::schedule_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::Entity as Plan;
    use sea_orm::*;

    let db = get_db();
    let plan = Plan::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(id))?;

    let mut active: crate::models::schedule_plan::ActiveModel = plan.into();
    active.status = Set(Some("saved".to_string()));
    active.updated_at = Set(Some(chrono::Utc::now()));

    let result = active.update(db).await?;
    write_operation_log(
        "plan",
        "save",
        Some("plan"),
        Some(result.id),
        Some(format!("保存方案 {} ({})", result.name, result.plan_no)),
    )
    .await;
    Ok(result)
}

#[tauri::command]
pub async fn delete_plan(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::{self, Entity as Plan};
    use sea_orm::*;

    let db = get_db();
    let plan = Plan::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(id))?;

    let child_count = Plan::find()
        .filter(schedule_plan::Column::ParentId.eq(id))
        .count(db)
        .await?;
    if child_count > 0 {
        return Err(AppError::ConstraintViolation(format!(
            "方案存在 {} 个子版本，请先删除子版本",
            child_count
        )));
    }

    Plan::delete_by_id(id).exec(db).await?;
    write_operation_log(
        "plan",
        "delete",
        Some("plan"),
        Some(id),
        Some(format!("删除方案 {} ({})", plan.name, plan.plan_no)),
    )
    .await;
    Ok(())
}

#[tauri::command]
pub async fn update_plan_status(
    id: i32,
    status: String,
) -> Result<crate::models::schedule_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan::Entity as Plan;
    use sea_orm::*;

    let db = get_db();
    let plan = Plan::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(id))?;

    let mut active: crate::models::schedule_plan::ActiveModel = plan.into();
    let status_clone = status.clone();
    active.status = Set(Some(status));
    active.updated_at = Set(Some(chrono::Utc::now()));

    let result = active.update(db).await?;
    let action = match status_clone.as_str() {
        "confirmed" => "confirm",
        "archived" => "archive",
        "saved" => "save",
        _ => "update",
    };
    write_operation_log(
        "plan",
        action,
        Some("plan"),
        Some(result.id),
        Some(format!("更新方案状态为 {}", status_clone)),
    )
    .await;
    Ok(result)
}

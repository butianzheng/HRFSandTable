use super::plan::ScheduleResult;
use crate::utils::log::write_operation_log;
use crate::AppError;
use chrono::Timelike;
use sea_orm::prelude::Expr;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IdleGapItem {
    pub shift_date: String,
    pub shift_type: String,
    pub prev_sequence: i32,
    pub next_sequence: i32,
    pub prev_end: String,
    pub next_start: String,
    pub gap_minutes: i32,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IdleGapSummary {
    pub plan_id: i32,
    pub threshold_minutes: i32,
    pub total_checked_gaps: i32,
    pub over_threshold_count: i32,
    pub max_gap_minutes: i32,
    pub avg_gap_minutes: f64,
    pub items: Vec<IdleGapItem>,
}

#[tauri::command]
pub async fn auto_schedule(plan_id: i32, strategy_id: i32) -> Result<ScheduleResult, AppError> {
    log::info!(
        "Auto scheduling plan {} with strategy {}",
        plan_id,
        strategy_id
    );

    let output = crate::engine::scheduler::auto_schedule(plan_id, strategy_id).await?;

    let result = ScheduleResult {
        plan_id: output.plan_id,
        total_count: output.total_count,
        total_weight: output.total_weight,
        roll_change_count: output.roll_change_count,
        score: Some(output.eval.score_overall),
        future_ready_count: if output.future_ready_count > 0 {
            Some(output.future_ready_count)
        } else {
            None
        },
        scheduler_mode_used: Some(output.scheduler_mode_used.clone()),
        fallback_triggered: Some(output.fallback_triggered),
    };

    write_operation_log(
        "schedule",
        "auto_schedule",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "自动排程完成: strategy_id={}, total_count={}, total_weight={:.1}, score={}, mode={}, fallback={}",
            strategy_id,
            result.total_count,
            result.total_weight,
            result.score.unwrap_or(0),
            result
                .scheduler_mode_used
                .as_deref()
                .unwrap_or("unknown"),
            result.fallback_triggered.unwrap_or(false)
        )),
    )
    .await;

    Ok(result)
}

fn parse_hhmm_to_minutes(value: &str) -> Option<i32> {
    let t = chrono::NaiveTime::parse_from_str(value, "%H:%M").ok()?;
    Some((t.hour() as i32) * 60 + (t.minute() as i32))
}

fn calc_gap_minutes(prev_end: i32, next_start: i32) -> i32 {
    if next_start >= prev_end {
        next_start - prev_end
    } else {
        24 * 60 - prev_end + next_start
    }
}

#[tauri::command]
pub async fn analyze_schedule_idle_gaps(
    plan_id: i32,
    threshold_minutes: Option<i32>,
) -> Result<IdleGapSummary, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_item;
    use sea_orm::*;

    let db = get_db();
    let threshold = threshold_minutes.unwrap_or(30).clamp(1, 720);
    let items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let mut checked = 0i32;
    let mut over_items: Vec<IdleGapItem> = Vec::new();
    let mut max_gap = 0i32;
    let mut sum_gap = 0i64;

    for pair in items.windows(2) {
        let prev = &pair[0];
        let curr = &pair[1];
        // 只分析同一班次内的空档
        if prev.shift_no != curr.shift_no
            || prev.shift_date != curr.shift_date
            || prev.shift_type != curr.shift_type
        {
            continue;
        }
        let Some(prev_end) = prev.planned_end.as_deref().and_then(parse_hhmm_to_minutes) else {
            continue;
        };
        let Some(next_start) = curr
            .planned_start
            .as_deref()
            .and_then(parse_hhmm_to_minutes)
        else {
            continue;
        };
        let gap = calc_gap_minutes(prev_end, next_start);
        if gap <= 0 {
            continue;
        }
        checked += 1;
        if gap > threshold {
            max_gap = max_gap.max(gap);
            sum_gap += gap as i64;
            over_items.push(IdleGapItem {
                shift_date: curr.shift_date.clone(),
                shift_type: curr.shift_type.clone(),
                prev_sequence: prev.sequence,
                next_sequence: curr.sequence,
                prev_end: prev.planned_end.clone().unwrap_or_default(),
                next_start: curr.planned_start.clone().unwrap_or_default(),
                gap_minutes: gap,
            });
        }
    }

    let over_count = over_items.len() as i32;
    let avg_gap = if over_count > 0 {
        sum_gap as f64 / over_count as f64
    } else {
        0.0
    };

    Ok(IdleGapSummary {
        plan_id,
        threshold_minutes: threshold,
        total_checked_gaps: checked,
        over_threshold_count: over_count,
        max_gap_minutes: max_gap,
        avg_gap_minutes: avg_gap,
        items: over_items,
    })
}

#[tauri::command]
pub async fn add_to_schedule(
    plan_id: i32,
    material_ids: Vec<i32>,
    position: Option<i32>,
) -> Result<Vec<crate::models::schedule_item::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::{material, schedule_item};
    use sea_orm::*;

    log::info!(
        "Adding {} materials to plan {}",
        material_ids.len(),
        plan_id
    );

    let db = get_db();

    if material_ids.is_empty() {
        return Ok(vec![]);
    }

    // 防止同一个请求中重复 material_id
    let mut dedup_ids = Vec::with_capacity(material_ids.len());
    for id in material_ids {
        if !dedup_ids.contains(&id) {
            dedup_ids.push(id);
        }
    }

    // 校验：材料存在且已适温
    let materials = material::Entity::find()
        .filter(material::Column::Id.is_in(dedup_ids.clone()))
        .all(db)
        .await?;

    let mut material_map = std::collections::HashMap::new();
    for m in materials {
        material_map.insert(m.id, m);
    }

    let mut missing_ids = Vec::new();
    let mut not_ready_coils = Vec::new();
    for mat_id in &dedup_ids {
        match material_map.get(mat_id) {
            Some(mat) => {
                if mat.temp_status.as_deref() != Some("ready") {
                    not_ready_coils.push(mat.coil_id.clone());
                }
            }
            None => missing_ids.push(*mat_id),
        }
    }

    if !missing_ids.is_empty() {
        return Err(AppError::ConstraintViolation(format!(
            "材料不存在: {:?}",
            missing_ids
        )));
    }

    if !not_ready_coils.is_empty() {
        let preview = not_ready_coils
            .iter()
            .take(10)
            .cloned()
            .collect::<Vec<_>>()
            .join(", ");
        let suffix = if not_ready_coils.len() > 10 {
            " ..."
        } else {
            ""
        };
        return Err(AppError::MaterialNotTempered(format!(
            "仅允许适温材料入排，待温材料: {}{}",
            preview, suffix
        )));
    }

    // 校验：同一方案中不允许重复添加
    let existing = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .filter(schedule_item::Column::MaterialId.is_in(dedup_ids.clone()))
        .all(db)
        .await?;
    if !existing.is_empty() {
        let existing_ids = existing.iter().map(|v| v.material_id).collect::<Vec<_>>();
        return Err(AppError::ConstraintViolation(format!(
            "材料已存在于当前排程: {:?}",
            existing_ids
        )));
    }

    // 获取当前最大序号
    let max_seq = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_desc(schedule_item::Column::Sequence)
        .one(db)
        .await?
        .map(|item| item.sequence)
        .unwrap_or(0);

    let insert_position = position.unwrap_or(max_seq + 1);
    if insert_position < 1 {
        return Err(AppError::ConstraintViolation(format!(
            "插入位置非法: {}",
            insert_position
        )));
    }

    let max_allowed = max_seq + 1;
    if insert_position > max_allowed {
        return Err(AppError::ConstraintViolation(format!(
            "插入位置超出范围: {} > {}",
            insert_position, max_allowed
        )));
    }

    let shift_by = dedup_ids.len() as i32;
    if shift_by > 0 {
        schedule_item::Entity::update_many()
            .col_expr(
                schedule_item::Column::Sequence,
                Expr::col(schedule_item::Column::Sequence).add(shift_by),
            )
            .filter(schedule_item::Column::PlanId.eq(plan_id))
            .filter(schedule_item::Column::Sequence.gte(insert_position))
            .exec(db)
            .await?;
    }

    let mut created = Vec::new();
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();

    for (i, mat_id) in dedup_ids.iter().enumerate() {
        let seq = insert_position + i as i32;
        let item = schedule_item::ActiveModel {
            plan_id: Set(plan_id),
            material_id: Set(*mat_id),
            sequence: Set(seq),
            shift_date: Set(today.clone()),
            shift_no: Set(1),
            shift_type: Set("day".into()),
            is_locked: Set(Some(false)),
            ..Default::default()
        };
        let result = item.insert(db).await?;
        created.push(result);
    }

    write_operation_log(
        "schedule",
        "add_material",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "添加材料到排程: {} 条, 插入位置={}",
            created.len(),
            insert_position
        )),
    )
    .await;

    Ok(created)
}

#[tauri::command]
pub async fn remove_from_schedule(plan_id: i32, item_ids: Vec<i32>) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_item::Entity as Item;
    use sea_orm::*;

    let db = get_db();
    let result = Item::delete_many()
        .filter(crate::models::schedule_item::Column::PlanId.eq(plan_id))
        .filter(crate::models::schedule_item::Column::Id.is_in(item_ids))
        .exec(db)
        .await?;

    write_operation_log(
        "schedule",
        "remove_material",
        Some("plan"),
        Some(plan_id),
        Some(format!("移除排程项: {} 条", result.rows_affected)),
    )
    .await;

    Ok(result.rows_affected)
}

#[tauri::command]
pub async fn move_schedule_item(
    plan_id: i32,
    item_id: i32,
    new_position: i32,
) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::schedule_item;
    use sea_orm::*;

    log::info!(
        "Moving item {} to position {} in plan {}",
        item_id,
        new_position,
        plan_id
    );

    let db = get_db();

    let mut items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let old_idx = items
        .iter()
        .position(|i| i.id == item_id)
        .ok_or(AppError::Internal(format!("排程项 {} 不存在", item_id)))?;

    let new_idx = ((new_position - 1) as usize).min(items.len().saturating_sub(1));

    if old_idx == new_idx {
        return Ok(());
    }

    let item = items.remove(old_idx);
    items.insert(new_idx, item);

    for (i, it) in items.iter().enumerate() {
        let seq = i as i32 + 1;
        if it.sequence != seq {
            schedule_item::Entity::update_many()
                .col_expr(schedule_item::Column::Sequence, Expr::value(seq))
                .filter(schedule_item::Column::Id.eq(it.id))
                .exec(db)
                .await?;
        }
    }

    write_operation_log(
        "schedule",
        "move_item",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "移动排程项: item_id={}, 目标位置={}",
            item_id, new_position
        )),
    )
    .await;

    Ok(())
}

#[tauri::command]
pub async fn lock_schedule_items(
    plan_id: i32,
    item_ids: Vec<i32>,
    locked: bool,
) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_item::Entity as Item;
    use sea_orm::*;

    let db = get_db();
    let result = Item::update_many()
        .col_expr(
            crate::models::schedule_item::Column::IsLocked,
            Expr::value(locked),
        )
        .filter(crate::models::schedule_item::Column::PlanId.eq(plan_id))
        .filter(crate::models::schedule_item::Column::Id.is_in(item_ids))
        .exec(db)
        .await?;

    write_operation_log(
        "schedule",
        if locked { "lock" } else { "unlock" },
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "{}排程项 {} 条",
            if locked { "锁定" } else { "解锁" },
            result.rows_affected
        )),
    )
    .await;

    Ok(result.rows_affected)
}

#[tauri::command]
pub async fn get_schedule_items(
    plan_id: i32,
) -> Result<Vec<crate::models::schedule_item::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_item::Entity as Item;
    use sea_orm::*;

    let db = get_db();
    let items = Item::find()
        .filter(crate::models::schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(crate::models::schedule_item::Column::Sequence)
        .all(db)
        .await?;

    Ok(items)
}

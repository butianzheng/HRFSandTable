use crate::utils::log::write_operation_log;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct UndoRedoResult {
    pub action_type: String,
    pub remaining: usize,
}

#[tauri::command]
pub async fn push_undo(
    plan_id: i32,
    action_type: String,
    before_state: String,
    after_state: String,
) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::undo_stack;
    use sea_orm::*;

    let db = get_db();

    // 清除当前位置之后的 redo 记录
    undo_stack::Entity::delete_many()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(true))
        .exec(db)
        .await?;

    let entry = undo_stack::ActiveModel {
        plan_id: Set(plan_id),
        action_type: Set(action_type),
        before_state: Set(before_state),
        after_state: Set(after_state),
        is_undone: Set(Some(false)),
        ..Default::default()
    };

    entry.insert(db).await?;

    // 依据系统配置限制每个方案的撤销栈长度（默认 50）
    let configured_max_steps = crate::models::system_config::Entity::find()
        .filter(crate::models::system_config::Column::ConfigGroup.eq("undo"))
        .filter(crate::models::system_config::Column::ConfigKey.eq("max_steps"))
        .one(db)
        .await?
        .and_then(|row| row.config_value.parse::<usize>().ok())
        .unwrap_or(50);
    let max_steps = configured_max_steps.clamp(1, 500);

    let undo_entries = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .order_by_desc(undo_stack::Column::CreatedAt)
        .all(db)
        .await?;
    if undo_entries.len() > max_steps {
        let stale_ids: Vec<i32> = undo_entries
            .into_iter()
            .skip(max_steps)
            .map(|row| row.id)
            .collect();
        if !stale_ids.is_empty() {
            undo_stack::Entity::delete_many()
                .filter(undo_stack::Column::Id.is_in(stale_ids))
                .exec(db)
                .await?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn undo_action(plan_id: i32) -> Result<UndoRedoResult, AppError> {
    use crate::db::get_db;
    use crate::models::undo_stack;
    use sea_orm::*;

    let db = get_db();

    // 找到最近的未撤销操作
    let latest = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(false))
        .order_by_desc(undo_stack::Column::CreatedAt)
        .one(db)
        .await?
        .ok_or(AppError::NothingToUndo)?;

    let action_type = latest.action_type.clone();

    // 恢复 before_state
    let items: Vec<crate::models::schedule_item::Model> =
        serde_json::from_str(&latest.before_state)
            .map_err(|e| AppError::Internal(format!("反序列化失败: {}", e)))?;

    // 清除当前排程项
    crate::models::schedule_item::Entity::delete_many()
        .filter(crate::models::schedule_item::Column::PlanId.eq(plan_id))
        .exec(db)
        .await?;

    // 恢复旧状态
    for item in &items {
        let active = crate::models::schedule_item::ActiveModel {
            id: Set(item.id),
            plan_id: Set(item.plan_id),
            material_id: Set(item.material_id),
            sequence: Set(item.sequence),
            shift_date: Set(item.shift_date.clone()),
            shift_no: Set(item.shift_no),
            shift_type: Set(item.shift_type.clone()),
            planned_start: Set(item.planned_start.clone()),
            planned_end: Set(item.planned_end.clone()),
            cumulative_weight: Set(item.cumulative_weight),
            is_roll_change: Set(item.is_roll_change),
            is_locked: Set(item.is_locked),
            lock_reason: Set(item.lock_reason.clone()),
            risk_flags: Set(item.risk_flags.clone()),
            ..Default::default()
        };
        active.insert(db).await?;
    }

    // 标记为已撤销
    let mut active: undo_stack::ActiveModel = latest.into();
    active.is_undone = Set(Some(true));
    active.update(db).await?;

    write_operation_log(
        "schedule",
        "undo",
        Some("plan"),
        Some(plan_id),
        Some(format!("撤销操作: {}", action_type)),
    )
    .await;

    // 计算剩余可撤销数
    let remaining = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(false))
        .count(db)
        .await? as usize;

    Ok(UndoRedoResult {
        action_type,
        remaining,
    })
}

#[tauri::command]
pub async fn redo_action(plan_id: i32) -> Result<UndoRedoResult, AppError> {
    use crate::db::get_db;
    use crate::models::undo_stack;
    use sea_orm::*;

    let db = get_db();

    // 找到最早的已撤销操作
    let earliest = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(true))
        .order_by_asc(undo_stack::Column::CreatedAt)
        .one(db)
        .await?
        .ok_or(AppError::NothingToRedo)?;

    let action_type = earliest.action_type.clone();

    // 恢复 after_state
    let items: Vec<crate::models::schedule_item::Model> =
        serde_json::from_str(&earliest.after_state)
            .map_err(|e| AppError::Internal(format!("反序列化失败: {}", e)))?;

    // 清除当前排程项
    crate::models::schedule_item::Entity::delete_many()
        .filter(crate::models::schedule_item::Column::PlanId.eq(plan_id))
        .exec(db)
        .await?;

    // 恢复新状态
    for item in &items {
        let active = crate::models::schedule_item::ActiveModel {
            id: Set(item.id),
            plan_id: Set(item.plan_id),
            material_id: Set(item.material_id),
            sequence: Set(item.sequence),
            shift_date: Set(item.shift_date.clone()),
            shift_no: Set(item.shift_no),
            shift_type: Set(item.shift_type.clone()),
            planned_start: Set(item.planned_start.clone()),
            planned_end: Set(item.planned_end.clone()),
            cumulative_weight: Set(item.cumulative_weight),
            is_roll_change: Set(item.is_roll_change),
            is_locked: Set(item.is_locked),
            lock_reason: Set(item.lock_reason.clone()),
            risk_flags: Set(item.risk_flags.clone()),
            ..Default::default()
        };
        active.insert(db).await?;
    }

    // 标记为未撤销
    let mut active: undo_stack::ActiveModel = earliest.into();
    active.is_undone = Set(Some(false));
    active.update(db).await?;

    write_operation_log(
        "schedule",
        "redo",
        Some("plan"),
        Some(plan_id),
        Some(format!("重做操作: {}", action_type)),
    )
    .await;

    // 计算剩余可重做数
    let remaining = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(true))
        .count(db)
        .await? as usize;

    Ok(UndoRedoResult {
        action_type,
        remaining,
    })
}

#[tauri::command]
pub async fn get_undo_redo_count(plan_id: i32) -> Result<(usize, usize), AppError> {
    use crate::db::get_db;
    use crate::models::undo_stack;
    use sea_orm::*;

    let db = get_db();

    let undo_count = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(false))
        .count(db)
        .await? as usize;

    let redo_count = undo_stack::Entity::find()
        .filter(undo_stack::Column::PlanId.eq(plan_id))
        .filter(undo_stack::Column::IsUndone.eq(true))
        .count(db)
        .await? as usize;

    Ok((undo_count, redo_count))
}

#[tauri::command]
pub async fn clear_undo_stack(plan_id: Option<i32>) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::undo_stack;
    use sea_orm::*;

    let db = get_db();
    let mut query = undo_stack::Entity::delete_many();
    if let Some(pid) = plan_id {
        query = query.filter(undo_stack::Column::PlanId.eq(pid));
    }

    let result = query.exec(db).await?;
    let plan_text = plan_id
        .map(|v| v.to_string())
        .unwrap_or_else(|| "all".to_string());
    let (target_type, target_id) = if let Some(pid) = plan_id {
        (Some("plan"), Some(pid))
    } else {
        (Some("system"), None)
    };

    write_operation_log(
        "system",
        "clear_undo_stack",
        target_type,
        target_id,
        Some(format!(
            "清理撤销栈 {} 条，plan_id={}",
            result.rows_affected, plan_text
        )),
    )
    .await;

    Ok(result.rows_affected)
}

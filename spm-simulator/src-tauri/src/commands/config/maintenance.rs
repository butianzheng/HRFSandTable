use super::types::{
    parse_datetime_utc, write_operation_log, CreateMaintenancePlanInput, UpdateMaintenancePlanInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_maintenance_plans() -> Result<Vec<crate::models::maintenance_plan::Model>, AppError>
{
    use crate::db::get_db;
    use crate::models::maintenance_plan::Entity as MaintenancePlan;
    use sea_orm::*;

    let db = get_db();
    let plans = MaintenancePlan::find()
        .order_by_desc(crate::models::maintenance_plan::Column::StartTime)
        .all(db)
        .await?;

    Ok(plans)
}

#[tauri::command]
pub async fn create_maintenance_plan(
    input: CreateMaintenancePlanInput,
) -> Result<crate::models::maintenance_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::maintenance_plan;
    use sea_orm::*;

    let db = get_db();
    let start_time = parse_datetime_utc(&input.start_time)?;
    let end_time = parse_datetime_utc(&input.end_time)?;
    if start_time >= end_time {
        return Err(AppError::ConstraintViolation(
            "检修结束时间必须晚于开始时间".to_string(),
        ));
    }

    let plan = maintenance_plan::ActiveModel {
        title: Set(input.title),
        start_time: Set(start_time),
        end_time: Set(end_time),
        maintenance_type: Set(input.maintenance_type),
        recurrence: Set(input.recurrence),
        is_active: Set(input.is_active.or(Some(true))),
        description: Set(input.description),
        ..Default::default()
    };

    let result = plan.insert(db).await?;

    write_operation_log(
        "create",
        Some("maintenance_plan"),
        Some(result.id),
        Some(format!("创建检修计划: {}", result.title)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn update_maintenance_plan(
    id: i32,
    input: UpdateMaintenancePlanInput,
) -> Result<crate::models::maintenance_plan::Model, AppError> {
    use crate::db::get_db;
    use crate::models::maintenance_plan::Entity as MaintenancePlan;
    use sea_orm::*;

    let db = get_db();
    let plan = MaintenancePlan::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal(format!("检修计划不存在: {}", id)))?;

    let mut final_start_time = plan.start_time;
    let mut final_end_time = plan.end_time;
    let mut active: crate::models::maintenance_plan::ActiveModel = plan.into();

    if let Some(title) = input.title {
        active.title = Set(title);
    }
    if let Some(start_time) = input.start_time {
        final_start_time = parse_datetime_utc(&start_time)?;
        active.start_time = Set(final_start_time);
    }
    if let Some(end_time) = input.end_time {
        final_end_time = parse_datetime_utc(&end_time)?;
        active.end_time = Set(final_end_time);
    }
    if let Some(maintenance_type) = input.maintenance_type {
        active.maintenance_type = Set(maintenance_type);
    }
    if let Some(recurrence) = input.recurrence {
        active.recurrence = Set(Some(recurrence));
    }
    if let Some(is_active) = input.is_active {
        active.is_active = Set(Some(is_active));
    }
    if let Some(description) = input.description {
        active.description = Set(Some(description));
    }

    if final_start_time >= final_end_time {
        return Err(AppError::ConstraintViolation(
            "检修结束时间必须晚于开始时间".to_string(),
        ));
    }

    active.updated_at = Set(Some(chrono::Utc::now()));
    let result = active.update(db).await?;

    write_operation_log(
        "update",
        Some("maintenance_plan"),
        Some(result.id),
        Some(format!("更新检修计划: {}", result.title)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_maintenance_plan(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::maintenance_plan::Entity as MaintenancePlan;
    use sea_orm::*;

    let db = get_db();
    let result = MaintenancePlan::delete_by_id(id).exec(db).await?;

    if result.rows_affected > 0 {
        write_operation_log(
            "delete",
            Some("maintenance_plan"),
            Some(id),
            Some(format!("删除检修计划: {}", id)),
        )
        .await;
    }

    Ok(())
}

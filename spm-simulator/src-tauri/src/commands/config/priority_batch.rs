use super::types::{
    normalize_optional_text, normalize_required_text, write_operation_log, BatchPriorityUpsertInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_batch_priority_configs(
) -> Result<Vec<crate::models::batch_priority_config::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::batch_priority_config::{self, Entity as BatchPriorityConfig};
    use sea_orm::*;

    let db = get_db();
    let rows = BatchPriorityConfig::find()
        .order_by_desc(batch_priority_config::Column::PriorityScore)
        .order_by_asc(batch_priority_config::Column::BatchCode)
        .all(db)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_batch_priority_config(
    input: BatchPriorityUpsertInput,
) -> Result<crate::models::batch_priority_config::Model, AppError> {
    use crate::db::get_db;
    use crate::models::batch_priority_config::{self, Entity as BatchPriorityConfig};
    use sea_orm::*;

    let db = get_db();
    let batch_code = normalize_required_text(&input.batch_code, "batch_code")?;
    let batch_name = normalize_required_text(&input.batch_name, "batch_name")?;
    let priority_type = normalize_required_text(&input.priority_type, "priority_type")?;
    let remarks = normalize_optional_text(input.remarks);

    let existing = if let Some(id) = input.id {
        Some(
            BatchPriorityConfig::find_by_id(id)
                .one(db)
                .await?
                .ok_or(AppError::Internal(format!("集批优先级配置不存在: {}", id)))?,
        )
    } else {
        BatchPriorityConfig::find()
            .filter(batch_priority_config::Column::BatchCode.eq(batch_code.clone()))
            .one(db)
            .await?
    };

    let result = if let Some(row) = existing {
        let mut active: batch_priority_config::ActiveModel = row.into();
        active.batch_code = Set(batch_code.clone());
        active.batch_name = Set(batch_name);
        active.priority_type = Set(priority_type);
        active.priority_score = Set(input.priority_score);
        active.enabled = Set(input.enabled);
        active.remarks = Set(remarks);
        active.updated_at = Set(Some(chrono::Utc::now()));
        active.update(db).await?
    } else {
        let active = batch_priority_config::ActiveModel {
            batch_code: Set(batch_code.clone()),
            batch_name: Set(batch_name),
            priority_type: Set(priority_type),
            priority_score: Set(input.priority_score),
            enabled: Set(input.enabled),
            remarks: Set(remarks),
            updated_at: Set(Some(chrono::Utc::now())),
            ..Default::default()
        };
        active.insert(db).await?
    };

    write_operation_log(
        "upsert",
        Some("batch_priority_config"),
        Some(result.id),
        Some(format!("保存集批优先级配置: {}", result.batch_code)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_batch_priority_config(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::batch_priority_config::Entity as BatchPriorityConfig;
    use sea_orm::*;

    let db = get_db();
    let existing = BatchPriorityConfig::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal(format!("集批优先级配置不存在: {}", id)))?;
    BatchPriorityConfig::delete_by_id(id).exec(db).await?;

    write_operation_log(
        "delete",
        Some("batch_priority_config"),
        Some(id),
        Some(format!("删除集批优先级配置: {}", existing.batch_code)),
    )
    .await;

    Ok(())
}

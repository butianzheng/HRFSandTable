use super::types::{
    normalize_optional_text, normalize_required_text, write_operation_log,
    PriorityDimensionUpsertInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_priority_dimension_configs(
    dimension_type: Option<String>,
) -> Result<Vec<crate::models::priority_dimension_config::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::priority_dimension_config::{self, Entity as PriorityDimensionConfig};
    use sea_orm::*;

    let db = get_db();
    let mut query = PriorityDimensionConfig::find();

    if let Some(dtype) = dimension_type {
        let trimmed = dtype.trim();
        if !trimmed.is_empty() {
            query = query
                .filter(priority_dimension_config::Column::DimensionType.eq(trimmed.to_string()));
        }
    }

    let rows = query
        .order_by_asc(priority_dimension_config::Column::DimensionType)
        .order_by_asc(priority_dimension_config::Column::SortOrder)
        .order_by_asc(priority_dimension_config::Column::Id)
        .all(db)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_priority_dimension_config(
    input: PriorityDimensionUpsertInput,
) -> Result<crate::models::priority_dimension_config::Model, AppError> {
    use crate::db::get_db;
    use crate::models::priority_dimension_config::{self, Entity as PriorityDimensionConfig};
    use sea_orm::*;

    let db = get_db();

    let dimension_type = normalize_required_text(&input.dimension_type, "dimension_type")?;
    let dimension_code = normalize_required_text(&input.dimension_code, "dimension_code")?;
    let dimension_name = normalize_required_text(&input.dimension_name, "dimension_name")?;
    let rule_config = normalize_optional_text(input.rule_config);
    let description = normalize_optional_text(input.description);

    if let Some(rule_text) = rule_config.as_ref() {
        serde_json::from_str::<serde_json::Value>(rule_text).map_err(|e| {
            AppError::DataConversionError(format!("rule_config JSON格式错误: {}", e))
        })?;
    }

    let existing = if let Some(id) = input.id {
        PriorityDimensionConfig::find_by_id(id)
            .one(db)
            .await?
            .ok_or(AppError::Internal(format!("优先级维度配置不存在: {}", id)))?
    } else if let Some(row) = PriorityDimensionConfig::find()
        .filter(priority_dimension_config::Column::DimensionType.eq(dimension_type.clone()))
        .filter(priority_dimension_config::Column::DimensionCode.eq(dimension_code.clone()))
        .one(db)
        .await?
    {
        row
    } else {
        let active = priority_dimension_config::ActiveModel {
            dimension_type: Set(dimension_type.clone()),
            dimension_code: Set(dimension_code.clone()),
            dimension_name: Set(dimension_name),
            score: Set(input.score),
            enabled: Set(input.enabled),
            sort_order: Set(Some(input.sort_order.unwrap_or(0))),
            rule_config: Set(rule_config),
            description: Set(description),
            updated_at: Set(Some(chrono::Utc::now())),
            ..Default::default()
        };
        let result = active.insert(db).await?;

        write_operation_log(
            "create",
            Some("priority_dimension_config"),
            Some(result.id),
            Some(format!(
                "新增优先级维度配置: {} / {}",
                result.dimension_type, result.dimension_code
            )),
        )
        .await;

        return Ok(result);
    };

    let mut active: priority_dimension_config::ActiveModel = existing.into();
    active.dimension_type = Set(dimension_type.clone());
    active.dimension_code = Set(dimension_code.clone());
    active.dimension_name = Set(dimension_name);
    active.score = Set(input.score);
    active.enabled = Set(input.enabled);
    active.sort_order = Set(Some(input.sort_order.unwrap_or(0)));
    active.rule_config = Set(rule_config);
    active.description = Set(description);
    active.updated_at = Set(Some(chrono::Utc::now()));
    let result = active.update(db).await?;

    write_operation_log(
        "update",
        Some("priority_dimension_config"),
        Some(result.id),
        Some(format!(
            "更新优先级维度配置: {} / {}",
            result.dimension_type, result.dimension_code
        )),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_priority_dimension_config(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::priority_dimension_config::Entity as PriorityDimensionConfig;
    use sea_orm::*;

    let db = get_db();
    let existing = PriorityDimensionConfig::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal(format!("优先级维度配置不存在: {}", id)))?;
    PriorityDimensionConfig::delete_by_id(id).exec(db).await?;

    write_operation_log(
        "delete",
        Some("priority_dimension_config"),
        Some(id),
        Some(format!(
            "删除优先级维度配置: {} / {}",
            existing.dimension_type, existing.dimension_code
        )),
    )
    .await;

    Ok(())
}

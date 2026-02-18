use super::types::{
    normalize_optional_text, normalize_required_text, write_operation_log,
    ProductTypePriorityUpsertInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_product_type_priority_configs(
) -> Result<Vec<crate::models::product_type_priority_config::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::product_type_priority_config::{self, Entity as ProductTypePriorityConfig};
    use sea_orm::*;

    let db = get_db();
    let rows = ProductTypePriorityConfig::find()
        .order_by_desc(product_type_priority_config::Column::PriorityScore)
        .order_by_asc(product_type_priority_config::Column::ProductType)
        .all(db)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_product_type_priority_config(
    input: ProductTypePriorityUpsertInput,
) -> Result<crate::models::product_type_priority_config::Model, AppError> {
    use crate::db::get_db;
    use crate::models::product_type_priority_config::{self, Entity as ProductTypePriorityConfig};
    use sea_orm::*;

    let db = get_db();
    let product_type = normalize_required_text(&input.product_type, "product_type")?;
    let product_name = normalize_required_text(&input.product_name, "product_name")?;
    let priority_level = normalize_required_text(&input.priority_level, "priority_level")?;
    let remarks = normalize_optional_text(input.remarks);

    let existing = if let Some(id) = input.id {
        Some(
            ProductTypePriorityConfig::find_by_id(id)
                .one(db)
                .await?
                .ok_or(AppError::Internal(format!(
                    "产品大类优先级配置不存在: {}",
                    id
                )))?,
        )
    } else {
        ProductTypePriorityConfig::find()
            .filter(product_type_priority_config::Column::ProductType.eq(product_type.clone()))
            .one(db)
            .await?
    };

    let result = if let Some(row) = existing {
        let mut active: product_type_priority_config::ActiveModel = row.into();
        active.product_type = Set(product_type.clone());
        active.product_name = Set(product_name);
        active.priority_level = Set(priority_level);
        active.priority_score = Set(input.priority_score);
        active.enabled = Set(input.enabled);
        active.remarks = Set(remarks);
        active.updated_at = Set(Some(chrono::Utc::now()));
        active.update(db).await?
    } else {
        let active = product_type_priority_config::ActiveModel {
            product_type: Set(product_type.clone()),
            product_name: Set(product_name),
            priority_level: Set(priority_level),
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
        Some("product_type_priority_config"),
        Some(result.id),
        Some(format!("保存产品大类优先级配置: {}", result.product_type)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_product_type_priority_config(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::product_type_priority_config::Entity as ProductTypePriorityConfig;
    use sea_orm::*;

    let db = get_db();
    let existing = ProductTypePriorityConfig::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal(format!(
            "产品大类优先级配置不存在: {}",
            id
        )))?;
    ProductTypePriorityConfig::delete_by_id(id).exec(db).await?;

    write_operation_log(
        "delete",
        Some("product_type_priority_config"),
        Some(id),
        Some(format!("删除产品大类优先级配置: {}", existing.product_type)),
    )
    .await;

    Ok(())
}

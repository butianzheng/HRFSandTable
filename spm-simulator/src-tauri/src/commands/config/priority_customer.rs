use super::types::{
    normalize_optional_text, normalize_required_text, write_operation_log,
    CustomerPriorityUpsertInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_customer_priority_configs(
) -> Result<Vec<crate::models::customer_priority_config::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::customer_priority_config::{self, Entity as CustomerPriorityConfig};
    use sea_orm::*;

    let db = get_db();
    let rows = CustomerPriorityConfig::find()
        .order_by_desc(customer_priority_config::Column::PriorityScore)
        .order_by_asc(customer_priority_config::Column::CustomerCode)
        .all(db)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_customer_priority_config(
    input: CustomerPriorityUpsertInput,
) -> Result<crate::models::customer_priority_config::Model, AppError> {
    use crate::db::get_db;
    use crate::models::customer_priority_config::{self, Entity as CustomerPriorityConfig};
    use sea_orm::*;

    let db = get_db();
    let customer_code = normalize_required_text(&input.customer_code, "customer_code")?;
    let customer_name = normalize_required_text(&input.customer_name, "customer_name")?;
    let priority_level = normalize_required_text(&input.priority_level, "priority_level")?;
    let remarks = normalize_optional_text(input.remarks);

    let existing = if let Some(id) = input.id {
        Some(
            CustomerPriorityConfig::find_by_id(id)
                .one(db)
                .await?
                .ok_or(AppError::Internal(format!("客户优先级配置不存在: {}", id)))?,
        )
    } else {
        CustomerPriorityConfig::find()
            .filter(customer_priority_config::Column::CustomerCode.eq(customer_code.clone()))
            .one(db)
            .await?
    };

    let result = if let Some(row) = existing {
        let mut active: customer_priority_config::ActiveModel = row.into();
        active.customer_code = Set(customer_code.clone());
        active.customer_name = Set(customer_name);
        active.priority_level = Set(priority_level);
        active.priority_score = Set(input.priority_score);
        active.enabled = Set(input.enabled);
        active.remarks = Set(remarks);
        active.updated_at = Set(Some(chrono::Utc::now()));
        active.update(db).await?
    } else {
        let active = customer_priority_config::ActiveModel {
            customer_code: Set(customer_code.clone()),
            customer_name: Set(customer_name),
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
        Some("customer_priority_config"),
        Some(result.id),
        Some(format!("保存客户优先级配置: {}", result.customer_code)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_customer_priority_config(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::customer_priority_config::Entity as CustomerPriorityConfig;
    use sea_orm::*;

    let db = get_db();
    let existing = CustomerPriorityConfig::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal(format!("客户优先级配置不存在: {}", id)))?;
    CustomerPriorityConfig::delete_by_id(id).exec(db).await?;

    write_operation_log(
        "delete",
        Some("customer_priority_config"),
        Some(id),
        Some(format!("删除客户优先级配置: {}", existing.customer_code)),
    )
    .await;

    Ok(())
}

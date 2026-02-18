use super::types::{
    normalize_optional_text, normalize_required_text, write_operation_log,
    PriorityWeightUpsertInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_priority_weight_configs(
) -> Result<Vec<crate::models::priority_weight_config::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::priority_weight_config::Entity as PriorityWeightConfig;
    use sea_orm::*;

    let db = get_db();
    let rows = PriorityWeightConfig::find()
        .order_by_asc(crate::models::priority_weight_config::Column::SortOrder)
        .order_by_asc(crate::models::priority_weight_config::Column::Id)
        .all(db)
        .await?;
    Ok(rows)
}

#[tauri::command]
pub async fn upsert_priority_weight_configs(
    inputs: Vec<PriorityWeightUpsertInput>,
) -> Result<Vec<crate::models::priority_weight_config::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::priority_weight_config::{self, Entity as PriorityWeightConfig};
    use sea_orm::*;

    let db = get_db();
    if inputs.is_empty() {
        return get_priority_weight_configs().await;
    }

    let tx = db.begin().await?;
    let mut updated = 0u64;
    let mut created = 0u64;

    for input in inputs {
        let dimension_type = normalize_required_text(&input.dimension_type, "dimension_type")?;
        let dimension_name = normalize_required_text(&input.dimension_name, "dimension_name")?;
        if !input.weight.is_finite() || !(0.0..=1.0).contains(&input.weight) {
            return Err(AppError::ConstraintViolation(format!(
                "权重必须在 0.0~1.0 之间: {}",
                input.weight
            )));
        }
        let description = normalize_optional_text(input.description);
        let sort_order = Some(input.sort_order.unwrap_or(0));

        let existing = PriorityWeightConfig::find()
            .filter(priority_weight_config::Column::DimensionType.eq(dimension_type.clone()))
            .one(&tx)
            .await?;

        if let Some(row) = existing {
            let mut active: priority_weight_config::ActiveModel = row.into();
            active.dimension_name = Set(dimension_name);
            active.weight = Set(input.weight);
            active.enabled = Set(input.enabled);
            active.sort_order = Set(sort_order);
            active.description = Set(description);
            active.updated_at = Set(Some(chrono::Utc::now()));
            active.update(&tx).await?;
            updated += 1;
        } else {
            let active = priority_weight_config::ActiveModel {
                dimension_type: Set(dimension_type),
                dimension_name: Set(dimension_name),
                weight: Set(input.weight),
                enabled: Set(input.enabled),
                sort_order: Set(sort_order),
                description: Set(description),
                updated_at: Set(Some(chrono::Utc::now())),
                ..Default::default()
            };
            active.insert(&tx).await?;
            created += 1;
        }
    }

    tx.commit().await?;

    write_operation_log(
        "upsert_priority_weight_configs",
        Some("priority_weight_config"),
        None,
        Some(format!(
            "批量更新优先级权重: 更新 {} 项，新增 {} 项",
            updated, created
        )),
    )
    .await;

    get_priority_weight_configs().await
}

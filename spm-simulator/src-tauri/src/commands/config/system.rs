use super::types::{write_operation_log, ConfigValue, ShiftConfig};
use crate::AppError;
use std::collections::HashMap;

fn infer_value_type(value: &str) -> &'static str {
    let trimmed = value.trim().to_ascii_lowercase();
    if matches!(
        trimmed.as_str(),
        "true" | "false" | "1" | "0" | "yes" | "no"
    ) {
        "boolean"
    } else if value.trim().parse::<f64>().is_ok() {
        "number"
    } else {
        "string"
    }
}

#[tauri::command]
pub async fn get_system_config() -> Result<HashMap<String, HashMap<String, ConfigValue>>, AppError>
{
    use crate::db::get_db;
    use crate::models::system_config::Entity as Config;
    use sea_orm::*;

    let db = get_db();
    let configs = Config::find().all(db).await?;

    let mut result: HashMap<String, HashMap<String, ConfigValue>> = HashMap::new();
    for config in configs {
        result
            .entry(config.config_group.clone())
            .or_default()
            .insert(
                config.config_key,
                ConfigValue {
                    value: config.config_value,
                    value_type: config.value_type,
                    description: config.description,
                },
            );
    }

    Ok(result)
}

#[tauri::command]
pub async fn update_system_config(
    group: String,
    key: String,
    value: String,
) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::system_config::{self, Entity as Config};
    use sea_orm::*;

    let db = get_db();

    let existing = Config::find()
        .filter(crate::models::system_config::Column::ConfigGroup.eq(&group))
        .filter(crate::models::system_config::Column::ConfigKey.eq(&key))
        .one(db)
        .await?;

    if let Some(config) = existing {
        let old_value = config.config_value.clone();
        let new_value = value.clone();
        let mut active: crate::models::system_config::ActiveModel = config.into();
        active.config_value = Set(new_value.clone());
        active.updated_at = Set(Some(chrono::Utc::now()));
        active.update(db).await?;

        write_operation_log(
            "update",
            Some("system_config"),
            None,
            Some(format!(
                "更新系统配置 {}.{}: {} -> {}",
                group, key, old_value, new_value
            )),
        )
        .await;
    } else {
        let inferred_type = infer_value_type(&value).to_string();
        let new_row = system_config::ActiveModel {
            config_group: Set(group.clone()),
            config_key: Set(key.clone()),
            config_value: Set(value.clone()),
            value_type: Set(inferred_type),
            description: Set(None),
            is_editable: Set(Some(true)),
            updated_at: Set(Some(chrono::Utc::now())),
            ..Default::default()
        };
        new_row.insert(db).await?;

        write_operation_log(
            "insert",
            Some("system_config"),
            None,
            Some(format!("新增系统配置 {}.{}={}", group, key, value)),
        )
        .await;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_shift_config() -> Result<Vec<ShiftConfig>, AppError> {
    use crate::db::get_db;
    use crate::models::system_config::Entity as Config;
    use sea_orm::*;

    let db = get_db();
    let rows = Config::find()
        .filter(crate::models::system_config::Column::ConfigGroup.eq("shift"))
        .order_by_asc(crate::models::system_config::Column::ConfigKey)
        .all(db)
        .await?;

    let result = rows
        .into_iter()
        .map(|r| ShiftConfig {
            key: r.config_key,
            value: r.config_value,
        })
        .collect();
    Ok(result)
}

#[tauri::command]
pub async fn update_shift_config(shifts: Vec<ShiftConfig>) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::system_config::{self, Entity as Config};
    use sea_orm::*;

    if shifts.is_empty() {
        return Ok(());
    }

    let db = get_db();
    let mut updated = 0u64;
    let mut created = 0u64;
    let mut keys = Vec::new();

    for item in shifts {
        keys.push(item.key.clone());
        let existing = Config::find()
            .filter(system_config::Column::ConfigGroup.eq("shift"))
            .filter(system_config::Column::ConfigKey.eq(item.key.clone()))
            .one(db)
            .await?;

        if let Some(row) = existing {
            let mut active: system_config::ActiveModel = row.into();
            active.config_value = Set(item.value.clone());
            active.updated_at = Set(Some(chrono::Utc::now()));
            active.update(db).await?;
            updated += 1;
        } else {
            let active = system_config::ActiveModel {
                config_group: Set("shift".to_string()),
                config_key: Set(item.key.clone()),
                config_value: Set(item.value.clone()),
                value_type: Set("string".to_string()),
                description: Set(None),
                is_editable: Set(Some(true)),
                updated_at: Set(Some(chrono::Utc::now())),
                ..Default::default()
            };
            active.insert(db).await?;
            created += 1;
        }
    }

    write_operation_log(
        "update_shift_config",
        Some("system_config"),
        None,
        Some(format!(
            "更新班次配置: 更新 {} 项，新增 {} 项，keys={}",
            updated,
            created,
            keys.join(",")
        )),
    )
    .await;

    Ok(())
}

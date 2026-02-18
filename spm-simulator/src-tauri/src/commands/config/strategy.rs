use super::types::{
    write_operation_log, CreateStrategyInput, StrategyTemplateFile, UpdateStrategyInput,
};
use crate::AppError;

#[tauri::command]
pub async fn get_strategy_templates(
) -> Result<Vec<crate::models::strategy_template::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template::Entity as Template;
    use sea_orm::*;

    let db = get_db();
    let templates = Template::find()
        .order_by_asc(crate::models::strategy_template::Column::Id)
        .all(db)
        .await?;

    Ok(templates)
}

#[tauri::command]
pub async fn create_strategy_template(
    input: CreateStrategyInput,
) -> Result<crate::models::strategy_template::Model, AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template;
    use sea_orm::*;

    let db = get_db();

    let template = strategy_template::ActiveModel {
        name: Set(input.name),
        description: Set(input.description),
        is_default: Set(Some(false)),
        is_system: Set(Some(false)),
        sort_weights: Set(input.sort_weights),
        constraints: Set(input.constraints),
        soft_constraints: Set(input.soft_constraints),
        eval_weights: Set(input.eval_weights),
        temper_rules: Set(input.temper_rules),
        ..Default::default()
    };

    let result = template.insert(db).await?;

    write_operation_log(
        "create",
        Some("strategy_template"),
        Some(result.id),
        Some(format!("创建策略模板: {}", result.name)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn update_strategy_template(
    id: i32,
    input: UpdateStrategyInput,
) -> Result<crate::models::strategy_template::Model, AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template::Entity as Template;
    use sea_orm::*;

    let db = get_db();
    let template = Template::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("策略模板不存在".to_string()))?;
    let old_name = template.name.clone();

    let mut active: crate::models::strategy_template::ActiveModel = template.into();

    if let Some(name) = input.name {
        active.name = Set(name);
    }
    if let Some(description) = input.description {
        active.description = Set(Some(description));
    }
    if let Some(is_default) = input.is_default {
        active.is_default = Set(Some(is_default));
    }
    if let Some(sort_weights) = input.sort_weights {
        active.sort_weights = Set(sort_weights);
    }
    if let Some(constraints) = input.constraints {
        active.constraints = Set(constraints);
    }
    if let Some(soft_constraints) = input.soft_constraints {
        active.soft_constraints = Set(Some(soft_constraints));
    }
    if let Some(eval_weights) = input.eval_weights {
        active.eval_weights = Set(eval_weights);
    }
    if let Some(temper_rules) = input.temper_rules {
        active.temper_rules = Set(temper_rules);
    }

    active.updated_at = Set(Some(chrono::Utc::now()));
    let result = active.update(db).await?;

    write_operation_log(
        "update",
        Some("strategy_template"),
        Some(result.id),
        Some(format!("更新策略模板: {} -> {}", old_name, result.name)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_strategy_template(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template::Entity as Template;
    use sea_orm::*;

    let db = get_db();
    let template = Template::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("策略模板不存在".to_string()))?;
    let template_name = template.name.clone();

    if template.is_system.unwrap_or(false) {
        return Err(AppError::SystemTemplateProtected);
    }

    Template::delete_by_id(id).exec(db).await?;

    write_operation_log(
        "delete",
        Some("strategy_template"),
        Some(id),
        Some(format!("删除策略模板: {}", template_name)),
    )
    .await;

    Ok(())
}

#[tauri::command]
pub async fn set_default_strategy(
    id: i32,
) -> Result<crate::models::strategy_template::Model, AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template::{self, Entity as Template};
    use sea_orm::prelude::Expr;
    use sea_orm::*;

    let db = get_db();
    let template = Template::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("策略模板不存在".to_string()))?;

    Template::update_many()
        .col_expr(strategy_template::Column::IsDefault, Expr::value(false))
        .exec(db)
        .await?;

    let mut active: strategy_template::ActiveModel = template.into();
    active.is_default = Set(Some(true));
    active.updated_at = Set(Some(chrono::Utc::now()));
    let result = active.update(db).await?;

    write_operation_log(
        "update",
        Some("strategy_template"),
        Some(result.id),
        Some(format!("设为默认策略: {}", result.name)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn export_strategy_template(id: i32, file_path: String) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template::Entity as Template;
    use sea_orm::*;

    let db = get_db();
    let tpl = Template::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("策略模板不存在".to_string()))?;
    let tpl_name = tpl.name.clone();

    let payload = StrategyTemplateFile {
        name: tpl.name,
        description: tpl.description,
        sort_weights: tpl.sort_weights,
        constraints: tpl.constraints,
        soft_constraints: tpl.soft_constraints,
        eval_weights: tpl.eval_weights,
        temper_rules: tpl.temper_rules,
    };

    let json = serde_json::to_string_pretty(&payload)
        .map_err(|e| AppError::DataConversionError(format!("序列化失败: {}", e)))?;
    std::fs::write(&file_path, json)?;

    write_operation_log(
        "export",
        Some("strategy_template"),
        Some(id),
        Some(format!("导出策略模板: {} -> {}", tpl_name, file_path)),
    )
    .await;

    Ok(())
}

#[tauri::command]
pub async fn import_strategy_template(
    file_path: String,
) -> Result<crate::models::strategy_template::Model, AppError> {
    use crate::db::get_db;
    use crate::models::strategy_template::{self, Entity as Template};
    use sea_orm::*;

    let db = get_db();
    let content = std::fs::read_to_string(&file_path)?;
    let input: StrategyTemplateFile = serde_json::from_str(&content)
        .map_err(|e| AppError::DataConversionError(format!("JSON格式错误: {}", e)))?;
    let imported_name = input.name.clone();

    let exists = Template::find()
        .filter(strategy_template::Column::Name.eq(input.name.clone()))
        .one(db)
        .await?;
    if exists.is_some() {
        return Err(AppError::TemplateDuplicate(input.name));
    }

    let active = strategy_template::ActiveModel {
        name: Set(input.name),
        description: Set(input.description),
        is_default: Set(Some(false)),
        is_system: Set(Some(false)),
        sort_weights: Set(input.sort_weights),
        constraints: Set(input.constraints),
        soft_constraints: Set(input.soft_constraints),
        eval_weights: Set(input.eval_weights),
        temper_rules: Set(input.temper_rules),
        ..Default::default()
    };

    let result = active.insert(db).await?;

    write_operation_log(
        "import",
        Some("strategy_template"),
        Some(result.id),
        Some(format!("导入策略模板: {} <- {}", imported_name, file_path)),
    )
    .await;

    Ok(result)
}

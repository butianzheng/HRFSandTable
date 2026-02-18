use crate::services::{backup_service, export_service};
use crate::utils::log::write_operation_log as write_log_full;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportResult {
    pub row_count: usize,
    pub file_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateExportTemplateInput {
    pub name: String,
    pub description: Option<String>,
    pub columns: String,
    pub format_rules: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateExportTemplateInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub columns: Option<String>,
    pub format_rules: Option<String>,
    pub is_default: Option<bool>,
}

/// 导出模块专用日志写入（log_type 固定为 "system"）
async fn write_operation_log(
    action: &str,
    target_type: Option<&str>,
    target_id: Option<i32>,
    detail: Option<String>,
) {
    write_log_full("system", action, target_type, target_id, detail).await;
}

#[tauri::command]
pub async fn export_plan_excel(
    plan_id: i32,
    file_path: String,
    template_id: Option<i32>,
) -> Result<ExportResult, AppError> {
    log::info!("导出排程方案Excel: plan_id={}, path={}", plan_id, file_path);
    let row_count = export_service::export_plan_to_excel(plan_id, &file_path, template_id).await?;
    Ok(ExportResult {
        row_count,
        file_path,
    })
}

#[tauri::command]
pub async fn export_plan_csv(
    plan_id: i32,
    file_path: String,
    template_id: Option<i32>,
) -> Result<ExportResult, AppError> {
    log::info!("导出排程方案CSV: plan_id={}, path={}", plan_id, file_path);
    let row_count = export_service::export_plan_to_csv(plan_id, &file_path, template_id).await?;
    Ok(ExportResult {
        row_count,
        file_path,
    })
}

#[tauri::command]
pub async fn export_materials_excel(
    file_path: String,
    status: Option<String>,
) -> Result<ExportResult, AppError> {
    log::info!("导出材料清单Excel: path={}, status={:?}", file_path, status);
    let row_count = export_service::export_materials_to_excel(&file_path, status).await?;
    Ok(ExportResult {
        row_count,
        file_path,
    })
}

#[tauri::command]
pub async fn get_material_stats() -> Result<export_service::MaterialStats, AppError> {
    export_service::get_material_stats().await
}

#[tauri::command]
pub async fn get_export_templates() -> Result<Vec<crate::models::export_template::Model>, AppError>
{
    use crate::db::get_db;
    use crate::models::export_template::Entity as ExportTemplate;
    use sea_orm::*;

    let db = get_db();
    let templates = ExportTemplate::find()
        .order_by_desc(crate::models::export_template::Column::UpdatedAt)
        .order_by_desc(crate::models::export_template::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(templates)
}

#[tauri::command]
pub async fn create_export_template(
    input: CreateExportTemplateInput,
) -> Result<crate::models::export_template::Model, AppError> {
    use crate::db::get_db;
    use crate::models::export_template::{self, Entity as ExportTemplate};
    use sea_orm::sea_query::Expr;
    use sea_orm::*;

    let name = input.name.trim().to_string();
    if name.is_empty() {
        return Err(AppError::DataConversionError(
            "模板名称不能为空".to_string(),
        ));
    }

    serde_json::from_str::<serde_json::Value>(&input.columns)
        .map_err(|e| AppError::DataConversionError(format!("导出列配置JSON格式错误: {}", e)))?;
    if let Some(ref format_rules) = input.format_rules {
        serde_json::from_str::<serde_json::Value>(format_rules)
            .map_err(|e| AppError::DataConversionError(format!("格式化规则JSON格式错误: {}", e)))?;
    }

    let db = get_db();
    let existing = ExportTemplate::find()
        .filter(export_template::Column::Name.eq(name.clone()))
        .one(db)
        .await?;
    if existing.is_some() {
        return Err(AppError::TemplateDuplicate(name));
    }

    let is_default = input.is_default.unwrap_or(false);
    if is_default {
        ExportTemplate::update_many()
            .col_expr(export_template::Column::IsDefault, Expr::value(false))
            .exec(db)
            .await?;
    }

    let active = export_template::ActiveModel {
        name: Set(name),
        description: Set(input.description),
        columns: Set(input.columns),
        format_rules: Set(input.format_rules),
        is_default: Set(Some(is_default)),
        ..Default::default()
    };

    let result = active.insert(db).await?;

    write_operation_log(
        "create",
        Some("export_template"),
        Some(result.id),
        Some(format!("创建导出模板: {}", result.name)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn update_export_template(
    id: i32,
    input: UpdateExportTemplateInput,
) -> Result<crate::models::export_template::Model, AppError> {
    use crate::db::get_db;
    use crate::models::export_template::{self, Entity as ExportTemplate};
    use sea_orm::sea_query::Expr;
    use sea_orm::*;

    let db = get_db();
    let template = ExportTemplate::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("导出模板不存在".to_string()))?;

    let old_name = template.name.clone();
    let mut active: export_template::ActiveModel = template.into();

    if let Some(name) = input.name {
        let name = name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::DataConversionError(
                "模板名称不能为空".to_string(),
            ));
        }
        if name != old_name {
            let existing = ExportTemplate::find()
                .filter(export_template::Column::Name.eq(name.clone()))
                .filter(export_template::Column::Id.ne(id))
                .one(db)
                .await?;
            if existing.is_some() {
                return Err(AppError::TemplateDuplicate(name));
            }
        }
        active.name = Set(name);
    }

    if let Some(description) = input.description {
        active.description = Set(Some(description));
    }
    if let Some(columns) = input.columns {
        serde_json::from_str::<serde_json::Value>(&columns)
            .map_err(|e| AppError::DataConversionError(format!("导出列配置JSON格式错误: {}", e)))?;
        active.columns = Set(columns);
    }
    if let Some(format_rules) = input.format_rules {
        serde_json::from_str::<serde_json::Value>(&format_rules)
            .map_err(|e| AppError::DataConversionError(format!("格式化规则JSON格式错误: {}", e)))?;
        active.format_rules = Set(Some(format_rules));
    }
    if let Some(is_default) = input.is_default {
        if is_default {
            ExportTemplate::update_many()
                .col_expr(export_template::Column::IsDefault, Expr::value(false))
                .exec(db)
                .await?;
        }
        active.is_default = Set(Some(is_default));
    }

    active.updated_at = Set(Some(chrono::Utc::now()));
    let result = active.update(db).await?;

    write_operation_log(
        "update",
        Some("export_template"),
        Some(result.id),
        Some(format!("更新导出模板: {} -> {}", old_name, result.name)),
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_export_template(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::export_template::Entity as ExportTemplate;
    use sea_orm::*;

    let db = get_db();
    let template = ExportTemplate::find_by_id(id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("导出模板不存在".to_string()))?;

    ExportTemplate::delete_by_id(id).exec(db).await?;

    write_operation_log(
        "delete",
        Some("export_template"),
        Some(id),
        Some(format!("删除导出模板: {}", template.name)),
    )
    .await;

    Ok(())
}

#[tauri::command]
pub async fn backup_database(
    app: tauri::AppHandle,
) -> Result<backup_service::BackupFileInfo, AppError> {
    backup_service::create_backup(&app).await
}

#[tauri::command]
pub async fn get_backups(
    app: tauri::AppHandle,
) -> Result<Vec<backup_service::BackupFileInfo>, AppError> {
    backup_service::get_backups(&app).await
}

#[tauri::command]
pub async fn restore_database(app: tauri::AppHandle, file_path: String) -> Result<(), AppError> {
    backup_service::restore_backup(&app, &file_path).await
}

#[tauri::command]
pub async fn delete_backup(app: tauri::AppHandle, file_path: String) -> Result<(), AppError> {
    backup_service::delete_backup(&app, &file_path).await?;
    write_operation_log(
        "delete_backup",
        Some("system"),
        None,
        Some(format!("删除备份文件: {}", file_path)),
    )
    .await;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sea_orm::{ActiveModelTrait, Set};
    use std::time::{SystemTime, UNIX_EPOCH};

    #[tokio::test]
    async fn export_template_e2e_flow_should_work() {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("系统时间异常")
            .as_millis();
        let work_dir = std::env::temp_dir().join(format!("spm_export_template_e2e_{}", ts));
        std::fs::create_dir_all(&work_dir).expect("创建临时目录失败");

        let db_path = work_dir.join("e2e.db");
        let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
        crate::db::init_database_for_test(&db_url)
            .await
            .expect("初始化测试数据库失败");

        let db = crate::db::get_db();

        let material = crate::models::material::ActiveModel {
            coil_id: Set(format!("E2E-COIL-{}", ts)),
            steel_grade: Set("SPHC".to_string()),
            thickness: Set(2.5),
            width: Set(1250.0),
            weight: Set(20.0),
            coiling_time: Set(chrono::Utc::now()),
            status: Set(Some("pending".to_string())),
            temp_status: Set(Some("ready".to_string())),
            ..Default::default()
        }
        .insert(db)
        .await
        .expect("写入测试材料失败");

        let plan = crate::models::schedule_plan::ActiveModel {
            plan_no: Set(format!("E2E-PLAN-{}", ts)),
            name: Set("E2E导出模板测试".to_string()),
            period_type: Set("daily".to_string()),
            start_date: Set("2026-02-13".to_string()),
            end_date: Set("2026-02-13".to_string()),
            status: Set(Some("draft".to_string())),
            total_count: Set(Some(1)),
            total_weight: Set(Some(20.0)),
            ..Default::default()
        }
        .insert(db)
        .await
        .expect("写入测试方案失败");

        crate::models::schedule_item::ActiveModel {
            plan_id: Set(plan.id),
            material_id: Set(material.id),
            sequence: Set(1),
            shift_date: Set("2026-02-13".to_string()),
            shift_no: Set(1),
            shift_type: Set("day".to_string()),
            planned_start: Set(Some("2026-02-13 08:00:00".to_string())),
            planned_end: Set(Some("2026-02-13 08:30:00".to_string())),
            cumulative_weight: Set(Some(20.0)),
            is_roll_change: Set(Some(false)),
            is_locked: Set(Some(false)),
            ..Default::default()
        }
        .insert(db)
        .await
        .expect("写入测试排程明细失败");

        let template_name = format!("E2E模板-{}", ts);
        let template = create_export_template(CreateExportTemplateInput {
            name: template_name.clone(),
            description: Some("端到端验证模板".to_string()),
            columns: r#"["sequence","coil_id","weight","shift_date"]"#.to_string(),
            format_rules: Some(r#"{"weight":{"digits":1,"suffix":"t"}}"#.to_string()),
            is_default: Some(false),
        })
        .await
        .expect("创建导出模板失败");
        assert_eq!(template.name, template_name);
        assert_eq!(template.is_default, Some(false));

        let updated = update_export_template(
            template.id,
            UpdateExportTemplateInput {
                name: None,
                description: None,
                columns: None,
                format_rules: None,
                is_default: Some(true),
            },
        )
        .await
        .expect("设为默认模板失败");
        assert_eq!(updated.is_default, Some(true));

        let csv_path = work_dir.join("e2e.csv");
        let csv_result = export_plan_csv(
            plan.id,
            csv_path.to_string_lossy().to_string(),
            Some(template.id),
        )
        .await
        .expect("按模板导出CSV失败");
        assert_eq!(csv_result.row_count, 1);
        let csv_content = std::fs::read_to_string(&csv_path).expect("读取CSV文件失败");
        let header = csv_content.lines().next().unwrap_or_default();
        let row = csv_content.lines().nth(1).unwrap_or_default();
        assert_eq!(header.split(',').count(), 4);
        assert!(header.contains("序号"));
        assert!(header.contains("钢卷号"));
        assert!(header.contains("重量(t)"));
        assert!(header.contains("班次日期"));
        assert!(row.contains("20.0t"));

        let xlsx_path = work_dir.join("e2e.xlsx");
        let excel_result = export_plan_excel(
            plan.id,
            xlsx_path.to_string_lossy().to_string(),
            Some(template.id),
        )
        .await
        .expect("按模板导出Excel失败");
        assert_eq!(excel_result.row_count, 1);
        assert!(xlsx_path.exists());

        delete_export_template(template.id)
            .await
            .expect("删除导出模板失败");
        let templates = get_export_templates().await.expect("查询模板列表失败");
        assert!(!templates.iter().any(|item| item.id == template.id));

        // 不删除包含测试数据库的目录。DB 连接为全局 OnceLock，后续测试仍可能复用该连接。
        let _ = std::fs::remove_file(&csv_path);
        let _ = std::fs::remove_file(&xlsx_path);
    }
}

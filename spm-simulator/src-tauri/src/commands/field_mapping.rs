use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateFieldMappingInput {
    pub template_name: String,
    pub source_type: String,
    pub mappings: String,
    pub value_transforms: Option<String>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateFieldMappingInput {
    pub template_name: Option<String>,
    pub source_type: Option<String>,
    pub mappings: Option<String>,
    pub value_transforms: Option<String>,
    pub is_default: Option<bool>,
}

/// 文件表头预览结果
#[derive(Debug, Serialize, Deserialize)]
pub struct FilePreviewResult {
    pub headers: Vec<String>,
    pub sample_rows: Vec<Vec<String>>,
    pub total_rows: usize,
}

#[tauri::command]
pub async fn get_field_mappings() -> Result<Vec<crate::models::field_mapping::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::field_mapping::Entity as Mapping;
    use sea_orm::*;

    let db = get_db();
    let mappings = Mapping::find()
        .order_by_desc(crate::models::field_mapping::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(mappings)
}

#[tauri::command]
pub async fn get_field_mapping(id: i32) -> Result<crate::models::field_mapping::Model, AppError> {
    use crate::db::get_db;
    use crate::models::field_mapping::Entity as Mapping;
    use sea_orm::*;

    let db = get_db();
    Mapping::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::FieldMappingMissing(format!("映射模板不存在: id={}", id)))
}

#[tauri::command]
pub async fn create_field_mapping(
    input: CreateFieldMappingInput,
) -> Result<crate::models::field_mapping::Model, AppError> {
    use crate::db::get_db;
    use crate::models::field_mapping;
    use sea_orm::*;

    // 验证 mappings 是合法 JSON
    serde_json::from_str::<serde_json::Value>(&input.mappings)
        .map_err(|e| AppError::DataConversionError(format!("映射配置JSON格式错误: {}", e)))?;

    if let Some(ref transforms) = input.value_transforms {
        serde_json::from_str::<serde_json::Value>(transforms)
            .map_err(|e| AppError::DataConversionError(format!("转换规则JSON格式错误: {}", e)))?;
    }

    let db = get_db();

    let mapping = field_mapping::ActiveModel {
        template_name: Set(input.template_name),
        source_type: Set(input.source_type),
        mappings: Set(input.mappings),
        value_transforms: Set(input.value_transforms),
        is_default: Set(input.is_default),
        ..Default::default()
    };

    let result = mapping.insert(db).await?;
    Ok(result)
}

#[tauri::command]
pub async fn update_field_mapping(
    id: i32,
    input: UpdateFieldMappingInput,
) -> Result<crate::models::field_mapping::Model, AppError> {
    use crate::db::get_db;
    use crate::models::field_mapping::Entity as Mapping;
    use sea_orm::*;

    let db = get_db();
    let mapping = Mapping::find_by_id(id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::FieldMappingMissing(format!("映射模板不存在: id={}", id)))?;

    let mut active: crate::models::field_mapping::ActiveModel = mapping.into();

    if let Some(name) = input.template_name {
        active.template_name = Set(name);
    }
    if let Some(source_type) = input.source_type {
        active.source_type = Set(source_type);
    }
    if let Some(mappings) = input.mappings {
        serde_json::from_str::<serde_json::Value>(&mappings)
            .map_err(|e| AppError::DataConversionError(format!("映射配置JSON格式错误: {}", e)))?;
        active.mappings = Set(mappings);
    }
    if let Some(transforms) = input.value_transforms {
        serde_json::from_str::<serde_json::Value>(&transforms)
            .map_err(|e| AppError::DataConversionError(format!("转换规则JSON格式错误: {}", e)))?;
        active.value_transforms = Set(Some(transforms));
    }
    if let Some(is_default) = input.is_default {
        active.is_default = Set(Some(is_default));
    }

    active.updated_at = Set(Some(chrono::Utc::now()));
    let result = active.update(db).await?;
    Ok(result)
}

#[tauri::command]
pub async fn delete_field_mapping(id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::field_mapping::Entity as Mapping;
    use sea_orm::*;

    let db = get_db();
    Mapping::delete_by_id(id).exec(db).await?;
    Ok(())
}

#[tauri::command]
pub async fn preview_file_headers(file_path: String) -> Result<FilePreviewResult, AppError> {
    use calamine::{open_workbook, Data, Reader, Xlsx};
    use std::path::Path;

    let path = Path::new(&file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    match ext.as_str() {
        "xlsx" | "xls" => {
            let mut workbook: Xlsx<_> = open_workbook(&file_path)
                .map_err(|e| AppError::FileFormatError(format!("无法打开Excel文件: {}", e)))?;

            let sheet_name =
                workbook.sheet_names().first().cloned().ok_or_else(|| {
                    AppError::FileFormatError("Excel文件中没有工作表".to_string())
                })?;

            let range = workbook
                .worksheet_range(&sheet_name)
                .map_err(|e| AppError::FileFormatError(format!("无法读取工作表: {}", e)))?;

            let rows: Vec<Vec<String>> = range
                .rows()
                .map(|row| {
                    row.iter()
                        .map(|cell| match cell {
                            Data::String(v) => v.clone(),
                            Data::Int(v) => v.to_string(),
                            Data::Float(v) => v.to_string(),
                            Data::Bool(v) => v.to_string(),
                            _ => String::new(),
                        })
                        .collect()
                })
                .collect();

            if rows.is_empty() {
                return Err(AppError::FileFormatError("文件为空".to_string()));
            }

            let headers = rows[0].clone();
            let sample_rows: Vec<Vec<String>> = rows[1..].iter().take(20).cloned().collect();
            let total_rows = if rows.len() > 1 { rows.len() - 1 } else { 0 };

            Ok(FilePreviewResult {
                headers,
                sample_rows,
                total_rows,
            })
        }
        "csv" => {
            let mut reader = csv::Reader::from_path(&file_path)
                .map_err(|e| AppError::FileFormatError(format!("无法打开CSV文件: {}", e)))?;

            let headers: Vec<String> = reader
                .headers()
                .map_err(|e| AppError::FileFormatError(format!("无法读取CSV表头: {}", e)))?
                .iter()
                .map(|h| h.to_string())
                .collect();

            let mut sample_rows = Vec::new();
            let mut total_rows = 0usize;
            for r in reader.records().flatten() {
                total_rows += 1;
                if sample_rows.len() < 20 {
                    sample_rows.push(r.iter().map(|f| f.to_string()).collect());
                }
            }

            Ok(FilePreviewResult {
                headers,
                sample_rows,
                total_rows,
            })
        }
        _ => Err(AppError::FileFormatError(format!(
            "不支持的文件格式: .{}",
            ext
        ))),
    }
}

use crate::utils::datetime::MIDNIGHT;
use calamine::{open_workbook, Data, Reader, Xlsx};
use chrono::{NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

use crate::db::get_db;
use crate::models::{field_mapping, import_batch, material};
use crate::utils::temperature::calculate_temp_status;
use crate::AppError;

/// 字段映射定义：从源列名 → 目标字段名
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldMappingItem {
    /// 源文件中的列名
    pub source_field: String,
    /// 目标数据库字段名
    pub target_field: String,
    /// 映射类型: direct, calculate, transform, date, default, combine
    pub mapping_type: String,
    /// 默认值（mapping_type 为 default 时使用）
    pub default_value: Option<String>,
    /// 转换规则（mapping_type 为 transform 时使用）
    pub transform_rule: Option<String>,
    /// 日期源格式（mapping_type 为 date 时可选）
    pub source_format: Option<String>,
}

/// 值转换规则
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValueTransformRule {
    pub field: String,
    /// 值映射表，如 {"是": "true", "否": "false"}
    pub value_map: Option<HashMap<String, String>>,
    /// 数据类型: string, number, boolean, date
    pub data_type: Option<String>,
}

/// 导入服务上下文
pub struct ImportContext {
    pub mappings: Vec<FieldMappingItem>,
    pub transforms: Vec<ValueTransformRule>,
    pub header_index: HashMap<String, usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportTestRow {
    pub line_no: usize,
    pub status: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportTestResult {
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub errors: Vec<String>,
    pub rows: Vec<ImportTestRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportSummary {
    pub batch_id: i32,
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub skipped: usize,
    pub overwritten: usize,
    pub errors: Vec<String>,
}

/// 导入文件大小上限（50 MB）
const MAX_IMPORT_FILE_SIZE: u64 = 50 * 1024 * 1024;
/// 导入数据行数上限（不含表头）
const MAX_IMPORT_ROW_COUNT: usize = 50_000;

/// 检查文件大小是否超过限制
fn check_file_size(file_path: &str) -> Result<(), AppError> {
    let metadata = std::fs::metadata(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法读取文件信息: {}", e)))?;
    if metadata.len() > MAX_IMPORT_FILE_SIZE {
        return Err(AppError::FileFormatError(format!(
            "文件大小 ({:.1} MB) 超过上限 ({} MB)，请拆分后重试",
            metadata.len() as f64 / 1024.0 / 1024.0,
            MAX_IMPORT_FILE_SIZE / 1024 / 1024
        )));
    }
    Ok(())
}

/// 检查数据行数是否超过限制
fn check_row_count(row_count: usize) -> Result<(), AppError> {
    if row_count > MAX_IMPORT_ROW_COUNT {
        return Err(AppError::FileFormatError(format!(
            "数据行数 ({}) 超过上限 ({})，请拆分后重试",
            row_count, MAX_IMPORT_ROW_COUNT
        )));
    }
    Ok(())
}

/// 从 Excel 文件读取数据
pub async fn import_from_excel(
    file_path: &str,
    mapping_id: Option<i32>,
    conflict_mode: &str,
) -> Result<ImportSummary, AppError> {
    check_file_size(file_path)?;

    // 提取文件名
    let file_name = Path::new(file_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // 生成批次号并创建批次记录
    let batch_id = create_import_batch(&file_name, conflict_mode).await?;

    let path = Path::new(file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let result = match ext.as_str() {
        "xlsx" | "xls" => {
            import_excel_with_batch(file_path, mapping_id, conflict_mode, batch_id).await
        }
        "csv" => import_csv_with_batch(file_path, mapping_id, conflict_mode, batch_id).await,
        _ => Err(AppError::FileFormatError(format!(
            "不支持的文件格式: .{}，请使用 .xlsx、.xls 或 .csv 文件",
            ext
        ))),
    };

    // 更新批次统计
    match &result {
        Ok(summary) => {
            update_import_batch(batch_id, summary).await.ok();
        }
        Err(_) => {
            // 导入失败，标记批次为 deleted
            let db = get_db();
            use sea_orm::prelude::Expr;
            import_batch::Entity::update_many()
                .col_expr(import_batch::Column::Status, Expr::value("deleted"))
                .filter(import_batch::Column::Id.eq(batch_id))
                .exec(db)
                .await
                .ok();
        }
    }

    result
}

pub async fn test_import_from_file(
    file_path: &str,
    mapping_id: Option<i32>,
    mappings_override: Option<&str>,
    transforms_override: Option<&str>,
    sample_limit: Option<usize>,
) -> Result<ImportTestResult, AppError> {
    check_file_size(file_path)?;
    let path = Path::new(file_path);
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let (headers, data_rows) = match ext.as_str() {
        "xlsx" | "xls" => read_excel_rows(file_path)?,
        "csv" => read_csv_rows(file_path)?,
        _ => {
            return Err(AppError::FileFormatError(format!(
                "不支持的文件格式: .{}，请使用 .xlsx、.xls 或 .csv 文件",
                ext
            )))
        }
    };

    let context =
        build_import_context(&headers, mapping_id, mappings_override, transforms_override).await?;

    let limit = sample_limit.unwrap_or(20).clamp(1, 200);
    Ok(process_rows_dry_run(&data_rows, &context, limit))
}

fn read_excel_rows(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>), AppError> {
    let mut workbook: Xlsx<_> = open_workbook(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法打开Excel文件: {}", e)))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| AppError::FileFormatError("Excel文件中没有工作表".to_string()))?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| AppError::FileFormatError(format!("无法读取工作表: {}", e)))?;

    let rows: Vec<Vec<String>> = range
        .rows()
        .map(|row| row.iter().map(cell_to_string).collect())
        .collect();

    if rows.is_empty() {
        return Err(AppError::FileFormatError("Excel文件为空".to_string()));
    }

    let headers = rows[0].clone();
    let data_rows = rows[1..].to_vec();
    check_row_count(data_rows.len())?;
    Ok((headers, data_rows))
}

fn read_csv_rows(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>), AppError> {
    let mut reader = csv::Reader::from_path(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法打开CSV文件: {}", e)))?;

    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::FileFormatError(format!("无法读取CSV表头: {}", e)))?
        .iter()
        .map(|h| h.to_string())
        .collect();

    if headers.is_empty() {
        return Err(AppError::FileFormatError("CSV文件为空".to_string()));
    }

    let data_rows: Vec<Vec<String>> = reader
        .records()
        .filter_map(|r| r.ok())
        .map(|record| record.iter().map(|f| f.to_string()).collect())
        .collect();

    check_row_count(data_rows.len())?;
    Ok((headers, data_rows))
}

/// Excel 文件导入
async fn import_excel_with_batch(
    file_path: &str,
    mapping_id: Option<i32>,
    conflict_mode: &str,
    batch_id: i32,
) -> Result<ImportSummary, AppError> {
    let mut workbook: Xlsx<_> = open_workbook(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法打开Excel文件: {}", e)))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| AppError::FileFormatError("Excel文件中没有工作表".to_string()))?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| AppError::FileFormatError(format!("无法读取工作表: {}", e)))?;

    let rows: Vec<Vec<String>> = range
        .rows()
        .map(|row| row.iter().map(cell_to_string).collect())
        .collect();

    if rows.is_empty() {
        return Err(AppError::FileFormatError("Excel文件为空".to_string()));
    }

    let headers = &rows[0];
    let data_rows = &rows[1..];

    let context = build_import_context(headers, mapping_id, None, None).await?;

    process_rows(data_rows, &context, conflict_mode, batch_id).await
}

/// CSV 文件导入
async fn import_csv_with_batch(
    file_path: &str,
    mapping_id: Option<i32>,
    conflict_mode: &str,
    batch_id: i32,
) -> Result<ImportSummary, AppError> {
    let mut reader = csv::Reader::from_path(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法打开CSV文件: {}", e)))?;

    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::FileFormatError(format!("无法读取CSV表头: {}", e)))?
        .iter()
        .map(|h| h.to_string())
        .collect();

    let data_rows: Vec<Vec<String>> = reader
        .records()
        .filter_map(|r| r.ok())
        .map(|record| record.iter().map(|f| f.to_string()).collect())
        .collect();

    if headers.is_empty() {
        return Err(AppError::FileFormatError("CSV文件为空".to_string()));
    }

    let context = build_import_context(&headers, mapping_id, None, None).await?;

    process_rows(&data_rows, &context, conflict_mode, batch_id).await
}

/// 构建导入上下文（解析映射配置）
async fn build_import_context(
    headers: &[String],
    mapping_id: Option<i32>,
    mappings_override: Option<&str>,
    transforms_override: Option<&str>,
) -> Result<ImportContext, AppError> {
    let db = get_db();

    // 获取映射配置
    let (mappings, mut transforms) = if let Some(raw_mappings) = mappings_override {
        let m: Vec<FieldMappingItem> = serde_json::from_str(raw_mappings)
            .map_err(|e| AppError::DataConversionError(format!("映射配置解析失败: {}", e)))?;
        let t: Vec<ValueTransformRule> = if let Some(raw_transforms) = transforms_override {
            serde_json::from_str(raw_transforms)
                .map_err(|e| AppError::DataConversionError(format!("转换规则解析失败: {}", e)))?
        } else {
            vec![]
        };
        (m, t)
    } else if let Some(id) = mapping_id {
        let mapping = field_mapping::Entity::find_by_id(id)
            .one(db)
            .await?
            .ok_or_else(|| AppError::FieldMappingMissing(format!("映射模板不存在: id={}", id)))?;

        let m: Vec<FieldMappingItem> = serde_json::from_str(&mapping.mappings)
            .map_err(|e| AppError::DataConversionError(format!("映射配置解析失败: {}", e)))?;

        let t: Vec<ValueTransformRule> = if let Some(raw_transforms) = transforms_override {
            serde_json::from_str(raw_transforms)
                .map_err(|e| AppError::DataConversionError(format!("转换规则解析失败: {}", e)))?
        } else if let Some(ref transforms_str) = mapping.value_transforms {
            serde_json::from_str(transforms_str).unwrap_or_default()
        } else {
            vec![]
        };

        (m, t)
    } else {
        // 使用默认映射（列名直接对应字段名）
        (build_default_mappings(headers), vec![])
    };

    // 构建列名→索引映射
    let mut header_index = HashMap::new();
    for (i, h) in headers.iter().enumerate() {
        header_index.insert(h.trim().to_string(), i);
    }

    merge_inline_transform_rules(&mappings, &mut transforms);

    Ok(ImportContext {
        mappings,
        transforms,
        header_index,
    })
}

/// 默认映射：源列名直接映射到同名目标字段
fn build_default_mappings(headers: &[String]) -> Vec<FieldMappingItem> {
    // 列名 → 数据库字段名 的默认映射表
    let alias_map: HashMap<&str, &str> = HashMap::from([
        // 中文列名映射
        ("钢卷号", "coil_id"),
        ("合同号", "contract_no"),
        ("客户名称", "customer_name"),
        ("客户代码", "customer_code"),
        ("钢种", "steel_grade"),
        ("厚度", "thickness"),
        ("宽度", "width"),
        ("重量", "weight"),
        ("硬度等级", "hardness_level"),
        ("表面等级", "surface_level"),
        ("粗糙度要求", "roughness_req"),
        ("延伸率要求", "elongation_req"),
        ("产品大类", "product_type"),
        ("合同属性", "contract_attr"),
        ("合同性质", "contract_nature"),
        ("出口标志", "export_flag"),
        ("周交期", "weekly_delivery"),
        ("集批代码", "batch_code"),
        ("卷取时间", "coiling_time"),
        ("库龄", "storage_days"),
        ("库位", "storage_loc"),
        ("交期", "due_date"),
        ("备注", "remarks"),
        // 英文列名映射
        ("coil_id", "coil_id"),
        ("contract_no", "contract_no"),
        ("customer_name", "customer_name"),
        ("customer_code", "customer_code"),
        ("steel_grade", "steel_grade"),
        ("thickness", "thickness"),
        ("width", "width"),
        ("weight", "weight"),
        ("hardness_level", "hardness_level"),
        ("surface_level", "surface_level"),
        ("roughness_req", "roughness_req"),
        ("elongation_req", "elongation_req"),
        ("product_type", "product_type"),
        ("contract_attr", "contract_attr"),
        ("contract_nature", "contract_nature"),
        ("export_flag", "export_flag"),
        ("weekly_delivery", "weekly_delivery"),
        ("batch_code", "batch_code"),
        ("coiling_time", "coiling_time"),
        ("storage_days", "storage_days"),
        ("storage_loc", "storage_loc"),
        ("due_date", "due_date"),
        ("remarks", "remarks"),
    ]);

    headers
        .iter()
        .filter_map(|h| {
            let trimmed = h.trim();
            alias_map.get(trimmed).map(|target| FieldMappingItem {
                source_field: trimmed.to_string(),
                target_field: ToString::to_string(target),
                mapping_type: "direct".to_string(),
                default_value: None,
                transform_rule: None,
                source_format: None,
            })
        })
        .collect()
}

/// 处理数据行，批量插入数据库
async fn process_rows(
    rows: &[Vec<String>],
    context: &ImportContext,
    conflict_mode: &str,
    batch_id: i32,
) -> Result<ImportSummary, AppError> {
    let db = get_db();
    let total = rows.len();
    let mut success = 0usize;
    let mut skipped = 0usize;
    let mut overwritten = 0usize;
    let mut errors = Vec::new();

    for (row_idx, row) in rows.iter().enumerate() {
        let line_no = row_idx + 2; // 数据从第2行开始（第1行是表头）

        match build_material_model(row, context, line_no) {
            Ok(mut active_model) => {
                // 设置批次 ID
                active_model.import_batch_id = Set(Some(batch_id));

                match active_model.insert(db).await {
                    Ok(_) => {
                        success += 1;
                    }
                    Err(e) => {
                        let err_str = e.to_string();
                        let is_unique_conflict = err_str.contains("UNIQUE")
                            || err_str.contains("unique")
                            || err_str.contains("duplicate");

                        if is_unique_conflict {
                            match conflict_mode {
                                "skip" => {
                                    skipped += 1;
                                }
                                "overwrite" => {
                                    // 提取 coil_id 值
                                    let coil_id = extract_coil_id(row, context);
                                    match coil_id {
                                        Some(cid) => {
                                            match overwrite_material(
                                                db, &cid, row, context, line_no, batch_id,
                                            )
                                            .await
                                            {
                                                Ok(_) => {
                                                    overwritten += 1;
                                                }
                                                Err(oe) => {
                                                    let msg = format!(
                                                        "第{}行覆盖更新失败: {}",
                                                        line_no, oe
                                                    );
                                                    log::warn!("{}", msg);
                                                    errors.push(msg);
                                                }
                                            }
                                        }
                                        None => {
                                            let msg =
                                                format!("第{}行覆盖失败: 无法提取coil_id", line_no);
                                            log::warn!("{}", msg);
                                            errors.push(msg);
                                        }
                                    }
                                }
                                _ => {
                                    skipped += 1;
                                }
                            }
                        } else {
                            let msg = format!("第{}行插入失败: {}", line_no, e);
                            log::warn!("{}", msg);
                            errors.push(msg);
                        }
                    }
                }
            }
            Err(e) => {
                let msg = format!("第{}行数据转换失败: {}", line_no, e);
                log::warn!("{}", msg);
                errors.push(msg);
            }
        }
    }

    let failed = total - success - skipped - overwritten;
    log::info!(
        "导入完成: 总计={}, 成功={}, 跳过={}, 覆盖={}, 失败={}",
        total,
        success,
        skipped,
        overwritten,
        failed
    );

    Ok(ImportSummary {
        batch_id,
        total,
        success,
        failed,
        skipped,
        overwritten,
        errors,
    })
}

fn process_rows_dry_run(
    rows: &[Vec<String>],
    context: &ImportContext,
    sample_limit: usize,
) -> ImportTestResult {
    let total = rows.len();
    let mut success = 0usize;
    let mut errors = Vec::new();
    let mut preview_rows = Vec::new();

    for (row_idx, row) in rows.iter().enumerate() {
        let line_no = row_idx + 2;
        match build_material_model(row, context, line_no) {
            Ok(_) => {
                success += 1;
                if preview_rows.len() < sample_limit {
                    preview_rows.push(ImportTestRow {
                        line_no,
                        status: "ok".to_string(),
                        message: "校验通过".to_string(),
                    });
                }
            }
            Err(err) => {
                let msg = format!("第{}行数据转换失败: {}", line_no, err);
                if errors.len() < 500 {
                    errors.push(msg.clone());
                }
                if preview_rows.len() < sample_limit {
                    preview_rows.push(ImportTestRow {
                        line_no,
                        status: "error".to_string(),
                        message: err,
                    });
                }
            }
        }
    }

    let failed = total - success;
    ImportTestResult {
        total,
        success,
        failed,
        errors,
        rows: preview_rows,
    }
}

// ─── 批次管理辅助函数 ───

/// 创建导入批次记录，返回 batch_id
async fn create_import_batch(file_name: &str, conflict_mode: &str) -> Result<i32, AppError> {
    let db = get_db();
    let today = Utc::now().format("%Y%m%d").to_string();
    let prefix = format!("IMP-{}-", today);

    // 查询当日最大序号
    let existing = import_batch::Entity::find()
        .filter(import_batch::Column::BatchNo.starts_with(&prefix))
        .order_by_desc(import_batch::Column::BatchNo)
        .one(db)
        .await?;

    let seq = existing
        .and_then(|b| {
            b.batch_no
                .strip_prefix(&prefix)
                .and_then(|s| s.parse::<i32>().ok())
        })
        .unwrap_or(0)
        + 1;

    let batch_no = format!("{}{:03}", prefix, seq);

    let batch = import_batch::ActiveModel {
        batch_no: Set(batch_no),
        file_name: Set(file_name.to_string()),
        conflict_mode: Set(conflict_mode.to_string()),
        status: Set(Some("active".to_string())),
        ..Default::default()
    };

    let inserted = batch
        .insert(db)
        .await
        .map_err(|e| AppError::Internal(format!("创建导入批次失败: {}", e)))?;

    Ok(inserted.id)
}

/// 更新导入批次的统计字段
async fn update_import_batch(batch_id: i32, summary: &ImportSummary) -> Result<(), AppError> {
    use sea_orm::prelude::Expr;

    let db = get_db();
    import_batch::Entity::update_many()
        .col_expr(
            import_batch::Column::TotalCount,
            Expr::value(summary.total as i32),
        )
        .col_expr(
            import_batch::Column::SuccessCount,
            Expr::value(summary.success as i32),
        )
        .col_expr(
            import_batch::Column::FailedCount,
            Expr::value(summary.failed as i32),
        )
        .col_expr(
            import_batch::Column::SkippedCount,
            Expr::value(summary.skipped as i32),
        )
        .col_expr(
            import_batch::Column::OverwrittenCount,
            Expr::value(summary.overwritten as i32),
        )
        .filter(import_batch::Column::Id.eq(batch_id))
        .exec(db)
        .await?;
    Ok(())
}

/// 从行数据中提取 coil_id 值
fn extract_coil_id(row: &[String], context: &ImportContext) -> Option<String> {
    for mapping in &context.mappings {
        if mapping.target_field == "coil_id" {
            if let Some(&col_idx) = context.header_index.get(&mapping.source_field) {
                if col_idx < row.len() {
                    let val = row[col_idx].trim().to_string();
                    if !val.is_empty() {
                        return Some(val);
                    }
                }
            }
        }
    }
    None
}

/// 覆盖更新已存在的材料记录（保留 id、status、priority 等字段）
async fn overwrite_material(
    db: &sea_orm::DatabaseConnection,
    coil_id: &str,
    row: &[String],
    context: &ImportContext,
    line_no: usize,
    batch_id: i32,
) -> Result<(), String> {
    use sea_orm::*;

    // 查找已有记录
    let existing = material::Entity::find()
        .filter(material::Column::CoilId.eq(coil_id))
        .one(db)
        .await
        .map_err(|e| format!("查询已有记录失败: {}", e))?
        .ok_or_else(|| format!("未找到 coil_id={} 的记录", coil_id))?;

    // 构建新的字段值
    let new_model = build_material_model(row, context, line_no)?;

    // 使用已有记录的 id 构建更新模型，只更新物理属性和客户信息
    let mut update_model = material::ActiveModel {
        id: Set(existing.id),
        ..Default::default()
    };

    // 更新物理属性
    update_model.steel_grade = new_model.steel_grade.clone();
    update_model.thickness = new_model.thickness.clone();
    update_model.width = new_model.width.clone();
    update_model.weight = new_model.weight.clone();
    update_model.coil_id = Set(coil_id.to_string());
    update_model.coiling_time = new_model.coiling_time.clone();

    // 更新可选物理属性
    update_model.hardness_level = new_model.hardness_level.clone();
    update_model.surface_level = new_model.surface_level.clone();
    update_model.roughness_req = new_model.roughness_req.clone();
    update_model.elongation_req = new_model.elongation_req.clone();
    update_model.product_type = new_model.product_type.clone();

    // 更新客户/合同信息
    update_model.contract_no = new_model.contract_no.clone();
    update_model.customer_name = new_model.customer_name.clone();
    update_model.customer_code = new_model.customer_code.clone();
    update_model.contract_attr = new_model.contract_attr.clone();
    update_model.contract_nature = new_model.contract_nature.clone();
    update_model.export_flag = new_model.export_flag.clone();
    update_model.weekly_delivery = new_model.weekly_delivery.clone();
    update_model.batch_code = new_model.batch_code.clone();

    // 更新时间和元数据
    update_model.due_date = new_model.due_date.clone();
    update_model.storage_days = new_model.storage_days.clone();
    update_model.storage_loc = new_model.storage_loc.clone();
    update_model.temp_status = new_model.temp_status.clone();
    update_model.temp_wait_days = new_model.temp_wait_days.clone();
    update_model.is_tempered = new_model.is_tempered.clone();
    update_model.tempered_at = new_model.tempered_at.clone();
    update_model.remarks = new_model.remarks.clone();

    // 更新批次 ID 和时间戳
    update_model.import_batch_id = Set(Some(batch_id));
    update_model.updated_at = Set(Some(Utc::now()));

    // 注意：不更新 status, priority_*, 保留原有排程状态和手工优先级

    update_model
        .update(db)
        .await
        .map_err(|e| format!("更新记录失败: {}", e))?;

    Ok(())
}

/// 根据映射规则，将一行数据构建为 Material ActiveModel
fn build_material_model(
    row: &[String],
    context: &ImportContext,
    line_no: usize,
) -> Result<material::ActiveModel, String> {
    let mut fields: HashMap<String, String> = HashMap::new();

    for mapping in &context.mappings {
        let value = match mapping.mapping_type.as_str() {
            "direct" => Ok({
                let raw = resolve_source_value(row, context, &mapping.source_field);
                if raw.is_empty() {
                    mapping.default_value.clone().unwrap_or_default()
                } else {
                    raw
                }
            }),
            "default" => Ok(mapping.default_value.clone().unwrap_or_default()),
            "transform" => Ok({
                let raw = resolve_source_value(row, context, &mapping.source_field);
                apply_transform(&raw, &mapping.target_field, &context.transforms)
            }),
            "date" => {
                let raw = resolve_source_value(row, context, &mapping.source_field);
                apply_date_format(
                    &raw,
                    mapping.source_format.as_deref(),
                    line_no,
                    &mapping.source_field,
                )
            }
            "calculate" => {
                let raw = resolve_source_value(row, context, &mapping.source_field);
                apply_calculate(
                    &raw,
                    mapping.transform_rule.as_deref(),
                    line_no,
                    &mapping.source_field,
                )
            }
            "combine" => Ok(apply_combine(row, context, mapping)),
            _ => Ok({
                let raw = resolve_source_value(row, context, &mapping.source_field);
                if raw.is_empty() {
                    mapping.default_value.clone().unwrap_or_default()
                } else {
                    raw
                }
            }),
        }?;

        if !value.is_empty() {
            fields.insert(mapping.target_field.clone(), value);
        }
    }

    // 必填字段校验
    let coil_id = fields
        .get("coil_id")
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("第{}行: 缺少钢卷号(coil_id)", line_no))?
        .clone();

    let steel_grade = fields
        .get("steel_grade")
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("第{}行: 缺少钢种(steel_grade)", line_no))?
        .clone();

    let thickness = parse_f64(fields.get("thickness"), "thickness", line_no)?;
    let width = parse_f64(fields.get("width"), "width", line_no)?;
    let weight = parse_f64(fields.get("weight"), "weight", line_no)?;

    let coiling_time_str = fields
        .get("coiling_time")
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("第{}行: 缺少卷取时间(coiling_time)", line_no))?;

    let coiling_time = parse_datetime_to_utc(coiling_time_str)
        .ok_or_else(|| format!("第{}行: 卷取时间格式无效: {}", line_no, coiling_time_str))?;

    // 计算适温状态
    let (temp_status, temp_wait_days) = calculate_temp_status(&coiling_time);
    let is_tempered = temp_status == "ready";

    // 可选字段
    let due_date = fields
        .get("due_date")
        .and_then(|v| parse_datetime_to_utc(v));

    let elongation_req = fields
        .get("elongation_req")
        .and_then(|v| v.parse::<f64>().ok());

    let storage_days = fields
        .get("storage_days")
        .and_then(|v| v.parse::<i32>().ok());

    let export_flag = fields.get("export_flag").map(|v| parse_bool(v));

    let weekly_delivery = fields.get("weekly_delivery").map(|v| parse_bool(v));

    let model = material::ActiveModel {
        coil_id: Set(coil_id),
        contract_no: Set(fields.get("contract_no").cloned()),
        customer_name: Set(fields.get("customer_name").cloned()),
        customer_code: Set(fields.get("customer_code").cloned()),
        steel_grade: Set(steel_grade),
        thickness: Set(thickness),
        width: Set(width),
        weight: Set(weight),
        hardness_level: Set(fields.get("hardness_level").cloned()),
        surface_level: Set(fields.get("surface_level").cloned()),
        roughness_req: Set(fields.get("roughness_req").cloned()),
        elongation_req: Set(elongation_req),
        product_type: Set(fields.get("product_type").cloned()),
        contract_attr: Set(fields.get("contract_attr").cloned()),
        contract_nature: Set(fields.get("contract_nature").cloned()),
        export_flag: Set(export_flag),
        weekly_delivery: Set(weekly_delivery),
        batch_code: Set(fields.get("batch_code").cloned()),
        coiling_time: Set(coiling_time),
        temp_status: Set(Some(temp_status)),
        temp_wait_days: Set(Some(temp_wait_days)),
        is_tempered: Set(Some(is_tempered)),
        storage_days: Set(storage_days),
        storage_loc: Set(fields.get("storage_loc").cloned()),
        due_date: Set(due_date),
        status: Set(Some("pending".to_string())),
        priority_auto: Set(Some(0)),
        priority_manual_adjust: Set(Some(0)),
        priority_final: Set(Some(0)),
        remarks: Set(fields.get("remarks").cloned()),
        ..Default::default()
    };

    Ok(model)
}

/// 应用值转换规则
fn apply_transform(raw: &str, target_field: &str, transforms: &[ValueTransformRule]) -> String {
    let raw_trimmed = raw.trim();
    if let Some(rule) = transforms.iter().find(|t| t.field == target_field) {
        if let Some(ref value_map) = rule.value_map {
            if let Some(mapped) = value_map.get(raw_trimmed).or_else(|| value_map.get(raw)) {
                return mapped.clone();
            }
        }
    }
    raw.to_string()
}

fn merge_inline_transform_rules(
    mappings: &[FieldMappingItem],
    transforms: &mut Vec<ValueTransformRule>,
) {
    for mapping in mappings {
        if mapping.mapping_type != "transform" {
            continue;
        }
        let target_field = mapping.target_field.trim();
        if target_field.is_empty() {
            continue;
        }
        let Some(rule_text) = mapping.transform_rule.as_deref() else {
            continue;
        };
        let Some(value_map) = parse_transform_rule_value_map(rule_text) else {
            continue;
        };

        if let Some(existing) = transforms
            .iter_mut()
            .find(|item| item.field == target_field)
        {
            existing.value_map = Some(value_map);
        } else {
            transforms.push(ValueTransformRule {
                field: target_field.to_string(),
                value_map: Some(value_map),
                data_type: Some("string".to_string()),
            });
        }
    }
}

fn parse_transform_rule_value_map(rule_text: &str) -> Option<HashMap<String, String>> {
    let trimmed = rule_text.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Some(map) = builtin_transform_rule_map(trimmed) {
        return Some(map);
    }

    if trimmed.starts_with('{') && trimmed.ends_with('}') {
        if let Ok(json_value) = serde_json::from_str::<serde_json::Value>(trimmed) {
            if let Some(obj) = json_value.as_object() {
                let mut map = HashMap::new();
                for (k, v) in obj {
                    if let Some(s) = v.as_str() {
                        map.insert(strip_wrapped_quotes(k), strip_wrapped_quotes(s));
                    } else if v.is_boolean() || v.is_number() {
                        map.insert(strip_wrapped_quotes(k), v.to_string());
                    }
                }
                if !map.is_empty() {
                    return Some(map);
                }
            }
        }
    }

    let mut pair_map = HashMap::new();
    for segment in trimmed.split([',', ';', '，', '；', '\n']) {
        let seg_trimmed = segment.trim();
        if seg_trimmed.is_empty() {
            continue;
        }
        let Some((key, value)) = split_transform_pair(seg_trimmed) else {
            continue;
        };
        if key.is_empty() {
            continue;
        }
        pair_map.insert(key, value);
    }
    if pair_map.is_empty() {
        None
    } else {
        Some(pair_map)
    }
}

fn split_transform_pair(segment: &str) -> Option<(String, String)> {
    let splitter = if segment.contains("=>") {
        "=>"
    } else if segment.contains(':') {
        ":"
    } else if segment.contains('=') {
        "="
    } else {
        return None;
    };
    let (left, right) = segment.split_once(splitter)?;
    Some((strip_wrapped_quotes(left), strip_wrapped_quotes(right)))
}

fn strip_wrapped_quotes(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.len() >= 2 {
        let first = trimmed.chars().next().unwrap_or_default();
        let last = trimmed.chars().last().unwrap_or_default();
        if (first == '"' && last == '"') || (first == '\'' && last == '\'') {
            return trimmed[1..trimmed.len() - 1].trim().to_string();
        }
    }
    trimmed.to_string()
}

fn builtin_transform_rule_map(rule_text: &str) -> Option<HashMap<String, String>> {
    let key = rule_text.trim().to_lowercase();
    match key.as_str() {
        "bool_yn" | "bool_yes_no" | "yn_bool" | "boolean_cn" => Some(HashMap::from([
            ("是".to_string(), "true".to_string()),
            ("否".to_string(), "false".to_string()),
            ("Y".to_string(), "true".to_string()),
            ("N".to_string(), "false".to_string()),
            ("y".to_string(), "true".to_string()),
            ("n".to_string(), "false".to_string()),
            ("yes".to_string(), "true".to_string()),
            ("no".to_string(), "false".to_string()),
            ("true".to_string(), "true".to_string()),
            ("false".to_string(), "false".to_string()),
            ("1".to_string(), "true".to_string()),
            ("0".to_string(), "false".to_string()),
        ])),
        "temp_status_cn" | "temp_status" => Some(HashMap::from([
            ("适温".to_string(), "ready".to_string()),
            ("待温".to_string(), "waiting".to_string()),
            ("ready".to_string(), "ready".to_string()),
            ("waiting".to_string(), "waiting".to_string()),
        ])),
        _ => None,
    }
}

fn resolve_source_value(row: &[String], context: &ImportContext, source_field: &str) -> String {
    if let Some(&idx) = context.header_index.get(source_field.trim()) {
        row.get(idx).cloned().unwrap_or_default()
    } else {
        String::new()
    }
}

fn format_calculate_number(value: f64) -> String {
    if (value.fract()).abs() < 1e-9 {
        format!("{:.0}", value)
    } else {
        value.to_string()
    }
}

fn apply_calculate(
    raw: &str,
    rule: Option<&str>,
    line_no: usize,
    source_field: &str,
) -> Result<String, String> {
    let raw_trimmed = raw.trim();
    if raw_trimmed.is_empty() {
        return Ok(String::new());
    }

    let base = raw_trimmed.parse::<f64>().map_err(|_| {
        format!(
            "第{}行: 计算映射字段 {} 的源值不是数字: {}",
            line_no, source_field, raw_trimmed
        )
    })?;

    let Some(rule_str) = rule else {
        return Ok(format_calculate_number(base));
    };
    let compact = rule_str.trim().replace(' ', "");
    if compact.is_empty() {
        return Ok(format_calculate_number(base));
    }

    let (op, operand_str) = if ["/", "*", "+", "-"].iter().any(|p| compact.starts_with(p)) {
        (compact.chars().next().unwrap_or('/'), &compact[1..])
    } else {
        let mut found: Option<(char, usize)> = None;
        for candidate in ['/', '*', '+', '-'] {
            if let Some(pos) = compact.find(candidate) {
                if pos > 0 {
                    found = Some((candidate, pos));
                    break;
                }
            }
        }
        let (operator, pos) = found.ok_or_else(|| {
            format!(
                "第{}行: calculate 规则格式错误: {}，示例: /1000 或 x*1.1",
                line_no, rule_str
            )
        })?;
        let left = compact[..pos].to_lowercase();
        if left != "x" && left != "value" && left != "raw" {
            return Err(format!(
                "第{}行: calculate 规则左值仅支持 x/value/raw: {}",
                line_no, rule_str
            ));
        }
        (operator, &compact[pos + 1..])
    };

    let operand = operand_str
        .parse::<f64>()
        .map_err(|_| format!("第{}行: calculate 规则参数不是数字: {}", line_no, rule_str))?;

    let result = match op {
        '/' => {
            if operand.abs() < f64::EPSILON {
                return Err(format!("第{}行: calculate 除数不能为0", line_no));
            }
            base / operand
        }
        '*' => base * operand,
        '+' => base + operand,
        '-' => base - operand,
        _ => {
            return Err(format!("第{}行: calculate 不支持的运算符: {}", line_no, op));
        }
    };

    if !result.is_finite() {
        return Err(format!("第{}行: calculate 结果无效: {}", line_no, rule_str));
    }

    Ok(format_calculate_number(result))
}

fn split_combine_items(input: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut quote: Option<char> = None;

    for ch in input.chars() {
        match (quote, ch) {
            (Some(q), c) if c == q => {
                quote = None;
                current.push(c);
            }
            (Some(_), c) => current.push(c),
            (None, '"' | '\'') => {
                quote = Some(ch);
                current.push(ch);
            }
            (None, ',') => {
                if !current.trim().is_empty() {
                    result.push(current.trim().to_string());
                }
                current.clear();
            }
            (None, c) => current.push(c),
        }
    }
    if !current.trim().is_empty() {
        result.push(current.trim().to_string());
    }

    result
}

fn read_combine_token(row: &[String], context: &ImportContext, token: &str) -> String {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return String::new();
    }

    if (trimmed.starts_with('\'') && trimmed.ends_with('\''))
        || (trimmed.starts_with('"') && trimmed.ends_with('"'))
    {
        return trimmed[1..trimmed.len() - 1].to_string();
    }

    if trimmed.starts_with('{') && trimmed.ends_with('}') && trimmed.len() >= 3 {
        let field = &trimmed[1..trimmed.len() - 1];
        return resolve_source_value(row, context, field);
    }

    resolve_source_value(row, context, trimmed)
}

fn apply_combine_template(rule: &str, row: &[String], context: &ImportContext) -> String {
    let mut output = String::new();
    let chars: Vec<char> = rule.chars().collect();
    let mut i = 0usize;

    while i < chars.len() {
        if chars[i] == '{' {
            let mut j = i + 1;
            while j < chars.len() && chars[j] != '}' {
                j += 1;
            }
            if j < chars.len() && chars[j] == '}' {
                let field: String = chars[i + 1..j].iter().collect();
                output.push_str(&resolve_source_value(row, context, field.trim()));
                i = j + 1;
                continue;
            }
        }
        output.push(chars[i]);
        i += 1;
    }

    output
}

fn apply_combine(row: &[String], context: &ImportContext, mapping: &FieldMappingItem) -> String {
    if let Some(rule) = mapping.transform_rule.as_deref() {
        let trimmed = rule.trim();
        if trimmed.to_uppercase().starts_with("CONCAT(") && trimmed.ends_with(')') {
            let inner = &trimmed[7..trimmed.len() - 1];
            let pieces = split_combine_items(inner);
            return pieces
                .iter()
                .map(|item| read_combine_token(row, context, item))
                .collect::<Vec<_>>()
                .join("");
        }
        if !trimmed.is_empty() {
            return apply_combine_template(trimmed, row, context);
        }
    }

    split_combine_items(&mapping.source_field)
        .iter()
        .map(|item| read_combine_token(row, context, item))
        .collect::<Vec<_>>()
        .join("")
}

/// 解析浮点数字段
fn parse_f64(value: Option<&String>, field: &str, line_no: usize) -> Result<f64, String> {
    value
        .filter(|v| !v.is_empty())
        .ok_or_else(|| format!("第{}行: 缺少{}字段", line_no, field))?
        .parse::<f64>()
        .map_err(|_| format!("第{}行: {}字段不是有效数字", line_no, field))
}

/// 解析布尔值
fn parse_bool(s: &str) -> bool {
    matches!(
        s.trim().to_lowercase().as_str(),
        "true" | "1" | "是" | "yes" | "y"
    )
}

fn normalize_source_datetime_format(source_format: &str) -> String {
    let mut fmt = source_format.trim().to_string();
    if fmt.is_empty() || fmt.contains('%') {
        return fmt;
    }
    let replacements = [
        ("YYYY", "%Y"),
        ("yyyy", "%Y"),
        ("YY", "%y"),
        ("yy", "%y"),
        ("MM", "%m"),
        ("DD", "%d"),
        ("dd", "%d"),
        ("HH", "%H"),
        ("hh", "%H"),
        ("mm", "%M"),
        ("ss", "%S"),
        ("SS", "%S"),
    ];
    for (from, to) in replacements {
        fmt = fmt.replace(from, to);
    }
    fmt
}

fn parse_datetime_with_source_format(
    raw: &str,
    source_format: &str,
) -> Option<chrono::DateTime<Utc>> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }
    let normalized = normalize_source_datetime_format(source_format);
    if normalized.is_empty() {
        return None;
    }

    if normalized.contains("%z") || normalized.contains("%:z") {
        if let Ok(dt) = chrono::DateTime::parse_from_str(trimmed, &normalized) {
            return Some(dt.with_timezone(&Utc));
        }
    }

    if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, &normalized) {
        return Some(Utc.from_utc_datetime(&dt));
    }
    if let Ok(d) = NaiveDate::parse_from_str(trimmed, &normalized) {
        let dt = d.and_time(MIDNIGHT);
        return Some(Utc.from_utc_datetime(&dt));
    }
    None
}

fn apply_date_format(
    raw: &str,
    source_format: Option<&str>,
    line_no: usize,
    source_field: &str,
) -> Result<String, String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    let Some(format_text) = source_format.map(|v| v.trim()).filter(|v| !v.is_empty()) else {
        return Ok(raw.to_string());
    };

    if let Some(dt) = parse_datetime_with_source_format(trimmed, format_text) {
        return Ok(dt.format("%Y-%m-%d %H:%M:%S").to_string());
    }

    Err(format!(
        "第{}行: 字段{} 日期格式不匹配，值='{}'，source_format='{}'",
        line_no, source_field, trimmed, format_text
    ))
}

/// 解析日期时间字符串为 UTC DateTime
fn parse_datetime_to_utc(s: &str) -> Option<chrono::DateTime<Utc>> {
    let trimmed = s.trim();
    if trimmed.is_empty() {
        return None;
    }

    let datetime_formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y%m%d%H%M%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y/%m/%d %H:%M",
    ];

    for fmt in &datetime_formats {
        if let Ok(dt) = NaiveDateTime::parse_from_str(trimmed, fmt) {
            return Some(Utc.from_utc_datetime(&dt));
        }
    }

    let date_formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"];
    for fmt in &date_formats {
        if let Ok(d) = NaiveDate::parse_from_str(trimmed, fmt) {
            let dt = d.and_time(MIDNIGHT);
            return Some(Utc.from_utc_datetime(&dt));
        }
    }

    // 尝试解析 Excel 数字日期（如 45678.5 表示的日期序列号）
    if let Ok(num) = trimmed.parse::<f64>() {
        if num > 1.0 && num < 200000.0 {
            return excel_serial_to_datetime(num);
        }
    }

    None
}

/// Excel 序列号转 DateTime
fn excel_serial_to_datetime(serial: f64) -> Option<chrono::DateTime<Utc>> {
    // Excel 序列号基准日期: 1899-12-30
    let base = NaiveDate::from_ymd_opt(1899, 12, 30)?;
    let days = serial.trunc() as i64;
    let fraction = serial.fract();
    let total_seconds = (fraction * 86400.0).round() as u32;
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;

    let date = base.checked_add_signed(chrono::Duration::days(days))?;
    let time = NaiveTime::from_hms_opt(hours, minutes, seconds)?;
    let dt = date.and_time(time);
    Some(Utc.from_utc_datetime(&dt))
}

/// 将 calamine 单元格值转为字符串
fn cell_to_string(cell: &Data) -> String {
    match cell {
        Data::Int(v) => v.to_string(),
        Data::Float(v) => {
            // 避免浮点数无意义小数
            if *v == v.trunc() && v.abs() < 1e15 {
                format!("{:.0}", v)
            } else {
                v.to_string()
            }
        }
        Data::String(v) => v.clone(),
        Data::Bool(v) => v.to_string(),
        Data::DateTime(v) => {
            // calamine 0.26: ExcelDateTime → 转为 f64 序列号再转日期
            let serial = v.as_f64();
            if let Some(dt) = excel_serial_to_datetime(serial) {
                dt.format("%Y-%m-%d %H:%M:%S").to_string()
            } else {
                format!("{:?}", v)
            }
        }
        Data::DateTimeIso(v) => v.clone(),
        Data::DurationIso(v) => v.clone(),
        Data::Error(e) => format!("ERROR:{:?}", e),
        Data::Empty => String::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn mock_context() -> ImportContext {
        let mut header_index = HashMap::new();
        header_index.insert("A".to_string(), 0);
        header_index.insert("B".to_string(), 1);
        header_index.insert("合同号".to_string(), 2);
        header_index.insert("钢卷号".to_string(), 3);
        ImportContext {
            mappings: vec![],
            transforms: vec![],
            header_index,
        }
    }

    #[test]
    fn calculate_rule_should_work() {
        let result = apply_calculate("2500", Some("/1000"), 2, "A").expect("calculate failed");
        assert_eq!(result, "2.5");

        let result2 = apply_calculate("10", Some("x*1.2"), 2, "A").expect("calculate failed");
        assert_eq!(result2, "12");
    }

    #[test]
    fn calculate_rule_invalid_should_fail() {
        let err = apply_calculate("abc", Some("/1000"), 2, "A").expect_err("should fail");
        assert!(err.contains("不是数字"));

        let err2 = apply_calculate("10", Some("foo"), 2, "A").expect_err("should fail");
        assert!(err2.contains("规则格式错误"));
    }

    #[test]
    fn combine_rule_should_work() {
        let context = mock_context();
        let row = vec![
            "100".to_string(),
            "200".to_string(),
            "HT202602".to_string(),
            "HC001".to_string(),
        ];

        let mapping = FieldMappingItem {
            source_field: "合同号,钢卷号".to_string(),
            target_field: "batch_code".to_string(),
            mapping_type: "combine".to_string(),
            default_value: None,
            transform_rule: Some("CONCAT(合同号,'-',钢卷号)".to_string()),
            source_format: None,
        };
        let result = apply_combine(&row, &context, &mapping);
        assert_eq!(result, "HT202602-HC001");

        let mapping2 = FieldMappingItem {
            source_field: "合同号,钢卷号".to_string(),
            target_field: "batch_code".to_string(),
            mapping_type: "combine".to_string(),
            default_value: None,
            transform_rule: Some("{合同号}/{钢卷号}".to_string()),
            source_format: None,
        };
        let result2 = apply_combine(&row, &context, &mapping2);
        assert_eq!(result2, "HT202602/HC001");
    }

    #[test]
    fn transform_rule_parse_should_support_builtin_and_pairs() {
        let builtin = parse_transform_rule_value_map("bool_yn").expect("builtin parse failed");
        assert_eq!(builtin.get("是"), Some(&"true".to_string()));
        assert_eq!(builtin.get("否"), Some(&"false".to_string()));

        let pairs =
            parse_transform_rule_value_map("是=true, 否=false").expect("pairs parse failed");
        assert_eq!(pairs.get("是"), Some(&"true".to_string()));
        assert_eq!(pairs.get("否"), Some(&"false".to_string()));
    }

    #[test]
    fn inline_transform_rule_should_merge_into_transforms() {
        let mappings = vec![FieldMappingItem {
            source_field: "A".to_string(),
            target_field: "export_flag".to_string(),
            mapping_type: "transform".to_string(),
            default_value: None,
            transform_rule: Some("是=true,否=false".to_string()),
            source_format: None,
        }];
        let mut transforms = vec![ValueTransformRule {
            field: "export_flag".to_string(),
            value_map: Some(HashMap::from([("是".to_string(), "1".to_string())])),
            data_type: None,
        }];

        merge_inline_transform_rules(&mappings, &mut transforms);
        let transformed = apply_transform("是", "export_flag", &transforms);
        assert_eq!(transformed, "true");
    }

    #[test]
    fn date_source_format_should_work() {
        let formatted = apply_date_format("20260213", Some("YYYYMMDD"), 2, "coiling_time")
            .expect("date format should parse");
        assert_eq!(formatted, "2026-02-13 00:00:00");

        let err = apply_date_format("2026/02/13", Some("YYYYMMDD"), 2, "coiling_time")
            .expect_err("date format should fail");
        assert!(err.contains("日期格式不匹配"));
    }
}

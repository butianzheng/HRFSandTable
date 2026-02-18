use std::collections::HashMap;

use super::super::priority_batch::upsert_batch_priority_config;
use super::super::priority_customer::upsert_customer_priority_config;
use super::super::priority_dimension::upsert_priority_dimension_config;
use super::super::priority_product::upsert_product_type_priority_config;
use super::super::priority_weight::upsert_priority_weight_configs;
use super::super::types::{
    map_get_trimmed, parse_batch_input_from_map, parse_customer_input_from_map,
    parse_dimension_input_from_map, parse_product_input_from_map, parse_weight_input_from_map,
    write_operation_log, PriorityConfigImportResult, PriorityWeightUpsertInput,
};
use super::utils::{read_priority_sheet_rows, validate_weight_inputs, SheetRows};
use crate::AppError;

pub async fn import_priority_configs_from_csv(
    file_path: &str,
    dry_run: bool,
) -> Result<PriorityConfigImportResult, AppError> {
    let mut reader = csv::Reader::from_path(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法打开CSV文件: {}", e)))?;
    let headers: Vec<String> = reader
        .headers()
        .map_err(|e| AppError::FileFormatError(format!("无法读取CSV表头: {}", e)))?
        .iter()
        .map(|h| h.trim().to_ascii_lowercase())
        .collect();
    if headers.is_empty() {
        return Err(AppError::FileFormatError("CSV文件表头为空".to_string()));
    }

    let mut result = PriorityConfigImportResult::default();
    let mut weight_inputs: Vec<PriorityWeightUpsertInput> = Vec::new();

    for (idx, record) in reader.records().enumerate() {
        let line_no = idx + 2;
        let row_record = match record {
            Ok(v) => v,
            Err(err) => {
                result.skipped_rows += 1;
                result
                    .warnings
                    .push(format!("第{}行读取失败: {}", line_no, err));
                continue;
            }
        };
        let mut row_map = HashMap::new();
        for (col_idx, header) in headers.iter().enumerate() {
            let value = row_record.get(col_idx).unwrap_or("").to_string();
            row_map.insert(header.clone(), value);
        }
        result.total_rows += 1;

        let config_type = map_get_trimmed(&row_map, "config_type")
            .unwrap_or_default()
            .to_ascii_lowercase();

        match config_type.as_str() {
            "weight" => match parse_weight_input_from_map(&row_map) {
                Ok(input) => weight_inputs.push(input),
                Err(err) => {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("第{}行(weight)导入失败: {}", line_no, err));
                }
            },
            "dimension" => match parse_dimension_input_from_map(&row_map) {
                Ok(input) => {
                    if dry_run {
                        result.imported_dimension += 1;
                    } else if let Err(err) = upsert_priority_dimension_config(input).await {
                        result.skipped_rows += 1;
                        result
                            .warnings
                            .push(format!("第{}行(dimension)导入失败: {}", line_no, err));
                    } else {
                        result.imported_dimension += 1;
                    }
                }
                Err(err) => {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("第{}行(dimension)数据错误: {}", line_no, err));
                }
            },
            "customer" => match parse_customer_input_from_map(&row_map) {
                Ok(input) => {
                    if dry_run {
                        result.imported_customer += 1;
                    } else if let Err(err) = upsert_customer_priority_config(input).await {
                        result.skipped_rows += 1;
                        result
                            .warnings
                            .push(format!("第{}行(customer)导入失败: {}", line_no, err));
                    } else {
                        result.imported_customer += 1;
                    }
                }
                Err(err) => {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("第{}行(customer)数据错误: {}", line_no, err));
                }
            },
            "batch" => match parse_batch_input_from_map(&row_map) {
                Ok(input) => {
                    if dry_run {
                        result.imported_batch += 1;
                    } else if let Err(err) = upsert_batch_priority_config(input).await {
                        result.skipped_rows += 1;
                        result
                            .warnings
                            .push(format!("第{}行(batch)导入失败: {}", line_no, err));
                    } else {
                        result.imported_batch += 1;
                    }
                }
                Err(err) => {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("第{}行(batch)数据错误: {}", line_no, err));
                }
            },
            "product_type" | "product" => match parse_product_input_from_map(&row_map) {
                Ok(input) => {
                    if dry_run {
                        result.imported_product_type += 1;
                    } else if let Err(err) = upsert_product_type_priority_config(input).await {
                        result.skipped_rows += 1;
                        result
                            .warnings
                            .push(format!("第{}行(product_type)导入失败: {}", line_no, err));
                    } else {
                        result.imported_product_type += 1;
                    }
                }
                Err(err) => {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("第{}行(product_type)数据错误: {}", line_no, err));
                }
            },
            _ => {
                result.skipped_rows += 1;
                result.warnings.push(format!(
                    "第{}行缺少或不支持 config_type: {}",
                    line_no, config_type
                ));
            }
        }
    }

    if !weight_inputs.is_empty() {
        let weight_count = weight_inputs.len();
        result
            .warnings
            .extend(validate_weight_inputs(&weight_inputs));
        if dry_run {
            result.imported_weight += weight_count;
        } else {
            match upsert_priority_weight_configs(weight_inputs).await {
                Ok(_) => result.imported_weight += weight_count,
                Err(err) => {
                    result.skipped_rows += weight_count;
                    result
                        .warnings
                        .push(format!("weight 批量导入失败: {}", err));
                }
            }
        }
    }

    Ok(result)
}

pub async fn import_priority_configs_from_excel(
    file_path: &str,
    dry_run: bool,
) -> Result<PriorityConfigImportResult, AppError> {
    use calamine::{open_workbook_auto, Reader};

    let mut workbook = open_workbook_auto(file_path)
        .map_err(|e| AppError::FileFormatError(format!("无法打开Excel文件: {}", e)))?;
    let sheet_names = workbook.sheet_names().to_vec();

    let mut result = PriorityConfigImportResult::default();
    let mut weight_inputs: Vec<PriorityWeightUpsertInput> = Vec::new();

    let mut consume_sheet = |sheet_name: &str| -> Result<SheetRows, AppError> {
        if !sheet_names.iter().any(|name| name == sheet_name) {
            return Ok(Vec::new());
        }
        let range = workbook.worksheet_range(sheet_name).map_err(|e| {
            AppError::FileFormatError(format!("读取工作表 {} 失败: {}", sheet_name, e))
        })?;
        Ok(read_priority_sheet_rows(&range))
    };

    for (line_no, row_map) in consume_sheet("weight_config")? {
        result.total_rows += 1;
        match parse_weight_input_from_map(&row_map) {
            Ok(input) => weight_inputs.push(input),
            Err(err) => {
                result.skipped_rows += 1;
                result
                    .warnings
                    .push(format!("weight_config 第{}行数据错误: {}", line_no, err));
            }
        }
    }

    for (line_no, row_map) in consume_sheet("dimension_config")? {
        result.total_rows += 1;
        match parse_dimension_input_from_map(&row_map) {
            Ok(input) => {
                if dry_run {
                    result.imported_dimension += 1;
                } else if let Err(err) = upsert_priority_dimension_config(input).await {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("dimension_config 第{}行导入失败: {}", line_no, err));
                } else {
                    result.imported_dimension += 1;
                }
            }
            Err(err) => {
                result.skipped_rows += 1;
                result
                    .warnings
                    .push(format!("dimension_config 第{}行数据错误: {}", line_no, err));
            }
        }
    }

    for (line_no, row_map) in consume_sheet("customer_config")? {
        result.total_rows += 1;
        match parse_customer_input_from_map(&row_map) {
            Ok(input) => {
                if dry_run {
                    result.imported_customer += 1;
                } else if let Err(err) = upsert_customer_priority_config(input).await {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("customer_config 第{}行导入失败: {}", line_no, err));
                } else {
                    result.imported_customer += 1;
                }
            }
            Err(err) => {
                result.skipped_rows += 1;
                result
                    .warnings
                    .push(format!("customer_config 第{}行数据错误: {}", line_no, err));
            }
        }
    }

    for (line_no, row_map) in consume_sheet("batch_config")? {
        result.total_rows += 1;
        match parse_batch_input_from_map(&row_map) {
            Ok(input) => {
                if dry_run {
                    result.imported_batch += 1;
                } else if let Err(err) = upsert_batch_priority_config(input).await {
                    result.skipped_rows += 1;
                    result
                        .warnings
                        .push(format!("batch_config 第{}行导入失败: {}", line_no, err));
                } else {
                    result.imported_batch += 1;
                }
            }
            Err(err) => {
                result.skipped_rows += 1;
                result
                    .warnings
                    .push(format!("batch_config 第{}行数据错误: {}", line_no, err));
            }
        }
    }

    for (line_no, row_map) in consume_sheet("product_type_config")? {
        result.total_rows += 1;
        match parse_product_input_from_map(&row_map) {
            Ok(input) => {
                if dry_run {
                    result.imported_product_type += 1;
                } else if let Err(err) = upsert_product_type_priority_config(input).await {
                    result.skipped_rows += 1;
                    result.warnings.push(format!(
                        "product_type_config 第{}行导入失败: {}",
                        line_no, err
                    ));
                } else {
                    result.imported_product_type += 1;
                }
            }
            Err(err) => {
                result.skipped_rows += 1;
                result.warnings.push(format!(
                    "product_type_config 第{}行数据错误: {}",
                    line_no, err
                ));
            }
        }
    }

    if !weight_inputs.is_empty() {
        let weight_count = weight_inputs.len();
        result
            .warnings
            .extend(validate_weight_inputs(&weight_inputs));
        if dry_run {
            result.imported_weight += weight_count;
        } else {
            match upsert_priority_weight_configs(weight_inputs).await {
                Ok(_) => result.imported_weight += weight_count,
                Err(err) => {
                    result.skipped_rows += weight_count;
                    result
                        .warnings
                        .push(format!("weight_config 批量导入失败: {}", err));
                }
            }
        }
    }

    Ok(result)
}

#[tauri::command]
pub async fn import_priority_configs(
    file_path: String,
    dry_run: Option<bool>,
) -> Result<PriorityConfigImportResult, AppError> {
    use std::path::Path;
    let dry_run = dry_run.unwrap_or(false);

    let ext = Path::new(&file_path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let mut result = match ext.as_str() {
        "csv" => import_priority_configs_from_csv(&file_path, dry_run).await?,
        "xlsx" | "xls" => import_priority_configs_from_excel(&file_path, dry_run).await?,
        _ => {
            return Err(AppError::FileFormatError(format!(
                "不支持的文件格式: .{},请使用 .csv/.xlsx/.xls",
                ext
            )));
        }
    };
    result.dry_run = dry_run;

    write_operation_log(
        if dry_run {
            "precheck_priority_configs"
        } else {
            "import_priority_configs"
        },
        Some("priority_config"),
        None,
        Some(format!(
            "{}优先级配置: total={}, weight={}, dimension={}, customer={}, batch={}, product_type={}, skipped={}, file={}",
            if dry_run { "预检" } else { "导入" },
            result.total_rows,
            result.imported_weight,
            result.imported_dimension,
            result.imported_customer,
            result.imported_batch,
            result.imported_product_type,
            result.skipped_rows,
            file_path
        )),
    )
    .await;

    Ok(result)
}

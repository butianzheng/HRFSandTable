use crate::utils::log::write_operation_log as write_log_full;
use crate::AppError;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// 配置模块专用日志写入（log_type 固定为 "system"）
pub(super) async fn write_operation_log(
    action: &str,
    target_type: Option<&str>,
    target_id: Option<i32>,
    detail: Option<String>,
) {
    write_log_full("system", action, target_type, target_id, detail).await;
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConfigValue {
    pub value: String,
    pub value_type: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ShiftConfig {
    pub key: String,
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateStrategyInput {
    pub name: String,
    pub description: Option<String>,
    pub sort_weights: String,
    pub constraints: String,
    pub soft_constraints: Option<String>,
    pub eval_weights: String,
    pub temper_rules: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateStrategyInput {
    pub name: Option<String>,
    pub description: Option<String>,
    pub is_default: Option<bool>,
    pub sort_weights: Option<String>,
    pub constraints: Option<String>,
    pub soft_constraints: Option<String>,
    pub eval_weights: Option<String>,
    pub temper_rules: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateMaintenancePlanInput {
    pub title: String,
    pub start_time: String,
    pub end_time: String,
    pub maintenance_type: String,
    pub recurrence: Option<String>,
    pub is_active: Option<bool>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateMaintenancePlanInput {
    pub title: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub maintenance_type: Option<String>,
    pub recurrence: Option<String>,
    pub is_active: Option<bool>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PriorityWeightUpsertInput {
    pub dimension_type: String,
    pub dimension_name: String,
    pub weight: f64,
    pub enabled: bool,
    pub sort_order: Option<i32>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PriorityDimensionUpsertInput {
    pub id: Option<i32>,
    pub dimension_type: String,
    pub dimension_code: String,
    pub dimension_name: String,
    pub score: i32,
    pub enabled: bool,
    pub sort_order: Option<i32>,
    pub rule_config: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerPriorityUpsertInput {
    pub id: Option<i32>,
    pub customer_code: String,
    pub customer_name: String,
    pub priority_level: String,
    pub priority_score: i32,
    pub enabled: bool,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BatchPriorityUpsertInput {
    pub id: Option<i32>,
    pub batch_code: String,
    pub batch_name: String,
    pub priority_type: String,
    pub priority_score: i32,
    pub enabled: bool,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductTypePriorityUpsertInput {
    pub id: Option<i32>,
    pub product_type: String,
    pub product_name: String,
    pub priority_level: String,
    pub priority_score: i32,
    pub enabled: bool,
    pub remarks: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct PriorityConfigImportResult {
    pub dry_run: bool,
    pub total_rows: usize,
    pub imported_weight: usize,
    pub imported_dimension: usize,
    pub imported_customer: usize,
    pub imported_batch: usize,
    pub imported_product_type: usize,
    pub skipped_rows: usize,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StrategyTemplateFile {
    pub name: String,
    pub description: Option<String>,
    pub sort_weights: String,
    pub constraints: String,
    pub soft_constraints: Option<String>,
    pub eval_weights: String,
    pub temper_rules: String,
}

pub(super) fn parse_datetime_utc(value: &str) -> Result<chrono::DateTime<chrono::Utc>, AppError> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .or_else(|_| {
            chrono::NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S").map(|naive| {
                chrono::DateTime::<chrono::Utc>::from_naive_utc_and_offset(naive, chrono::Utc)
            })
        })
        .map_err(|_| AppError::DataConversionError(format!("无效日期时间格式: {}", value)))
}

pub(super) fn normalize_required_text(value: &str, field_name: &str) -> Result<String, AppError> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(AppError::ConstraintViolation(format!(
            "{} 不能为空",
            field_name
        )));
    }
    Ok(trimmed.to_string())
}

pub(super) fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|v| {
        let trimmed = v.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub(super) fn parse_bool_text(value: Option<&str>, default: bool) -> bool {
    let Some(raw) = value.map(|v| v.trim()).filter(|v| !v.is_empty()) else {
        return default;
    };
    match raw.to_ascii_lowercase().as_str() {
        "1" | "true" | "yes" | "y" => true,
        "0" | "false" | "no" | "n" => false,
        _ => default,
    }
}

pub(super) fn parse_i32_text(
    value: Option<&str>,
    default: i32,
    field_name: &str,
) -> Result<i32, AppError> {
    let Some(raw) = value.map(|v| v.trim()).filter(|v| !v.is_empty()) else {
        return Ok(default);
    };
    raw.parse::<i32>()
        .map_err(|_| AppError::DataConversionError(format!("{} 不是有效整数: {}", field_name, raw)))
}

pub(super) fn parse_f64_text(
    value: Option<&str>,
    default: f64,
    field_name: &str,
) -> Result<f64, AppError> {
    let Some(raw) = value.map(|v| v.trim()).filter(|v| !v.is_empty()) else {
        return Ok(default);
    };
    raw.parse::<f64>()
        .map_err(|_| AppError::DataConversionError(format!("{} 不是有效数字: {}", field_name, raw)))
}

pub(super) fn parse_optional_i32_text(
    value: Option<&str>,
    field_name: &str,
) -> Result<Option<i32>, AppError> {
    let Some(raw) = value.map(|v| v.trim()).filter(|v| !v.is_empty()) else {
        return Ok(None);
    };
    raw.parse::<i32>()
        .map(Some)
        .map_err(|_| AppError::DataConversionError(format!("{} 不是有效整数: {}", field_name, raw)))
}

pub(super) fn map_get_trimmed(row: &HashMap<String, String>, key: &str) -> Option<String> {
    row.get(key)
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty())
}

pub(super) fn map_get_required(
    row: &HashMap<String, String>,
    key: &str,
    field_name: &str,
) -> Result<String, AppError> {
    let value = map_get_trimmed(row, key)
        .ok_or_else(|| AppError::ConstraintViolation(format!("{} 不能为空", field_name)))?;
    normalize_required_text(&value, field_name)
}

pub(super) fn parse_weight_input_from_map(
    row: &HashMap<String, String>,
) -> Result<PriorityWeightUpsertInput, AppError> {
    let dimension_type = map_get_required(row, "dimension_type", "dimension_type")?;
    let dimension_name = map_get_required(row, "dimension_name", "dimension_name")?;
    let weight = parse_f64_text(map_get_trimmed(row, "weight").as_deref(), 1.0, "weight")?;
    if !weight.is_finite() || !(0.0..=1.0).contains(&weight) {
        return Err(AppError::ConstraintViolation(format!(
            "weight 必须在 0.0~1.0 之间: {}",
            weight
        )));
    }
    Ok(PriorityWeightUpsertInput {
        dimension_type,
        dimension_name,
        weight,
        enabled: parse_bool_text(map_get_trimmed(row, "enabled").as_deref(), true),
        sort_order: parse_optional_i32_text(
            map_get_trimmed(row, "sort_order").as_deref(),
            "sort_order",
        )?,
        description: map_get_trimmed(row, "description"),
    })
}

pub(super) fn parse_dimension_input_from_map(
    row: &HashMap<String, String>,
) -> Result<PriorityDimensionUpsertInput, AppError> {
    let rule_config = map_get_trimmed(row, "rule_config");
    if let Some(rule_text) = rule_config.as_ref() {
        serde_json::from_str::<serde_json::Value>(rule_text).map_err(|e| {
            AppError::DataConversionError(format!("rule_config JSON格式错误: {}", e))
        })?;
    }
    Ok(PriorityDimensionUpsertInput {
        id: parse_optional_i32_text(map_get_trimmed(row, "id").as_deref(), "id")?,
        dimension_type: map_get_required(row, "dimension_type", "dimension_type")?,
        dimension_code: map_get_required(row, "dimension_code", "dimension_code")?,
        dimension_name: map_get_required(row, "dimension_name", "dimension_name")?,
        score: parse_i32_text(map_get_trimmed(row, "score").as_deref(), 0, "score")?,
        enabled: parse_bool_text(map_get_trimmed(row, "enabled").as_deref(), true),
        sort_order: parse_optional_i32_text(
            map_get_trimmed(row, "sort_order").as_deref(),
            "sort_order",
        )?,
        rule_config,
        description: map_get_trimmed(row, "description"),
    })
}

pub(super) fn parse_customer_input_from_map(
    row: &HashMap<String, String>,
) -> Result<CustomerPriorityUpsertInput, AppError> {
    Ok(CustomerPriorityUpsertInput {
        id: parse_optional_i32_text(map_get_trimmed(row, "id").as_deref(), "id")?,
        customer_code: map_get_required(row, "customer_code", "customer_code")?,
        customer_name: map_get_required(row, "customer_name", "customer_name")?,
        priority_level: map_get_trimmed(row, "priority_level")
            .unwrap_or_else(|| "normal".to_string()),
        priority_score: parse_i32_text(
            map_get_trimmed(row, "priority_score").as_deref(),
            50,
            "priority_score",
        )?,
        enabled: parse_bool_text(map_get_trimmed(row, "enabled").as_deref(), true),
        remarks: map_get_trimmed(row, "remarks"),
    })
}

pub(super) fn parse_batch_input_from_map(
    row: &HashMap<String, String>,
) -> Result<BatchPriorityUpsertInput, AppError> {
    Ok(BatchPriorityUpsertInput {
        id: parse_optional_i32_text(map_get_trimmed(row, "id").as_deref(), "id")?,
        batch_code: map_get_required(row, "batch_code", "batch_code")?,
        batch_name: map_get_required(row, "batch_name", "batch_name")?,
        priority_type: map_get_trimmed(row, "priority_type")
            .unwrap_or_else(|| "normal".to_string()),
        priority_score: parse_i32_text(
            map_get_trimmed(row, "priority_score").as_deref(),
            0,
            "priority_score",
        )?,
        enabled: parse_bool_text(map_get_trimmed(row, "enabled").as_deref(), true),
        remarks: map_get_trimmed(row, "remarks"),
    })
}

pub(super) fn parse_product_input_from_map(
    row: &HashMap<String, String>,
) -> Result<ProductTypePriorityUpsertInput, AppError> {
    Ok(ProductTypePriorityUpsertInput {
        id: parse_optional_i32_text(map_get_trimmed(row, "id").as_deref(), "id")?,
        product_type: map_get_required(row, "product_type", "product_type")?,
        product_name: map_get_required(row, "product_name", "product_name")?,
        priority_level: map_get_trimmed(row, "priority_level")
            .unwrap_or_else(|| "normal".to_string()),
        priority_score: parse_i32_text(
            map_get_trimmed(row, "priority_score").as_deref(),
            0,
            "priority_score",
        )?,
        enabled: parse_bool_text(map_get_trimmed(row, "enabled").as_deref(), true),
        remarks: map_get_trimmed(row, "remarks"),
    })
}

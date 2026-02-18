use chrono::{DateTime, Datelike, Utc};
use sea_orm::*;
use std::collections::HashMap;

use crate::db::get_db;
use crate::models::system_config::Entity as Config;
use crate::AppError;

/// 适温配置（从数据库加载）
#[derive(Debug, Clone)]
pub struct TemperConfig {
    pub enabled: bool,
    pub spring_days: i32,
    pub summer_days: i32,
    pub autumn_days: i32,
    pub winter_days: i32,
    pub spring_months: Vec<u32>,
    pub summer_months: Vec<u32>,
    pub autumn_months: Vec<u32>,
    pub winter_months: Vec<u32>,
}

impl Default for TemperConfig {
    fn default() -> Self {
        Self {
            enabled: true,
            spring_days: 3,
            summer_days: 4,
            autumn_days: 4,
            winter_days: 3,
            spring_months: vec![3, 4, 5],
            summer_months: vec![6, 7, 8],
            autumn_months: vec![9, 10, 11],
            winter_months: vec![12, 1, 2],
        }
    }
}

/// 从数据库加载适温配置
pub async fn load_temper_config() -> Result<TemperConfig, AppError> {
    let db = get_db();

    let configs = Config::find()
        .filter(crate::models::system_config::Column::ConfigGroup.eq("temp"))
        .all(db)
        .await?;

    let mut config_map: HashMap<String, String> = HashMap::new();
    for c in configs {
        config_map.insert(c.config_key, c.config_value);
    }

    let mut tc = TemperConfig::default();

    if let Some(v) = config_map.get("enabled") {
        tc.enabled = v == "true";
    }
    if let Some(v) = config_map.get("spring_days") {
        tc.spring_days = v.parse().unwrap_or(3);
    }
    if let Some(v) = config_map.get("summer_days") {
        tc.summer_days = v.parse().unwrap_or(4);
    }
    if let Some(v) = config_map.get("autumn_days") {
        tc.autumn_days = v.parse().unwrap_or(4);
    }
    if let Some(v) = config_map.get("winter_days") {
        tc.winter_days = v.parse().unwrap_or(3);
    }
    if let Some(v) = config_map.get("spring_months") {
        tc.spring_months = parse_month_list(v);
    }
    if let Some(v) = config_map.get("summer_months") {
        tc.summer_months = parse_month_list(v);
    }
    if let Some(v) = config_map.get("autumn_months") {
        tc.autumn_months = parse_month_list(v);
    }
    if let Some(v) = config_map.get("winter_months") {
        tc.winter_months = parse_month_list(v);
    }

    Ok(tc)
}

/// 使用可配置参数计算适温状态
pub fn calculate_temp_status_with_config(
    coiling_time: &DateTime<Utc>,
    config: &TemperConfig,
) -> (String, i32) {
    if !config.enabled {
        return ("ready".to_string(), 0);
    }

    let now = Utc::now();
    let wait_days = now.signed_duration_since(*coiling_time).num_days() as i32;

    let current_month = now.month();
    let threshold = get_threshold_from_config(current_month, config);

    let status = if wait_days >= threshold {
        "ready"
    } else {
        "waiting"
    };

    (status.to_string(), wait_days)
}

/// 根据配置获取当前月份的适温阈值天数
pub(crate) fn get_threshold_from_config(month: u32, config: &TemperConfig) -> i32 {
    if config.spring_months.contains(&month) {
        config.spring_days
    } else if config.summer_months.contains(&month) {
        config.summer_days
    } else if config.autumn_months.contains(&month) {
        config.autumn_days
    } else if config.winter_months.contains(&month) {
        config.winter_days
    } else {
        // 默认取春/冬季天数
        config.spring_days
    }
}

/// 批量刷新所有材料的适温状态
pub async fn refresh_all_temper_status() -> Result<(usize, usize, usize), AppError> {
    use crate::models::material::Entity as Material;
    use sea_orm::prelude::Expr;

    let db = get_db();
    let config = load_temper_config().await?;
    let materials = Material::find().all(db).await?;

    let total = materials.len();
    let mut tempered = 0usize;
    let mut waiting = 0usize;

    for material in &materials {
        let (status, wait_days) =
            calculate_temp_status_with_config(&material.coiling_time, &config);
        let is_temp = status == "ready";

        if is_temp {
            tempered += 1;
        } else {
            waiting += 1;
        }

        Material::update_many()
            .col_expr(
                crate::models::material::Column::TempStatus,
                Expr::value(&status),
            )
            .col_expr(
                crate::models::material::Column::TempWaitDays,
                Expr::value(wait_days),
            )
            .col_expr(
                crate::models::material::Column::IsTempered,
                Expr::value(is_temp),
            )
            .col_expr(
                crate::models::material::Column::UpdatedAt,
                Expr::current_timestamp().into(),
            )
            .filter(crate::models::material::Column::Id.eq(material.id))
            .exec(db)
            .await?;
    }

    Ok((total, tempered, waiting))
}

/// 计算材料的预计适温日期（YYYY-MM-DD）。
/// 如材料已适温，返回 None。
pub fn calculate_ready_date(coiling_time: &DateTime<Utc>, config: &TemperConfig) -> Option<String> {
    if !config.enabled {
        return None; // 适温功能关闭，视为已适温
    }
    let now = Utc::now();
    let wait_days = now.signed_duration_since(*coiling_time).num_days() as i32;
    let current_month = now.month();
    let threshold = get_threshold_from_config(current_month, config);
    if wait_days >= threshold {
        return None; // 已适温
    }
    let remain_days = (threshold - wait_days).max(1);
    Some(
        (now + chrono::Duration::days(remain_days as i64))
            .format("%Y-%m-%d")
            .to_string(),
    )
}

/// 解析月份列表字符串 "3,4,5" → vec![3, 4, 5]
fn parse_month_list(s: &str) -> Vec<u32> {
    s.split(',')
        .filter_map(|m| m.trim().parse::<u32>().ok())
        .filter(|m| *m >= 1 && *m <= 12)
        .collect()
}

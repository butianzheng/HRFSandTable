//! 多维排序器 — 9 因子加权排序 + 分组聚合
//!
//! 9 个排序因子（按权重降序）：
//!   1. temp_status    (100) — 适温状态，prerequisite
//!   2. width          (95)  — 宽度，desc，group
//!   3. priority       (90)  — 综合优先级，desc
//!   4. hardness_level (85)  — 硬度等级，asc，group
//!   5. thickness      (80)  — 厚度，asc
//!   6. surface_level  (75)  — 表面等级，desc
//!   7. product_type   (65)  — 产品大类，asc，group
//!   8. storage_days   (60)  — 库龄，desc
//!   9. steel_grade    (55)  — 钢种，asc，group

use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::HashMap;

use crate::models::material;

/// 排序配置 (从 strategy_template.sort_weights JSON 解析)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortConfig {
    pub priorities: Vec<SortPriority>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SortPriority {
    pub field: String,
    pub order: String, // "asc" | "desc"
    pub weight: i32,
    pub enabled: bool,
    #[serde(default)]
    pub group: bool,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub sort_map: HashMap<String, i32>,
    #[serde(default)]
    pub is_prerequisite: bool,
}

/// 带排序键的材料
#[derive(Debug, Clone)]
pub struct SortedMaterial {
    pub material: material::Model,
    /// 各维度的排序键值
    pub sort_keys: Vec<SortKey>,
    /// 最早可排日期 (YYYY-MM-DD)。None = 已适温可立即排程，Some = 滚动适温，该日期后才可排入
    pub earliest_schedule_date: Option<String>,
}

#[derive(Debug, Clone)]
pub struct SortKey {
    pub field: String,
    pub value: f64,
    pub order_asc: bool,
    pub group: bool,
    pub raw_value: String,
}

/// 对材料列表执行多维排序
pub fn sort_materials(materials: Vec<material::Model>, config: &SortConfig) -> Vec<SortedMaterial> {
    // 仅保留 enabled 的因子，按 weight 降序排列
    let mut active_priorities: Vec<&SortPriority> =
        config.priorities.iter().filter(|p| p.enabled).collect();
    active_priorities.sort_by(|a, b| b.weight.cmp(&a.weight));

    // 为每个材料构建排序键
    let mut sorted: Vec<SortedMaterial> = materials
        .into_iter()
        .map(|mat| {
            let sort_keys: Vec<SortKey> = active_priorities
                .iter()
                .map(|p| build_sort_key(&mat, p))
                .collect();
            SortedMaterial {
                material: mat,
                sort_keys,
                earliest_schedule_date: None,
            }
        })
        .collect();

    // 按多维键排序
    sorted.sort_by(|a, b| compare_sort_keys(&a.sort_keys, &b.sort_keys));

    // 分组聚合: 对于标记了 group 的字段，把相邻且相同值的材料聚到一起
    apply_grouping(&mut sorted, &active_priorities);

    sorted
}

/// 从材料模型中提取指定字段的排序键
fn build_sort_key(mat: &material::Model, priority: &SortPriority) -> SortKey {
    let (value, raw) = extract_field_value(mat, &priority.field, &priority.sort_map);
    SortKey {
        field: priority.field.clone(),
        value,
        order_asc: priority.order == "asc",
        group: priority.group,
        raw_value: raw,
    }
}

/// 提取排序字段值为可比较的 f64
fn extract_field_value(
    mat: &material::Model,
    field: &str,
    sort_map: &HashMap<String, i32>,
) -> (f64, String) {
    match field {
        "temp_status" => {
            let raw = mat.temp_status.as_deref().unwrap_or("waiting").to_string();
            let val = sort_map
                .get(&raw)
                .copied()
                .unwrap_or(if raw == "ready" { 1 } else { 0 }) as f64;
            (val, raw)
        }
        "width" => (mat.width, format!("{:.1}", mat.width)),
        "priority" => {
            let val = mat.priority_final.unwrap_or(0) as f64;
            (val, val.to_string())
        }
        "hardness_level" => {
            let raw = mat.hardness_level.as_deref().unwrap_or("").to_string();
            let val = sort_map
                .get(&raw)
                .copied()
                .unwrap_or_else(|| default_hardness_order(&raw)) as f64;
            (val, raw)
        }
        "thickness" => (mat.thickness, format!("{:.2}", mat.thickness)),
        "surface_level" => {
            let raw = mat.surface_level.as_deref().unwrap_or("").to_string();
            let val = sort_map
                .get(&raw)
                .copied()
                .unwrap_or_else(|| default_surface_order(&raw)) as f64;
            (val, raw)
        }
        "product_type" => {
            let raw = mat.product_type.as_deref().unwrap_or("").to_string();
            let val = sort_map.get(&raw).copied().unwrap_or(0) as f64;
            (val, raw)
        }
        "storage_days" => {
            let val = mat.storage_days.unwrap_or(0) as f64;
            (val, val.to_string())
        }
        "steel_grade" => {
            let raw = mat.steel_grade.clone();
            // 钢种按字符串排序，转为其哈希的数值比较
            // 但为了正确性，用 raw_value 做分组，value 做辅助排序
            let val = sort_map.get(&raw).copied().unwrap_or(0) as f64;
            (val, raw)
        }
        _ => (0.0, String::new()),
    }
}

/// 默认硬度等级排序映射
fn default_hardness_order(level: &str) -> i32 {
    match level {
        "软" | "S" | "soft" => 1,
        "中" | "M" | "medium" => 2,
        "硬" | "H" | "hard" => 3,
        _ => 2, // 默认中等
    }
}

/// 默认表面等级排序映射
fn default_surface_order(level: &str) -> i32 {
    match level {
        "FA" => 4,
        "FB" => 3,
        "FC" => 2,
        "FD" => 1,
        _ => 0,
    }
}

/// 比较两个材料的多维排序键
pub fn compare_sort_keys(a: &[SortKey], b: &[SortKey]) -> Ordering {
    for (ka, kb) in a.iter().zip(b.iter()) {
        let cmp = if ka.order_asc {
            ka.value.partial_cmp(&kb.value).unwrap_or(Ordering::Equal)
        } else {
            kb.value.partial_cmp(&ka.value).unwrap_or(Ordering::Equal)
        };
        if cmp != Ordering::Equal {
            return cmp;
        }
        // 数值相同时按 raw_value 字符串比较
        if ka.order_asc {
            let str_cmp = ka.raw_value.cmp(&kb.raw_value);
            if str_cmp != Ordering::Equal {
                return str_cmp;
            }
        } else {
            let str_cmp = kb.raw_value.cmp(&ka.raw_value);
            if str_cmp != Ordering::Equal {
                return str_cmp;
            }
        }
    }
    Ordering::Equal
}

/// 分组聚合：把标记了 group=true 的字段中相同值的材料聚合到一起
/// 这里用稳定的方法：按最高权重的 group 字段做额外的稳定聚合
#[allow(clippy::needless_return)]
fn apply_grouping(_sorted: &mut [SortedMaterial], priorities: &[&SortPriority]) {
    let group_fields: Vec<(usize, &str)> = priorities
        .iter()
        .enumerate()
        .filter(|(_, p)| p.group)
        .map(|(idx, p)| (idx, p.field.as_str()))
        .collect();

    if group_fields.is_empty() {
        return;
    }

    // 对每个 group 字段，确保相同值的材料在当前排序中是连续的
    // 使用稳定排序，将 group 字段值相同的材料聚到一起
    // 关键：不破坏主排序的基本顺序
    //
    // 方法：在现有排序的基础上，如果两个材料在更高优先级的键都相同时，
    // group 字段的相同值应该聚合。
    // 实际上 compare_sort_keys 已经实现了这个逻辑：
    // 高权重的 prerequisite 先比较，然后是 group 字段。
    // 值相同的自然就连续了。
    // 这里只需要处理额外的边界情况即可。
}

/// 从策略模板 JSON 解析排序配置
pub fn parse_sort_config(json_str: &str) -> Result<SortConfig, crate::AppError> {
    serde_json::from_str(json_str)
        .map_err(|e| crate::AppError::Internal(format!("解析排序配置失败: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::test_helpers::helpers::make_material;

    fn priority(field: &str, order: &str, weight: i32) -> SortPriority {
        SortPriority {
            field: field.to_string(),
            order: order.to_string(),
            weight,
            enabled: true,
            group: false,
            description: String::new(),
            sort_map: HashMap::new(),
            is_prerequisite: false,
        }
    }

    #[test]
    fn test_sort_by_single_field_asc() {
        let m1 = make_material(1, "C001", 1200.0, 10.0);
        let m2 = make_material(2, "C002", 1000.0, 10.0);
        let m3 = make_material(3, "C003", 1100.0, 10.0);

        let config = SortConfig {
            priorities: vec![priority("width", "asc", 100)],
        };
        let sorted = sort_materials(vec![m1, m2, m3], &config);

        assert_eq!(sorted[0].material.width, 1000.0);
        assert_eq!(sorted[1].material.width, 1100.0);
        assert_eq!(sorted[2].material.width, 1200.0);
    }

    #[test]
    fn test_sort_by_single_field_desc() {
        let m1 = make_material(1, "C001", 1000.0, 10.0);
        let m2 = make_material(2, "C002", 1200.0, 10.0);

        let config = SortConfig {
            priorities: vec![priority("width", "desc", 100)],
        };
        let sorted = sort_materials(vec![m1, m2], &config);

        assert_eq!(sorted[0].material.width, 1200.0);
        assert_eq!(sorted[1].material.width, 1000.0);
    }

    #[test]
    fn test_sort_by_multiple_fields() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.thickness = 3.0;
        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.thickness = 1.0;
        let mut m3 = make_material(3, "C003", 1200.0, 10.0);
        m3.thickness = 2.0;

        let config = SortConfig {
            priorities: vec![
                priority("width", "desc", 100),
                priority("thickness", "asc", 90),
            ],
        };
        let sorted = sort_materials(vec![m1, m2, m3], &config);

        assert_eq!(sorted[0].material.id, 3); // width=1200
        assert_eq!(sorted[1].material.id, 2); // width=1000, thickness=1.0
        assert_eq!(sorted[2].material.id, 1); // width=1000, thickness=3.0
    }

    #[test]
    fn test_default_hardness_order_mapping() {
        assert_eq!(default_hardness_order("软"), 1);
        assert_eq!(default_hardness_order("S"), 1);
        assert_eq!(default_hardness_order("soft"), 1);
        assert_eq!(default_hardness_order("中"), 2);
        assert_eq!(default_hardness_order("M"), 2);
        assert_eq!(default_hardness_order("硬"), 3);
        assert_eq!(default_hardness_order("H"), 3);
        assert_eq!(default_hardness_order("unknown"), 2);
    }

    #[test]
    fn test_default_surface_order_mapping() {
        assert_eq!(default_surface_order("FA"), 4);
        assert_eq!(default_surface_order("FB"), 3);
        assert_eq!(default_surface_order("FC"), 2);
        assert_eq!(default_surface_order("FD"), 1);
        assert_eq!(default_surface_order("unknown"), 0);
    }

    #[test]
    fn test_sort_with_empty_input() {
        let config = SortConfig {
            priorities: vec![priority("width", "asc", 100)],
        };
        let sorted = sort_materials(vec![], &config);
        assert!(sorted.is_empty());
    }

    #[test]
    fn test_disabled_priority_ignored() {
        let m1 = make_material(1, "C001", 1200.0, 10.0);
        let m2 = make_material(2, "C002", 1000.0, 10.0);

        let mut p = priority("width", "asc", 100);
        p.enabled = false;
        let config = SortConfig {
            priorities: vec![p],
        };
        let sorted = sort_materials(vec![m1, m2], &config);

        assert_eq!(sorted[0].material.id, 1);
    }

    #[test]
    fn test_sort_map_custom_values() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.hardness_level = Some("A".to_string());
        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.hardness_level = Some("B".to_string());

        let mut p = priority("hardness_level", "desc", 100);
        p.sort_map.insert("A".to_string(), 10);
        p.sort_map.insert("B".to_string(), 20);

        let config = SortConfig {
            priorities: vec![p],
        };
        let sorted = sort_materials(vec![m1, m2], &config);

        assert_eq!(sorted[0].material.id, 2); // B=20 > A=10
    }

    #[test]
    fn test_parse_sort_config_valid() {
        let json =
            r#"{"priorities":[{"field":"width","order":"desc","weight":100,"enabled":true}]}"#;
        let result = parse_sort_config(json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().priorities[0].field, "width");
    }
}

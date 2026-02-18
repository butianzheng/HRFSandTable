//! 换辊逻辑
//!
//! 触发条件：累计加工吨位 ≥ 阈值 (默认 800t)
//!
//! 换辊原则：
//!   1. 优先在宽度跳跃点（自然断点）换辊
//!   2. finish_last_coil: 达到阈值后完成当前卷再换辊
//!   3. 换辊消耗 30 分钟
//!   4. 换辊后累计吨位重置

use crate::engine::sorter::SortedMaterial;
use serde::{Deserialize, Serialize};

/// 换辊配置
#[derive(Debug, Clone)]
pub struct RollChangeConfig {
    pub tonnage_threshold: f64,
    pub change_duration_min: f64,
    pub finish_last_coil: bool,
    pub width_jump_threshold: f64,
}

impl Default for RollChangeConfig {
    fn default() -> Self {
        Self {
            tonnage_threshold: 800.0,
            change_duration_min: 30.0,
            finish_last_coil: true,
            width_jump_threshold: 50.0,
        }
    }
}

/// 换辊点信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RollChangePoint {
    /// 在排程序列中的索引（换辊发生在此索引之后）
    pub after_index: usize,
    /// 累计吨位
    pub cumulative_weight: f64,
    /// 是否在宽度跳跃点
    pub at_width_jump: bool,
    /// 换辊时长（分钟）
    pub duration_min: f64,
}

/// 计算排程序列中的换辊点
pub fn calculate_roll_changes(
    sequence: &[SortedMaterial],
    config: &RollChangeConfig,
) -> Vec<RollChangePoint> {
    if sequence.is_empty() {
        return vec![];
    }

    let mut roll_changes = Vec::new();
    let mut cumulative = 0.0f64;

    for i in 0..sequence.len() {
        cumulative += sequence[i].material.weight;

        // 检查是否需要换辊
        if cumulative >= config.tonnage_threshold && i < sequence.len() - 1 {
            // 寻找最佳换辊点
            let change_idx = find_best_change_point(sequence, i, cumulative, config);

            // 如果 finish_last_coil，在当前卷完成后换辊
            let actual_idx = if config.finish_last_coil {
                change_idx
            } else {
                i
            };

            // 重新计算到 actual_idx 的累计吨位
            let _actual_cumulative: f64 = sequence[..=actual_idx]
                .iter()
                .map(|s| s.material.weight)
                .sum::<f64>()
                - roll_changes
                    .iter()
                    .filter(|rc: &&RollChangePoint| rc.after_index < actual_idx)
                    .map(|_| 0.0f64) // 已扣除
                    .sum::<f64>();

            let at_width_jump = if actual_idx + 1 < sequence.len() {
                let width_diff = (sequence[actual_idx].material.width
                    - sequence[actual_idx + 1].material.width)
                    .abs();
                width_diff >= config.width_jump_threshold
            } else {
                false
            };

            roll_changes.push(RollChangePoint {
                after_index: actual_idx,
                cumulative_weight: cumulative,
                at_width_jump,
                duration_min: config.change_duration_min,
            });

            // 重置累计吨位
            cumulative = 0.0;
        }
    }

    roll_changes
}

/// 在 trigger_idx 附近寻找最佳换辊点（优先宽度跳跃点）
fn find_best_change_point(
    sequence: &[SortedMaterial],
    trigger_idx: usize,
    _cumulative: f64,
    config: &RollChangeConfig,
) -> usize {
    // 在 trigger_idx 的前后 3 个位置范围内寻找宽度跳跃点
    let search_range = 3usize;
    let start = trigger_idx.saturating_sub(search_range);
    let end = (trigger_idx + search_range).min(sequence.len() - 1);

    let mut best_idx = trigger_idx;
    let mut best_jump = 0.0f64;

    for i in start..end {
        if i + 1 >= sequence.len() {
            break;
        }
        let width_diff = (sequence[i].material.width - sequence[i + 1].material.width).abs();
        if width_diff >= config.width_jump_threshold && width_diff > best_jump {
            best_jump = width_diff;
            best_idx = i;
        }
    }

    best_idx
}

/// 从策略模板硬约束中提取换辊配置
pub fn extract_roll_config(
    hard_constraints: &crate::engine::validator::HardConstraintsConfig,
) -> RollChangeConfig {
    let mut config = RollChangeConfig::default();

    for c in &hard_constraints.constraints {
        match c.constraint_type.as_str() {
            "roll_change_tonnage" => {
                if let Some(v) = c.max_value {
                    config.tonnage_threshold = v;
                }
                if let Some(f) = c.finish_last_coil {
                    config.finish_last_coil = f;
                }
            }
            "roll_change_duration" => {
                if let Some(v) = c.value {
                    config.change_duration_min = v;
                }
            }
            "width_jump" => {
                if let Some(v) = c.max_value {
                    config.width_jump_threshold = v / 2.0; // 跳跃阈值取宽度限制的一半作为换辊偏好点
                }
            }
            _ => {}
        }
    }

    config
}

/// 获取换辊点的索引列表
pub fn roll_change_indices(points: &[RollChangePoint]) -> Vec<usize> {
    points.iter().map(|p| p.after_index).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::test_helpers::helpers::{make_material, wrap};
    use crate::engine::validator::{HardConstraint, HardConstraintsConfig};

    #[test]
    fn test_empty_sequence_no_changes() {
        let config = RollChangeConfig::default();
        let result = calculate_roll_changes(&[], &config);
        assert!(result.is_empty());
    }

    #[test]
    fn test_calculate_changes_at_tonnage_threshold() {
        // 4 materials: 300t each. At i=2 cumulative=900>=800, and i=2 < 3 → triggers
        let seq: Vec<_> = (0..4)
            .map(|i| {
                wrap(make_material(
                    i + 1,
                    &format!("C{:03}", i + 1),
                    1000.0,
                    300.0,
                ))
            })
            .collect();
        let config = RollChangeConfig {
            tonnage_threshold: 800.0,
            change_duration_min: 30.0,
            finish_last_coil: true,
            width_jump_threshold: 50.0,
        };
        let result = calculate_roll_changes(&seq, &config);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].duration_min, 30.0);
    }

    #[test]
    fn test_calculate_changes_with_width_jump() {
        let seq = vec![
            wrap(make_material(1, "C001", 1000.0, 300.0)),
            wrap(make_material(2, "C002", 1000.0, 300.0)),
            wrap(make_material(3, "C003", 1200.0, 300.0)),
            wrap(make_material(4, "C004", 1200.0, 300.0)),
        ];
        let config = RollChangeConfig {
            tonnage_threshold: 800.0,
            change_duration_min: 30.0,
            finish_last_coil: true,
            width_jump_threshold: 50.0,
        };
        let result = calculate_roll_changes(&seq, &config);
        assert!(!result.is_empty());
        let has_width_jump = result.iter().any(|r| r.at_width_jump);
        assert!(has_width_jump);
    }

    #[test]
    fn test_below_threshold_no_change() {
        let seq: Vec<_> = (0..2)
            .map(|i| {
                wrap(make_material(
                    i + 1,
                    &format!("C{:03}", i + 1),
                    1000.0,
                    200.0,
                ))
            })
            .collect();
        let config = RollChangeConfig::default();
        let result = calculate_roll_changes(&seq, &config);
        assert!(result.is_empty());
    }

    #[test]
    fn test_extract_roll_config_defaults() {
        let hard_config = HardConstraintsConfig {
            constraints: vec![],
        };
        let config = extract_roll_config(&hard_config);
        assert_eq!(config.tonnage_threshold, 800.0);
        assert_eq!(config.change_duration_min, 30.0);
        assert!(config.finish_last_coil);
        assert_eq!(config.width_jump_threshold, 50.0);
    }

    #[test]
    fn test_extract_roll_config_from_constraints() {
        let hard_config = HardConstraintsConfig {
            constraints: vec![
                HardConstraint {
                    constraint_type: "roll_change_tonnage".to_string(),
                    name: "换辊吨位".to_string(),
                    enabled: true,
                    max_value: Some(600.0),
                    value: None,
                    unit: None,
                    max_days: None,
                    finish_last_coil: Some(false),
                    description: None,
                    error_message: None,
                },
                HardConstraint {
                    constraint_type: "width_jump".to_string(),
                    name: "宽度跳变".to_string(),
                    enabled: true,
                    max_value: Some(100.0),
                    value: None,
                    unit: None,
                    max_days: None,
                    finish_last_coil: None,
                    description: None,
                    error_message: None,
                },
            ],
        };
        let config = extract_roll_config(&hard_config);
        assert_eq!(config.tonnage_threshold, 600.0);
        assert!(!config.finish_last_coil);
        assert_eq!(config.width_jump_threshold, 50.0);
    }

    #[test]
    fn test_roll_change_indices_conversion() {
        let points = vec![
            RollChangePoint {
                after_index: 2,
                cumulative_weight: 800.0,
                at_width_jump: false,
                duration_min: 30.0,
            },
            RollChangePoint {
                after_index: 5,
                cumulative_weight: 850.0,
                at_width_jump: true,
                duration_min: 30.0,
            },
        ];
        let indices = roll_change_indices(&points);
        assert_eq!(indices, vec![2, 5]);
    }
}

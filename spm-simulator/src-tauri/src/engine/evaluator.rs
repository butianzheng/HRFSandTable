//! 方案评估器 — 多维评分
//!
//! 5 个评价指标（权重可配）：
//!   1. width_jump_count   (30) — 宽度跳跃次数（越少越好）
//!   2. roll_change_count  (25) — 换辊次数（越少越好）
//!   3. capacity_utilization (20) — 产能利用率（越高越好）
//!   4. tempered_ratio     (15) — 适温材料比例
//!   5. urgent_completion  (10) — 紧急订单完成率

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::engine::roll_change::RollChangePoint;
use crate::engine::sorter::SortedMaterial;
use crate::engine::validator::{ConstraintViolation, SoftScoreDetail};

/// 评分权重配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalWeightsConfig {
    pub weights: HashMap<String, EvalWeight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalWeight {
    pub weight: i32,
    #[serde(default)]
    pub description: Option<String>,
}

/// 方案评估结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalResult {
    /// 综合得分 (0-100)
    pub score_overall: i32,
    /// 序列合理性得分
    pub score_sequence: i32,
    /// 交期满足度得分
    pub score_delivery: i32,
    /// 效率得分
    pub score_efficiency: i32,
    /// 各指标明细
    pub metrics: EvalMetrics,
    /// 风险统计
    pub risk_high: i32,
    pub risk_medium: i32,
    pub risk_low: i32,
    /// 风险摘要 JSON
    pub risk_summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvalMetrics {
    pub total_count: usize,
    pub total_weight: f64,
    pub roll_change_count: usize,
    pub width_jump_count: usize,
    pub steel_grade_switch_count: usize,
    pub capacity_utilization: f64,
    pub tempered_ratio: f64,
    pub urgent_completion_rate: f64,
    pub overdue_count: usize,
    pub soft_score_adjust: i32,
}

/// 对排程结果执行评估
pub fn evaluate_plan(
    sequence: &[SortedMaterial],
    roll_changes: &[RollChangePoint],
    violations: &[ConstraintViolation],
    soft_details: &[SoftScoreDetail],
    soft_adjust: i32,
    eval_config: &EvalWeightsConfig,
    shift_capacity: f64,
    plan_days: i32,
) -> EvalResult {
    let total_count = sequence.len();
    let total_weight: f64 = sequence.iter().map(|s| s.material.weight).sum();
    let roll_change_count = roll_changes.len();

    // 计算宽度跳跃次数
    let mut width_jump_count = 0;
    for i in 1..sequence.len() {
        let diff = (sequence[i].material.width - sequence[i - 1].material.width).abs();
        if diff > 100.0 {
            width_jump_count += 1;
        }
    }

    // 钢种切换次数
    let mut steel_grade_switches = 0;
    for i in 1..sequence.len() {
        if sequence[i].material.steel_grade != sequence[i - 1].material.steel_grade {
            steel_grade_switches += 1;
        }
    }

    // 产能利用率（基于方案总产能 = 2班/日 * shift_capacity * plan_days）
    let plan_days_f = (plan_days.max(1)) as f64;
    let total_capacity = shift_capacity * 2.0 * plan_days_f;
    let capacity_utilization = if total_capacity > 0.0 {
        (total_weight / total_capacity * 100.0).min(100.0)
    } else {
        0.0
    };

    // 适温材料比例
    let tempered_count = sequence
        .iter()
        .filter(|s| s.material.temp_status.as_deref() == Some("ready"))
        .count();
    let tempered_ratio = if total_count > 0 {
        tempered_count as f64 / total_count as f64 * 100.0
    } else {
        0.0
    };

    // 逾期/紧急订单
    let now = chrono::Utc::now();
    let overdue_count = sequence
        .iter()
        .filter(|s| s.material.due_date.map(|d| d < now).unwrap_or(false))
        .count();
    // 紧急订单完成率: 所有逾期和 D+7 内的材料占比
    let urgent_total = sequence
        .iter()
        .filter(|s| {
            s.material
                .due_date
                .map(|d| {
                    let diff = (d.date_naive() - now.date_naive()).num_days();
                    diff <= 7
                })
                .unwrap_or(false)
        })
        .count();
    let urgent_completion = if urgent_total > 0 { 100.0 } else { 0.0 };

    let metrics = EvalMetrics {
        total_count,
        total_weight,
        roll_change_count,
        width_jump_count,
        steel_grade_switch_count: steel_grade_switches,
        capacity_utilization,
        tempered_ratio,
        urgent_completion_rate: urgent_completion,
        overdue_count,
        soft_score_adjust: soft_adjust,
    };

    // 按权重计算各维度得分
    let w = |key: &str| -> i32 { eval_config.weights.get(key).map(|w| w.weight).unwrap_or(0) };

    // 各指标得分 (0-100)
    // 宽度跳跃: 跳跃越少越好
    let max_possible_jumps = if total_count > 1 { total_count - 1 } else { 1 };
    let wj_score = ((1.0 - width_jump_count as f64 / max_possible_jumps as f64) * 100.0) as i32;

    // 换辊次数: 越少越好 (假设理想换辊次数 = total_weight / threshold)
    let ideal_changes = (total_weight / 800.0).ceil() as usize;
    let rc_score = if ideal_changes == 0 {
        100
    } else {
        (100.0
            * (1.0
                - ((roll_change_count as f64 - ideal_changes as f64).abs() / ideal_changes as f64)
                    .min(1.0))) as i32
    };

    let cu_score = capacity_utilization as i32;
    let tr_score = tempered_ratio as i32;
    let uc_score = urgent_completion as i32;

    // 加权综合
    let total_weight_sum = w("width_jump_count")
        + w("roll_change_count")
        + w("capacity_utilization")
        + w("tempered_ratio")
        + w("urgent_completion");

    let score_overall = if total_weight_sum > 0 {
        (wj_score * w("width_jump_count")
            + rc_score * w("roll_change_count")
            + cu_score * w("capacity_utilization")
            + tr_score * w("tempered_ratio")
            + uc_score * w("urgent_completion"))
            / total_weight_sum
    } else {
        50
    };

    // 子维度得分
    let score_sequence = (wj_score + rc_score) / 2;
    let score_delivery = uc_score;
    let score_efficiency = cu_score;

    // 风险统计
    let risk_high = violations.iter().filter(|v| v.severity == "high").count() as i32;
    let risk_medium = violations.iter().filter(|v| v.severity == "medium").count() as i32;
    let risk_low = violations.iter().filter(|v| v.severity == "low").count() as i32;

    let risk_summary = serde_json::json!({
        "violations": violations,
        "soft_details": soft_details,
    })
    .to_string();

    EvalResult {
        score_overall: score_overall.clamp(0, 100),
        score_sequence: score_sequence.clamp(0, 100),
        score_delivery: score_delivery.clamp(0, 100),
        score_efficiency: score_efficiency.clamp(0, 100),
        metrics,
        risk_high,
        risk_medium,
        risk_low,
        risk_summary,
    }
}

/// 解析评估权重配置 JSON
pub fn parse_eval_weights(json_str: &str) -> Result<EvalWeightsConfig, crate::AppError> {
    serde_json::from_str(json_str)
        .map_err(|e| crate::AppError::Internal(format!("解析评估权重配置失败: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::test_helpers::helpers::{make_material, wrap};

    fn default_eval_config() -> EvalWeightsConfig {
        let mut weights = HashMap::new();
        weights.insert(
            "width_jump_count".into(),
            EvalWeight {
                weight: 30,
                description: None,
            },
        );
        weights.insert(
            "roll_change_count".into(),
            EvalWeight {
                weight: 25,
                description: None,
            },
        );
        weights.insert(
            "capacity_utilization".into(),
            EvalWeight {
                weight: 20,
                description: None,
            },
        );
        weights.insert(
            "tempered_ratio".into(),
            EvalWeight {
                weight: 15,
                description: None,
            },
        );
        weights.insert(
            "urgent_completion".into(),
            EvalWeight {
                weight: 10,
                description: None,
            },
        );
        EvalWeightsConfig { weights }
    }

    #[test]
    fn test_evaluate_plan_no_violations() {
        // 2 materials, same width, no violations
        let seq = vec![
            wrap(make_material(1, "C001", 1000.0, 500.0)),
            wrap(make_material(2, "C002", 1000.0, 500.0)),
        ];
        let result = evaluate_plan(&seq, &[], &[], &[], 0, &default_eval_config(), 1200.0, 1);

        assert!(result.score_overall >= 0 && result.score_overall <= 100);
        assert_eq!(result.risk_high, 0);
        assert_eq!(result.risk_medium, 0);
        assert_eq!(result.metrics.width_jump_count, 0);
    }

    #[test]
    fn test_evaluate_plan_with_violations() {
        let seq = vec![
            wrap(make_material(1, "C001", 1000.0, 500.0)),
            wrap(make_material(2, "C002", 1000.0, 500.0)),
        ];
        let violations = vec![ConstraintViolation {
            constraint_type: "width_jump".into(),
            severity: "high".into(),
            message: "test".into(),
            material_index: 0,
            material_id: 1,
        }];
        let result = evaluate_plan(
            &seq,
            &[],
            &violations,
            &[],
            0,
            &default_eval_config(),
            1200.0,
            1,
        );
        assert_eq!(result.risk_high, 1);
    }

    #[test]
    fn test_width_jump_count_at_100mm_threshold() {
        let seq = vec![
            wrap(make_material(1, "C001", 1000.0, 500.0)),
            wrap(make_material(2, "C002", 1100.0, 500.0)), // 100mm, not > 100 → no count
            wrap(make_material(3, "C003", 1201.0, 500.0)), // 101mm > 100 → count
        ];
        let result = evaluate_plan(&seq, &[], &[], &[], 0, &default_eval_config(), 1200.0, 1);
        assert_eq!(result.metrics.width_jump_count, 1);
    }

    #[test]
    fn test_capacity_utilization_calculation() {
        // daily=2400, total_weight=1200 → utilization = 50%
        let seq = vec![
            wrap(make_material(1, "C001", 1000.0, 600.0)),
            wrap(make_material(2, "C002", 1000.0, 600.0)),
        ];
        let result = evaluate_plan(&seq, &[], &[], &[], 0, &default_eval_config(), 1200.0, 1);
        assert!((result.metrics.capacity_utilization - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_tempered_ratio_calculation() {
        let m1 = make_material(1, "C001", 1000.0, 500.0); // temp_status=ready
        let mut m2 = make_material(2, "C002", 1000.0, 500.0);
        m2.temp_status = Some("waiting".to_string());

        let seq = vec![wrap(m1), wrap(m2)];
        let result = evaluate_plan(&seq, &[], &[], &[], 0, &default_eval_config(), 1200.0, 1);
        assert!((result.metrics.tempered_ratio - 50.0).abs() < 0.1);
    }

    #[test]
    fn test_risk_level_classification() {
        let seq = vec![wrap(make_material(1, "C001", 1000.0, 500.0))];
        let violations = vec![
            ConstraintViolation {
                constraint_type: "a".into(),
                severity: "high".into(),
                message: "".into(),
                material_index: 0,
                material_id: 1,
            },
            ConstraintViolation {
                constraint_type: "b".into(),
                severity: "medium".into(),
                message: "".into(),
                material_index: 0,
                material_id: 1,
            },
            ConstraintViolation {
                constraint_type: "c".into(),
                severity: "medium".into(),
                message: "".into(),
                material_index: 0,
                material_id: 1,
            },
            ConstraintViolation {
                constraint_type: "d".into(),
                severity: "low".into(),
                message: "".into(),
                material_index: 0,
                material_id: 1,
            },
        ];
        let result = evaluate_plan(
            &seq,
            &[],
            &violations,
            &[],
            0,
            &default_eval_config(),
            1200.0,
            1,
        );
        assert_eq!(result.risk_high, 1);
        assert_eq!(result.risk_medium, 2);
        assert_eq!(result.risk_low, 1);
    }

    #[test]
    fn test_parse_eval_weights_valid() {
        let json = r#"{"weights":{"width_jump_count":{"weight":30}}}"#;
        let result = parse_eval_weights(json);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().weights["width_jump_count"].weight, 30);
    }
}

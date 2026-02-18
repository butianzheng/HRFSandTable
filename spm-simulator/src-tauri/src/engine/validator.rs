//! 约束校验器 — 硬约束 + 软约束评分
//!
//! 硬约束（违规即标记风险）：
//!   1. temp_status_filter — 只有适温材料可排程
//!   2. width_jump — 相邻宽度差 ≤ 100mm
//!   3. roll_change_tonnage — 累计吨位 ≤ 800t (在换辊模块中处理)
//!   4. roll_change_duration — 换辊时长 30min (在换辊模块中处理)
//!   5. overdue_priority — 超期材料强制优先
//!   6. shift_capacity — 班次产能 ≤ 1200t (在排程引擎中实时控制 + risk.rs 逐班次校验)
//!
//! 软约束（影响评分，不阻止排程）：
//!   1. steel_grade_switch — 钢种切换惩罚 -10
//!   2. thickness_jump — 厚度跳跃惩罚 -5
//!   3. surface_after_roll_change — 换辊后高表面奖励 +20
//!   4. contract_grouping — 合同集中奖励 +10

use crate::engine::sorter::SortedMaterial;
use serde::{Deserialize, Serialize};

// ─── 硬约束配置 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardConstraintsConfig {
    pub constraints: Vec<HardConstraint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardConstraint {
    #[serde(rename = "type")]
    pub constraint_type: String,
    pub name: String,
    pub enabled: bool,
    #[serde(default)]
    pub max_value: Option<f64>,
    #[serde(default)]
    pub value: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub max_days: Option<i32>,
    #[serde(default)]
    pub finish_last_coil: Option<bool>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

// ─── 软约束配置 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftConstraintsConfig {
    pub constraints: Vec<SoftConstraint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftConstraint {
    #[serde(rename = "type")]
    pub constraint_type: String,
    pub name: String,
    pub enabled: bool,
    #[serde(default)]
    pub penalty: Option<i32>,
    #[serde(default)]
    pub bonus: Option<i32>,
    #[serde(default)]
    pub threshold: Option<f64>,
    #[serde(default)]
    pub unit: Option<String>,
    #[serde(default)]
    pub target_levels: Option<Vec<String>>,
    #[serde(default)]
    pub within_coils: Option<i32>,
}

// ─── 校验结果 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub violations: Vec<ConstraintViolation>,
    pub soft_score_adjust: i32,
    pub soft_details: Vec<SoftScoreDetail>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintViolation {
    pub constraint_type: String,
    pub severity: String, // "high" | "medium" | "low"
    pub message: String,
    pub material_index: usize,
    pub material_id: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SoftScoreDetail {
    pub constraint_type: String,
    pub adjust: i32,
    pub count: usize,
    pub description: String,
}

/// 对排程序列执行硬约束校验
pub fn validate_hard_constraints(
    sequence: &[SortedMaterial],
    config: &HardConstraintsConfig,
) -> Vec<ConstraintViolation> {
    let mut violations = Vec::new();

    for constraint in &config.constraints {
        if !constraint.enabled {
            continue;
        }
        match constraint.constraint_type.as_str() {
            "temp_status_filter" => {
                check_temp_status(sequence, &mut violations);
            }
            "width_jump" => {
                let max = constraint.max_value.unwrap_or(100.0);
                check_width_jump(sequence, max, &mut violations);
            }
            "overdue_priority" => {
                check_overdue_priority(sequence, &mut violations);
            }
            // roll_change_tonnage 和 roll_change_duration 在换辊模块中处理
            _ => {}
        }
    }

    violations
}

/// 计算软约束评分调整
pub fn evaluate_soft_constraints(
    sequence: &[SortedMaterial],
    config: &SoftConstraintsConfig,
    roll_change_indices: &[usize],
) -> (i32, Vec<SoftScoreDetail>) {
    let mut total_adjust = 0i32;
    let mut details = Vec::new();

    for constraint in &config.constraints {
        if !constraint.enabled {
            continue;
        }
        match constraint.constraint_type.as_str() {
            "steel_grade_switch" => {
                let penalty = constraint.penalty.unwrap_or(10);
                let count = count_steel_grade_switches(sequence);
                let adjust = -(penalty * count as i32);
                total_adjust += adjust;
                details.push(SoftScoreDetail {
                    constraint_type: "steel_grade_switch".into(),
                    adjust,
                    count,
                    description: format!("钢种切换{}次, 每次-{}分", count, penalty),
                });
            }
            "thickness_jump" => {
                let threshold = constraint.threshold.unwrap_or(1.0);
                let penalty = constraint.penalty.unwrap_or(5);
                let count = count_thickness_jumps(sequence, threshold);
                let adjust = -(penalty * count as i32);
                total_adjust += adjust;
                details.push(SoftScoreDetail {
                    constraint_type: "thickness_jump".into(),
                    adjust,
                    count,
                    description: format!(
                        "厚度跳跃(>{:.1}mm){}次, 每次-{}分",
                        threshold, count, penalty
                    ),
                });
            }
            "surface_after_roll_change" => {
                let bonus = constraint.bonus.unwrap_or(20);
                let target = constraint
                    .target_levels
                    .clone()
                    .unwrap_or_else(|| vec!["FA".into(), "FB".into()]);
                let within = constraint.within_coils.unwrap_or(5) as usize;
                let count = count_surface_bonus(sequence, roll_change_indices, &target, within);
                let adjust = bonus * count as i32;
                total_adjust += adjust;
                details.push(SoftScoreDetail {
                    constraint_type: "surface_after_roll_change".into(),
                    adjust,
                    count,
                    description: format!("换辊后{}卷内高表面{}次, 每次+{}分", within, count, bonus),
                });
            }
            "contract_grouping" => {
                let bonus = constraint.bonus.unwrap_or(10);
                let count = count_contract_groups(sequence);
                let adjust = bonus * count as i32;
                total_adjust += adjust;
                details.push(SoftScoreDetail {
                    constraint_type: "contract_grouping".into(),
                    adjust,
                    count,
                    description: format!("合同集中{}组, 每组+{}分", count, bonus),
                });
            }
            _ => {}
        }
    }

    (total_adjust, details)
}

// ─── 硬约束检查函数 ───

fn check_temp_status(sequence: &[SortedMaterial], violations: &mut Vec<ConstraintViolation>) {
    for (i, sm) in sequence.iter().enumerate() {
        let status = sm.material.temp_status.as_deref().unwrap_or("waiting");
        // 滚动适温材料（有 earliest_schedule_date）视为合法，不报违规
        if status != "ready" && sm.earliest_schedule_date.is_none() {
            violations.push(ConstraintViolation {
                constraint_type: "temp_status_filter".into(),
                severity: "high".into(),
                message: format!("材料{}未适温, 不应进入排程", sm.material.coil_id),
                material_index: i,
                material_id: sm.material.id,
            });
        }
    }
}

fn check_width_jump(
    sequence: &[SortedMaterial],
    max_jump: f64,
    violations: &mut Vec<ConstraintViolation>,
) {
    for i in 1..sequence.len() {
        let prev_width = sequence[i - 1].material.width;
        let curr_width = sequence[i].material.width;
        let jump = (prev_width - curr_width).abs();
        if jump > max_jump {
            violations.push(ConstraintViolation {
                constraint_type: "width_jump".into(),
                severity: "medium".into(),
                message: format!(
                    "材料{}与{}宽度差{:.0}mm > {:.0}mm限制",
                    sequence[i - 1].material.coil_id,
                    sequence[i].material.coil_id,
                    jump,
                    max_jump,
                ),
                material_index: i,
                material_id: sequence[i].material.id,
            });
        }
    }
}

fn check_overdue_priority(sequence: &[SortedMaterial], violations: &mut Vec<ConstraintViolation>) {
    // 检查是否有逾期材料被排在非优先位置
    let now = chrono::Utc::now();
    let mut last_overdue_idx: Option<usize> = None;
    let mut first_non_overdue_idx: Option<usize> = None;

    for (i, sm) in sequence.iter().enumerate() {
        let is_overdue = sm.material.due_date.map(|d| d < now).unwrap_or(false);

        if is_overdue {
            last_overdue_idx = Some(i);
        } else if first_non_overdue_idx.is_none() {
            first_non_overdue_idx = Some(i);
        }
    }

    // 如果有逾期材料排在非逾期材料之后
    if let (Some(last_ov), Some(first_non)) = (last_overdue_idx, first_non_overdue_idx) {
        if last_ov > first_non {
            violations.push(ConstraintViolation {
                constraint_type: "overdue_priority".into(),
                severity: "high".into(),
                message: "存在逾期材料未排在优先位置".into(),
                material_index: last_ov,
                material_id: sequence[last_ov].material.id,
            });
        }
    }
}

// ─── 软约束统计函数 ───

fn count_steel_grade_switches(sequence: &[SortedMaterial]) -> usize {
    let mut count = 0;
    for i in 1..sequence.len() {
        if sequence[i].material.steel_grade != sequence[i - 1].material.steel_grade {
            count += 1;
        }
    }
    count
}

fn count_thickness_jumps(sequence: &[SortedMaterial], threshold: f64) -> usize {
    let mut count = 0;
    for i in 1..sequence.len() {
        let diff = (sequence[i].material.thickness - sequence[i - 1].material.thickness).abs();
        if diff > threshold {
            count += 1;
        }
    }
    count
}

fn count_surface_bonus(
    sequence: &[SortedMaterial],
    roll_change_indices: &[usize],
    target_levels: &[String],
    within_coils: usize,
) -> usize {
    let mut count = 0;
    for &rc_idx in roll_change_indices {
        let start = rc_idx + 1;
        let end = (rc_idx + 1 + within_coils).min(sequence.len());
        for item in sequence.iter().take(end).skip(start) {
            let level = item.material.surface_level.as_deref().unwrap_or("");
            if target_levels.iter().any(|t| t == level) {
                count += 1;
            }
        }
    }
    count
}

fn count_contract_groups(sequence: &[SortedMaterial]) -> usize {
    if sequence.is_empty() {
        return 0;
    }
    let mut groups = 0;
    let mut current_contract = sequence[0].material.contract_no.as_deref().unwrap_or("");
    let mut group_size = 1;

    for item in sequence.iter().skip(1) {
        let contract = item.material.contract_no.as_deref().unwrap_or("");
        if !contract.is_empty() && contract == current_contract {
            group_size += 1;
        } else {
            if group_size >= 2 {
                groups += 1;
            }
            current_contract = contract;
            group_size = 1;
        }
    }
    if group_size >= 2 {
        groups += 1;
    }
    groups
}

/// 解析硬约束配置 JSON
pub fn parse_hard_constraints(json_str: &str) -> Result<HardConstraintsConfig, crate::AppError> {
    serde_json::from_str(json_str)
        .map_err(|e| crate::AppError::Internal(format!("解析硬约束配置失败: {}", e)))
}

/// 解析软约束配置 JSON
pub fn parse_soft_constraints(json_str: &str) -> Result<SoftConstraintsConfig, crate::AppError> {
    serde_json::from_str(json_str)
        .map_err(|e| crate::AppError::Internal(format!("解析软约束配置失败: {}", e)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::material;
    use chrono::{Duration, Utc};

    fn make_material(id: i32, coil_id: &str, width: f64, weight: f64) -> material::Model {
        material::Model {
            id,
            coil_id: coil_id.to_string(),
            contract_no: None,
            customer_name: None,
            customer_code: None,
            steel_grade: "Q235".to_string(),
            thickness: 2.0,
            width,
            weight,
            hardness_level: None,
            surface_level: None,
            roughness_req: None,
            elongation_req: None,
            product_type: None,
            contract_attr: None,
            contract_nature: None,
            export_flag: None,
            weekly_delivery: None,
            batch_code: None,
            coiling_time: Utc::now(),
            temp_status: Some("ready".to_string()),
            temp_wait_days: None,
            is_tempered: Some(true),
            tempered_at: None,
            storage_days: None,
            storage_loc: None,
            due_date: None,
            status: Some("active".to_string()),
            priority_auto: None,
            priority_manual_adjust: None,
            priority_final: None,
            priority_detail: None,
            priority_reason: None,
            remarks: None,
            created_at: None,
            updated_at: None,
            import_batch_id: None,
        }
    }

    fn wrap(m: material::Model) -> SortedMaterial {
        SortedMaterial {
            material: m,
            sort_keys: vec![],
            earliest_schedule_date: None,
        }
    }

    fn hard_config(constraints: Vec<HardConstraint>) -> HardConstraintsConfig {
        HardConstraintsConfig { constraints }
    }

    fn hard_constraint(ctype: &str, enabled: bool, max_value: Option<f64>) -> HardConstraint {
        HardConstraint {
            constraint_type: ctype.to_string(),
            name: ctype.to_string(),
            enabled,
            max_value,
            value: None,
            unit: None,
            max_days: None,
            finish_last_coil: None,
            description: None,
            error_message: None,
        }
    }

    // ─── 硬约束测试 ───

    #[test]
    fn test_check_temp_status_filters_non_ready() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.temp_status = Some("waiting".to_string());
        let seq = vec![wrap(m)];
        let config = hard_config(vec![hard_constraint("temp_status_filter", true, None)]);
        let violations = validate_hard_constraints(&seq, &config);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].constraint_type, "temp_status_filter");
        assert_eq!(violations[0].severity, "high");
    }

    #[test]
    fn test_check_temp_status_passes_ready() {
        let m = make_material(1, "C001", 1000.0, 10.0); // temp_status = ready
        let seq = vec![wrap(m)];
        let config = hard_config(vec![hard_constraint("temp_status_filter", true, None)]);
        let violations = validate_hard_constraints(&seq, &config);
        assert!(violations.is_empty());
    }

    #[test]
    fn test_check_width_jump_at_boundary() {
        let m1 = make_material(1, "C001", 1000.0, 10.0);
        let m2 = make_material(2, "C002", 1100.0, 10.0); // exactly 100mm jump
        let seq = vec![wrap(m1), wrap(m2)];
        let config = hard_config(vec![hard_constraint("width_jump", true, Some(100.0))]);
        let violations = validate_hard_constraints(&seq, &config);
        // 100mm == 100mm, not greater than, so no violation
        assert!(violations.is_empty());
    }

    #[test]
    fn test_check_width_jump_exceeds_threshold() {
        let m1 = make_material(1, "C001", 1000.0, 10.0);
        let m2 = make_material(2, "C002", 1101.0, 10.0); // 101mm > 100mm
        let seq = vec![wrap(m1), wrap(m2)];
        let config = hard_config(vec![hard_constraint("width_jump", true, Some(100.0))]);
        let violations = validate_hard_constraints(&seq, &config);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].constraint_type, "width_jump");
        assert_eq!(violations[0].severity, "medium");
    }

    #[test]
    fn test_check_overdue_priority_ordering() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.due_date = Some(Utc::now() + Duration::days(30)); // not overdue

        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.due_date = Some(Utc::now() - Duration::days(10)); // overdue

        // non-overdue before overdue → violation
        let seq = vec![wrap(m1), wrap(m2)];
        let config = hard_config(vec![hard_constraint("overdue_priority", true, None)]);
        let violations = validate_hard_constraints(&seq, &config);
        assert_eq!(violations.len(), 1);
        assert_eq!(violations[0].constraint_type, "overdue_priority");
    }

    #[test]
    fn test_disabled_constraint_skipped() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.temp_status = Some("waiting".to_string());
        let seq = vec![wrap(m)];
        let config = hard_config(vec![hard_constraint("temp_status_filter", false, None)]);
        let violations = validate_hard_constraints(&seq, &config);
        assert!(violations.is_empty());
    }

    // ─── 软约束测试 ───

    fn soft_config(constraints: Vec<SoftConstraint>) -> SoftConstraintsConfig {
        SoftConstraintsConfig { constraints }
    }

    fn soft_constraint(ctype: &str, penalty: Option<i32>, bonus: Option<i32>) -> SoftConstraint {
        SoftConstraint {
            constraint_type: ctype.to_string(),
            name: ctype.to_string(),
            enabled: true,
            penalty,
            bonus,
            threshold: None,
            unit: None,
            target_levels: None,
            within_coils: None,
        }
    }

    #[test]
    fn test_evaluate_soft_steel_grade_switch() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.steel_grade = "Q235".to_string();
        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.steel_grade = "Q345".to_string();
        let mut m3 = make_material(3, "C003", 1000.0, 10.0);
        m3.steel_grade = "Q345".to_string(); // same as m2

        let seq = vec![wrap(m1), wrap(m2), wrap(m3)];
        let config = soft_config(vec![soft_constraint("steel_grade_switch", Some(10), None)]);
        let (adjust, details) = evaluate_soft_constraints(&seq, &config, &[]);
        assert_eq!(adjust, -10); // 1 switch * -10
        assert_eq!(details[0].count, 1);
    }

    #[test]
    fn test_evaluate_soft_thickness_jump() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.thickness = 2.0;
        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.thickness = 3.5; // diff=1.5 > 1.0 threshold

        let seq = vec![wrap(m1), wrap(m2)];
        let mut sc = soft_constraint("thickness_jump", Some(5), None);
        sc.threshold = Some(1.0);
        let config = soft_config(vec![sc]);
        let (adjust, details) = evaluate_soft_constraints(&seq, &config, &[]);
        assert_eq!(adjust, -5); // 1 jump * -5
        assert_eq!(details[0].count, 1);
    }

    #[test]
    fn test_evaluate_soft_surface_bonus() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.surface_level = Some("FC".to_string());
        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.surface_level = Some("FA".to_string()); // target level

        let seq = vec![wrap(m1), wrap(m2)];
        let mut sc = soft_constraint("surface_after_roll_change", None, Some(20));
        sc.target_levels = Some(vec!["FA".to_string(), "FB".to_string()]);
        sc.within_coils = Some(5);
        let config = soft_config(vec![sc]);
        // roll change at index 0: check indices 1..min(6, 2)=2 → m2 is FA → count=1
        let (adjust, details) = evaluate_soft_constraints(&seq, &config, &[0]);
        assert_eq!(adjust, 20);
        assert_eq!(details[0].count, 1);
    }

    #[test]
    fn test_evaluate_soft_contract_grouping() {
        let mut m1 = make_material(1, "C001", 1000.0, 10.0);
        m1.contract_no = Some("CT001".to_string());
        let mut m2 = make_material(2, "C002", 1000.0, 10.0);
        m2.contract_no = Some("CT001".to_string()); // same contract → 1 group
        let mut m3 = make_material(3, "C003", 1000.0, 10.0);
        m3.contract_no = Some("CT002".to_string()); // different contract

        let seq = vec![wrap(m1), wrap(m2), wrap(m3)];
        let config = soft_config(vec![soft_constraint("contract_grouping", None, Some(10))]);
        let (adjust, details) = evaluate_soft_constraints(&seq, &config, &[]);
        assert_eq!(adjust, 10); // 1 group * +10
        assert_eq!(details[0].count, 1);
    }

    // ─── JSON 解析测试 ───

    #[test]
    fn test_parse_hard_constraints_valid_json() {
        let json = r#"{"constraints":[{"type":"width_jump","name":"宽度跳变","enabled":true,"max_value":100.0}]}"#;
        let result = parse_hard_constraints(json);
        assert!(result.is_ok());
        let config = result.unwrap();
        assert_eq!(config.constraints.len(), 1);
        assert_eq!(config.constraints[0].constraint_type, "width_jump");
    }

    #[test]
    fn test_parse_hard_constraints_invalid_json() {
        let json = "not valid json";
        let result = parse_hard_constraints(json);
        assert!(result.is_err());
    }
}

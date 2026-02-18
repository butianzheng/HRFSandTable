use crate::engine::{
    evaluator, roll_change,
    sorter::SortedMaterial,
    validator::{self, ConstraintViolation},
};
use crate::utils::log::write_operation_log;
use crate::AppError;
use sea_orm::prelude::Expr;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct RiskAnalysis {
    pub plan_id: i32,
    pub plan_name: String,
    pub score_overall: i32,
    pub score_sequence: i32,
    pub score_delivery: i32,
    pub score_efficiency: i32,
    pub total_count: i32,
    pub total_weight: f64,
    pub roll_change_count: i32,
    pub risk_high: i32,
    pub risk_medium: i32,
    pub risk_low: i32,
    pub violations: Vec<RiskViolationItem>,
    pub width_jumps: Vec<WidthJumpItem>,
    pub thickness_jumps: Vec<ThicknessJumpItem>,
    pub shift_summary: Vec<ShiftSummary>,
    pub temp_distribution: TempDistribution,
    pub due_risk_distribution: DueRiskDistribution,
    pub overdue_count: i32,
    pub steel_grade_switches: i32,
    pub ignored_risks: Vec<IgnoredRiskEntry>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub struct IgnoredRiskEntry {
    pub constraint_type: String,
    pub material_id: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RiskViolationItem {
    pub constraint_type: String,
    pub severity: String,
    pub message: String,
    pub material_id: i32,
    pub coil_id: String,
    pub sequence: i32,
    pub due_date: Option<String>,
    pub due_bucket: String,
    #[serde(default)]
    pub ignored: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WidthJumpItem {
    pub sequence: i32,
    pub coil_id: String,
    pub prev_coil_id: String,
    pub width_diff: f64,
    pub width: f64,
    pub prev_width: f64,
    #[serde(default)]
    pub is_roll_change_boundary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThicknessJumpItem {
    pub sequence: i32,
    pub coil_id: String,
    pub prev_coil_id: String,
    pub thickness_diff: f64,
    pub thickness: f64,
    pub prev_thickness: f64,
    #[serde(default)]
    pub is_roll_change_boundary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShiftSummary {
    pub shift_date: String,
    pub shift_type: String,
    pub count: i32,
    pub weight: f64,
    pub roll_changes: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TempDistribution {
    pub ready: i32,
    pub waiting: i32,
    pub unknown: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DueRiskDistribution {
    pub overdue: i32,
    pub in3: i32,
    pub in7: i32,
    pub later: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WaitingForecastItem {
    pub ready_date: String,
    pub count: i32,
    pub total_weight: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WaitingForecastDetailItem {
    pub material_id: i32,
    pub coil_id: String,
    pub steel_grade: String,
    pub weight: f64,
    pub temp_wait_days: i32,
    pub ready_date: String,
    pub due_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApplyRiskSuggestionResult {
    pub risk_id: String,
    pub changed: bool,
    pub reason_code: String,
    pub constraint_type: String,
    pub material_id: i32,
    pub coil_id: String,
    pub sequence: i32,
    pub action_note: String,
}

#[tauri::command]
pub async fn get_risk_analysis(plan_id: i32) -> Result<RiskAnalysis, AppError> {
    use crate::db::get_db;
    use crate::models::{material, schedule_item, schedule_plan, strategy_template};
    use sea_orm::*;

    let db = get_db();

    // 加载方案
    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    // 加载排程项
    let items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    // 加载关联材料
    let mat_ids: Vec<i32> = items.iter().map(|i| i.material_id).collect();
    let mats = if mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(mat_ids))
            .all(db)
            .await?
    };
    let mat_map: std::collections::HashMap<i32, &material::Model> =
        mats.iter().map(|m| (m.id, m)).collect();
    let today = chrono::Utc::now().date_naive();

    // 解析忽略列表
    let ignored_risks: Vec<IgnoredRiskEntry> = plan
        .ignored_risks
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let (width_jump_threshold, thickness_jump_threshold) = if let Some(strategy_id) = plan.strategy_id
    {
        let strategy = strategy_template::Entity::find_by_id(strategy_id).one(db).await?;

        let width = strategy
            .as_ref()
            .and_then(|s| validator::parse_hard_constraints(&s.constraints).ok())
            .and_then(|cfg| {
                cfg.constraints
                    .into_iter()
                    .find(|c| c.constraint_type == "width_jump" && c.enabled)
                    .and_then(|c| c.max_value)
            })
            .unwrap_or(100.0);

        let thickness = strategy
            .and_then(|s| s.soft_constraints)
            .and_then(|soft| validator::parse_soft_constraints(&soft).ok())
            .and_then(|cfg| {
                cfg.constraints
                    .into_iter()
                    .find(|c| c.constraint_type == "thickness_jump" && c.enabled)
                    .and_then(|c| c.threshold)
            })
            .unwrap_or(1.0);

        (width, thickness)
    } else {
        (100.0, 1.0)
    };

    // 解析风险标记
    let mut violations = Vec::new();
    for item in &items {
        if let Some(ref flags) = item.risk_flags {
            if let Ok(vs) = serde_json::from_str::<Vec<serde_json::Value>>(flags) {
                for v in vs {
                    let ct = v
                        .get("constraint_type")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let sev = v
                        .get("severity")
                        .and_then(|x| x.as_str())
                        .unwrap_or("info")
                        .to_string();
                    let msg = v
                        .get("message")
                        .and_then(|x| x.as_str())
                        .unwrap_or("")
                        .to_string();
                    let mid = v.get("material_id").and_then(|x| x.as_i64()).unwrap_or(0) as i32;
                    let effective_mid = if mid != 0 { mid } else { item.material_id };
                    let is_ignored = ignored_risks
                        .iter()
                        .any(|ir| ir.constraint_type == ct && ir.material_id == effective_mid);
                    let coil = mat_map
                        .get(&item.material_id)
                        .map(|m| m.coil_id.clone())
                        .unwrap_or_default();
                    let due = mat_map
                        .get(&item.material_id)
                        .and_then(|m| m.due_date)
                        .map(|d| d.date_naive().format("%Y-%m-%d").to_string());
                    let due_bucket = mat_map
                        .get(&item.material_id)
                        .and_then(|m| m.due_date)
                        .map(|d| {
                            let diff_days = d.date_naive().signed_duration_since(today).num_days();
                            if diff_days < 0 {
                                "overdue"
                            } else if diff_days <= 3 {
                                "in3"
                            } else if diff_days <= 7 {
                                "in7"
                            } else {
                                "later"
                            }
                        })
                        .unwrap_or("none")
                        .to_string();

                    violations.push(RiskViolationItem {
                        constraint_type: ct,
                        severity: sev,
                        message: msg,
                        material_id: effective_mid,
                        coil_id: coil,
                        sequence: item.sequence,
                        due_date: due,
                        due_bucket,
                        ignored: is_ignored,
                    });
                }
            }
        }
    }

    // 宽度跳跃分析
    let mut width_jumps = Vec::new();
    for i in 1..items.len() {
        let prev_mat = mat_map.get(&items[i - 1].material_id);
        let curr_mat = mat_map.get(&items[i].material_id);
        if let (Some(pm), Some(cm)) = (prev_mat, curr_mat) {
            let diff = (pm.width - cm.width).abs();
            if diff > width_jump_threshold {
                width_jumps.push(WidthJumpItem {
                    sequence: items[i].sequence,
                    coil_id: cm.coil_id.clone(),
                    prev_coil_id: pm.coil_id.clone(),
                    width_diff: diff,
                    width: cm.width,
                    prev_width: pm.width,
                    is_roll_change_boundary: items[i].is_roll_change.unwrap_or(false),
                });
            }
        }
    }

    // 厚度跳跃分析（阈值优先读取策略软约束 thickness_jump.threshold）
    let mut thickness_jumps = Vec::new();
    for i in 1..items.len() {
        let prev_mat = mat_map.get(&items[i - 1].material_id);
        let curr_mat = mat_map.get(&items[i].material_id);
        if let (Some(pm), Some(cm)) = (prev_mat, curr_mat) {
            let diff = (pm.thickness - cm.thickness).abs();
            if diff > thickness_jump_threshold {
                thickness_jumps.push(ThicknessJumpItem {
                    sequence: items[i].sequence,
                    coil_id: cm.coil_id.clone(),
                    prev_coil_id: pm.coil_id.clone(),
                    thickness_diff: diff,
                    thickness: cm.thickness,
                    prev_thickness: pm.thickness,
                    is_roll_change_boundary: items[i].is_roll_change.unwrap_or(false),
                });
            }
        }
    }

    // 班次统计
    let mut shift_map: std::collections::HashMap<(String, String), (i32, f64, i32)> =
        std::collections::HashMap::new();
    for item in &items {
        let key = (item.shift_date.clone(), item.shift_type.clone());
        let entry = shift_map.entry(key).or_insert((0, 0.0, 0));
        entry.0 += 1;
        if let Some(m) = mat_map.get(&item.material_id) {
            entry.1 += m.weight;
        }
        if item.is_roll_change == Some(true) {
            entry.2 += 1;
        }
    }
    let mut shift_summary: Vec<ShiftSummary> = shift_map
        .into_iter()
        .map(|((date, stype), (count, weight, rc))| ShiftSummary {
            shift_date: date,
            shift_type: stype,
            count,
            weight,
            roll_changes: rc,
        })
        .collect();
    shift_summary.sort_by(|a, b| {
        a.shift_date
            .cmp(&b.shift_date)
            .then(a.shift_type.cmp(&b.shift_type))
    });

    // 适温分布
    let mut ready = 0;
    let mut waiting = 0;
    let mut unknown = 0;
    for item in &items {
        match mat_map
            .get(&item.material_id)
            .and_then(|m| m.temp_status.as_deref())
        {
            Some("ready") => ready += 1,
            Some("waiting") => waiting += 1,
            _ => unknown += 1,
        }
    }

    // 交期风险分布
    let mut due_overdue = 0;
    let mut due_in3 = 0;
    let mut due_in7 = 0;
    let mut due_later = 0;
    for item in &items {
        let Some(due) = mat_map.get(&item.material_id).and_then(|m| m.due_date) else {
            continue;
        };
        let diff_days = due.date_naive().signed_duration_since(today).num_days();
        if diff_days < 0 {
            due_overdue += 1;
        } else if diff_days <= 3 {
            due_in3 += 1;
        } else if diff_days <= 7 {
            due_in7 += 1;
        } else {
            due_later += 1;
        }
    }
    let overdue_count = due_overdue;

    // 钢种切换次数
    let mut steel_switches = 0;
    for i in 1..items.len() {
        let prev_grade = mat_map
            .get(&items[i - 1].material_id)
            .map(|m| &m.steel_grade);
        let curr_grade = mat_map.get(&items[i].material_id).map(|m| &m.steel_grade);
        if prev_grade != curr_grade {
            steel_switches += 1;
        }
    }

    // 计算风险计数（排除已忽略项）
    let risk_high = violations
        .iter()
        .filter(|v| !v.ignored && v.severity == "high")
        .count() as i32;
    let risk_medium = violations
        .iter()
        .filter(|v| !v.ignored && v.severity == "medium")
        .count() as i32;
    let risk_low = violations
        .iter()
        .filter(|v| !v.ignored && v.severity == "low")
        .count() as i32;

    Ok(RiskAnalysis {
        plan_id,
        plan_name: plan.name,
        score_overall: plan.score_overall.unwrap_or(0),
        score_sequence: plan.score_sequence.unwrap_or(0),
        score_delivery: plan.score_delivery.unwrap_or(0),
        score_efficiency: plan.score_efficiency.unwrap_or(0),
        total_count: plan.total_count.unwrap_or(0),
        total_weight: plan.total_weight.unwrap_or(0.0),
        roll_change_count: plan.roll_change_count.unwrap_or(0),
        risk_high,
        risk_medium,
        risk_low,
        violations,
        width_jumps,
        thickness_jumps,
        shift_summary,
        temp_distribution: TempDistribution {
            ready,
            waiting,
            unknown,
        },
        due_risk_distribution: DueRiskDistribution {
            overdue: due_overdue,
            in3: due_in3,
            in7: due_in7,
            later: due_later,
        },
        overdue_count,
        steel_grade_switches: steel_switches,
        ignored_risks,
    })
}

#[tauri::command]
pub async fn evaluate_risks(plan_id: i32) -> Result<RiskAnalysis, AppError> {
    get_risk_analysis(plan_id).await
}

#[tauri::command]
pub async fn ignore_risk(
    plan_id: i32,
    constraint_type: String,
    material_id: i32,
) -> Result<Vec<IgnoredRiskEntry>, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan;
    use sea_orm::*;

    let db = get_db();
    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    let mut ignored: Vec<IgnoredRiskEntry> = plan
        .ignored_risks
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    let entry = IgnoredRiskEntry {
        constraint_type: constraint_type.clone(),
        material_id,
    };

    if !ignored.contains(&entry) {
        ignored.push(entry);
    }

    let mut plan_active: schedule_plan::ActiveModel = plan.into();
    plan_active.ignored_risks = Set(Some(serde_json::to_string(&ignored).unwrap_or_default()));
    plan_active.update(db).await?;

    write_operation_log(
        "schedule",
        "ignore_risk",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "忽略风险: constraint={}, material_id={}",
            constraint_type, material_id
        )),
    )
    .await;

    Ok(ignored)
}

#[tauri::command]
pub async fn unignore_risk(
    plan_id: i32,
    constraint_type: String,
    material_id: i32,
) -> Result<Vec<IgnoredRiskEntry>, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan;
    use sea_orm::*;

    let db = get_db();
    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    let mut ignored: Vec<IgnoredRiskEntry> = plan
        .ignored_risks
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or_default();

    ignored.retain(|e| !(e.constraint_type == constraint_type && e.material_id == material_id));

    let mut plan_active: schedule_plan::ActiveModel = plan.into();
    plan_active.ignored_risks = Set(Some(serde_json::to_string(&ignored).unwrap_or_default()));
    plan_active.update(db).await?;

    write_operation_log(
        "schedule",
        "unignore_risk",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "取消忽略风险: constraint={}, material_id={}",
            constraint_type, material_id
        )),
    )
    .await;

    Ok(ignored)
}

/// 重新计算排程项的 risk_flags 并更新方案评分。
/// 在排程序位变更（如应用风险建议、手动拖拽）后调用。
async fn recalculate_risk_flags(plan_id: i32) -> Result<(), AppError> {
    use crate::db::get_db;
    use crate::models::{material, schedule_item, schedule_plan, strategy_template};
    use sea_orm::*;

    let db = get_db();

    // 1. 加载方案及关联策略
    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    let strategy_id = plan
        .strategy_id
        .ok_or_else(|| AppError::Internal("方案未关联策略模板，无法重算风险".into()))?;

    let strategy = strategy_template::Entity::find_by_id(strategy_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::Internal("策略模板不存在".into()))?;

    let hard_config = validator::parse_hard_constraints(&strategy.constraints)?;
    let soft_config = strategy
        .soft_constraints
        .as_deref()
        .map(validator::parse_soft_constraints)
        .transpose()?
        .unwrap_or(validator::SoftConstraintsConfig {
            constraints: vec![],
        });
    let eval_config = evaluator::parse_eval_weights(&strategy.eval_weights)?;

    let shift_capacity = hard_config
        .constraints
        .iter()
        .find(|c| c.constraint_type == "shift_capacity")
        .and_then(|c| c.max_value)
        .unwrap_or(1200.0);

    // 2. 按新序位加载排程项和材料
    let items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let mat_ids: Vec<i32> = items.iter().map(|it| it.material_id).collect();
    let mats = if mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(mat_ids))
            .all(db)
            .await?
    };
    let mat_map: std::collections::HashMap<i32, material::Model> =
        mats.into_iter().map(|m| (m.id, m)).collect();

    // 3. 按排程序位构建 SortedMaterial 序列（sort_keys 留空，校验器不使用）
    let sorted: Vec<SortedMaterial> = items
        .iter()
        .filter_map(|it| {
            mat_map.get(&it.material_id).map(|m| SortedMaterial {
                material: m.clone(),
                sort_keys: vec![],
                earliest_schedule_date: None,
            })
        })
        .collect();

    // 4. 重新运行硬约束校验
    let new_violations = validator::validate_hard_constraints(&sorted, &hard_config);

    // 4.5 按班次容量检查（validator 只做全局检查，这里做逐班次检查）
    let mut shift_groups: std::collections::HashMap<(String, String), Vec<usize>> =
        std::collections::HashMap::new();
    for (idx, it) in items.iter().enumerate() {
        shift_groups
            .entry((it.shift_date.clone(), it.shift_type.clone()))
            .or_default()
            .push(idx);
    }

    let mut shift_capacity_violations: Vec<(i32, String)> = Vec::new();
    for ((date, shift_type), indices) in &shift_groups {
        let total_weight: f64 = indices
            .iter()
            .filter_map(|&i| mat_map.get(&items[i].material_id))
            .map(|m| m.weight)
            .sum();
        if total_weight > shift_capacity {
            let excess = total_weight - shift_capacity;
            let mut accumulated = 0.0;
            for &idx in indices.iter().rev() {
                if let Some(m) = mat_map.get(&items[idx].material_id) {
                    shift_capacity_violations.push((
                        m.id,
                        format!(
                            "{}{}班产能超限 {:.0}t > {:.0}t，建议移至下一班次",
                            date,
                            if shift_type == "day" { "白" } else { "夜" },
                            total_weight,
                            shift_capacity
                        ),
                    ));
                    accumulated += m.weight;
                    if accumulated >= excess {
                        break;
                    }
                }
            }
        }
    }

    // 5. 按 material_id 归类违规，更新每条排程项的 risk_flags
    let mut violation_by_mat: std::collections::HashMap<i32, Vec<&ConstraintViolation>> =
        std::collections::HashMap::new();
    for v in &new_violations {
        violation_by_mat.entry(v.material_id).or_default().push(v);
    }

    for it in &items {
        let flags = violation_by_mat.get(&it.material_id);
        let mut flag_vec: Vec<serde_json::Value> = match flags {
            Some(vs) => vs
                .iter()
                .filter_map(|v| serde_json::to_value(v).ok())
                .collect(),
            _ => vec![],
        };

        // 追加 shift_capacity 违规
        for (mat_id, msg) in &shift_capacity_violations {
            if *mat_id == it.material_id {
                flag_vec.push(serde_json::json!({
                    "constraint_type": "shift_capacity",
                    "severity": "medium",
                    "message": msg,
                    "material_index": 0,
                    "material_id": mat_id,
                }));
            }
        }

        let risk_json = if flag_vec.is_empty() {
            None
        } else {
            Some(serde_json::to_string(&flag_vec).unwrap_or_default())
        };
        schedule_item::Entity::update_many()
            .col_expr(schedule_item::Column::RiskFlags, Expr::value(risk_json))
            .filter(schedule_item::Column::Id.eq(it.id))
            .exec(db)
            .await?;
    }

    // 6. 重新评估方案分数并更新 plan 表
    let roll_config = roll_change::extract_roll_config(&hard_config);
    let roll_changes = roll_change::calculate_roll_changes(&sorted, &roll_config);
    let rc_indices = roll_change::roll_change_indices(&roll_changes);

    let (soft_adjust, soft_details) =
        validator::evaluate_soft_constraints(&sorted, &soft_config, &rc_indices);

    let plan_days = {
        let start = chrono::NaiveDate::parse_from_str(&plan.start_date, "%Y-%m-%d").ok();
        let end = chrono::NaiveDate::parse_from_str(&plan.end_date, "%Y-%m-%d").ok();
        match (start, end) {
            (Some(s), Some(e)) => (e - s).num_days() as i32 + 1,
            _ => 1,
        }
    };

    let eval = evaluator::evaluate_plan(
        &sorted,
        &roll_changes,
        &new_violations,
        &soft_details,
        soft_adjust,
        &eval_config,
        shift_capacity,
        plan_days,
    );

    let total_count = sorted.len() as i32;
    let total_weight: f64 = sorted.iter().map(|s| s.material.weight).sum();
    let roll_change_count = roll_changes.len() as i32;

    let mut plan_active: schedule_plan::ActiveModel = plan.into();
    plan_active.total_count = Set(Some(total_count));
    plan_active.total_weight = Set(Some(total_weight));
    plan_active.roll_change_count = Set(Some(roll_change_count));
    plan_active.score_overall = Set(Some(eval.score_overall));
    plan_active.score_sequence = Set(Some(eval.score_sequence));
    plan_active.score_delivery = Set(Some(eval.score_delivery));
    plan_active.score_efficiency = Set(Some(eval.score_efficiency));
    plan_active.risk_count_high = Set(Some(eval.risk_high));
    plan_active.risk_count_medium = Set(Some(eval.risk_medium));
    plan_active.risk_count_low = Set(Some(eval.risk_low));
    plan_active.risk_summary = Set(Some(eval.risk_summary));
    plan_active.updated_at = Set(Some(chrono::Utc::now()));
    plan_active.update(db).await?;

    log::info!(
        "[风险] 重算完成 plan={}, violations={}, score={}",
        plan_id,
        new_violations.len(),
        eval.score_overall,
    );

    Ok(())
}

#[tauri::command]
pub async fn apply_risk_suggestion(
    plan_id: i32,
    risk_id: String,
) -> Result<ApplyRiskSuggestionResult, AppError> {
    use crate::db::get_db;
    use crate::models::{material, schedule_item, schedule_plan, strategy_template};
    use sea_orm::*;

    let idx: usize = risk_id
        .parse()
        .map_err(|_| AppError::DataConversionError(format!("无效风险ID: {}", risk_id)))?;

    let analysis = get_risk_analysis(plan_id).await?;
    let violation = analysis
        .violations
        .get(idx)
        .cloned()
        .ok_or_else(|| AppError::Internal(format!("风险项不存在: index={}", idx)))?;

    let db = get_db();
    let mut items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    if items.is_empty() {
        return Ok(ApplyRiskSuggestionResult {
            risk_id,
            changed: false,
            reason_code: "empty_schedule".to_string(),
            constraint_type: violation.constraint_type.clone(),
            material_id: violation.material_id,
            coil_id: violation.coil_id.clone(),
            sequence: violation.sequence,
            action_note: "排程为空，无可应用建议".to_string(),
        });
    }

    // 加载策略配置以获取宽度跳跃阈值
    let plan_record = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;
    let width_jump_threshold = if let Some(sid) = plan_record.strategy_id {
        let strategy = strategy_template::Entity::find_by_id(sid).one(db).await?;
        strategy
            .and_then(|s| validator::parse_hard_constraints(&s.constraints).ok())
            .and_then(|hc| {
                hc.constraints
                    .iter()
                    .find(|c| c.constraint_type == "width_jump")
                    .and_then(|c| c.max_value)
            })
            .unwrap_or(100.0)
    } else {
        100.0
    };

    // 加载材料映射以查询宽度值
    let mat_ids: Vec<i32> = items.iter().map(|it| it.material_id).collect();
    let mats = material::Entity::find()
        .filter(material::Column::Id.is_in(mat_ids))
        .all(db)
        .await?;
    let mat_map: std::collections::HashMap<i32, material::Model> =
        mats.into_iter().map(|m| (m.id, m)).collect();

    let (changed, reason_code, action_note) = match violation.constraint_type.as_str() {
        "overdue_priority" => {
            // 安全前移：找最靠前的宽度兼容位置
            if let Some(pos) = items
                .iter()
                .position(|it| it.material_id == violation.material_id)
            {
                if items[pos].is_locked == Some(true) {
                    (
                        false,
                        "locked".to_string(),
                        format!("逾期优先: 材料{}已锁定", violation.coil_id),
                    )
                } else if pos == 0 {
                    (
                        false,
                        "already_top".to_string(),
                        format!("逾期优先: 材料{}已在首位", violation.coil_id),
                    )
                } else {
                    let target_width = mat_map
                        .get(&items[pos].material_id)
                        .map(|m| m.width)
                        .unwrap_or(0.0);

                    // 从前往后扫描，找第一个宽度兼容的位置
                    let mut best_pos = 0usize; // fallback：队首
                    let mut found_compatible = false;

                    for j in 0..pos {
                        if items[j].is_locked == Some(true) {
                            continue;
                        }
                        let prev_ok = if j == 0 {
                            true
                        } else {
                            mat_map
                                .get(&items[j - 1].material_id)
                                .map(|m| (m.width - target_width).abs() < width_jump_threshold)
                                .unwrap_or(true)
                        };
                        let next_ok = mat_map
                            .get(&items[j].material_id)
                            .map(|m| (m.width - target_width).abs() < width_jump_threshold)
                            .unwrap_or(true);

                        if prev_ok && next_ok {
                            best_pos = j;
                            found_compatible = true;
                            break;
                        }
                    }

                    let item = items.remove(pos);
                    items.insert(best_pos, item);

                    let note = if found_compatible {
                        format!(
                            "逾期优先: 材料{}安全前移至#{} (宽度兼容)",
                            violation.coil_id,
                            best_pos + 1
                        )
                    } else {
                        format!(
                            "逾期优先: 材料{}前移至队首 (无完全兼容位, 取最前位)",
                            violation.coil_id
                        )
                    };
                    (true, "safe_forward".to_string(), note)
                }
            } else {
                (
                    false,
                    "not_found".to_string(),
                    format!("逾期优先: 材料{}未在当前排程中", violation.coil_id),
                )
            }
        }
        "width_jump" => {
            // 智能重定位：扫描全序列找最佳插入位置
            let pos = items
                .iter()
                .position(|it| it.sequence == violation.sequence)
                .or_else(|| {
                    items
                        .iter()
                        .position(|it| it.material_id == violation.material_id)
                });

            if let Some(i) = pos {
                if items[i].is_locked == Some(true) {
                    (
                        false,
                        "locked".to_string(),
                        format!("宽度跳跃: 材料{}已锁定", violation.coil_id),
                    )
                } else {
                    let target_width = mat_map
                        .get(&items[i].material_id)
                        .map(|m| m.width)
                        .unwrap_or(0.0);

                    // 临时移除目标材料
                    let removed = items.remove(i);

                    // 扫描所有可能的插入位置
                    let mut best_pos = i; // 默认回到原位
                    let mut best_max_diff = f64::MAX;

                    for j in 0..=items.len() {
                        let prev_width = if j > 0 {
                            mat_map.get(&items[j - 1].material_id).map(|m| m.width)
                        } else {
                            None
                        };
                        let next_width = if j < items.len() {
                            mat_map.get(&items[j].material_id).map(|m| m.width)
                        } else {
                            None
                        };

                        let diff_prev = prev_width.map(|w| (w - target_width).abs()).unwrap_or(0.0);
                        let diff_next = next_width.map(|w| (w - target_width).abs()).unwrap_or(0.0);
                        let max_diff = diff_prev.max(diff_next);

                        if max_diff < best_max_diff {
                            best_max_diff = max_diff;
                            best_pos = j;
                        }
                    }

                    items.insert(best_pos, removed);

                    if best_pos == i {
                        (
                            false,
                            "already_optimal".to_string(),
                            format!(
                                "宽度跳跃: 材料{}当前已是最优位置，无更优插入点",
                                violation.coil_id
                            ),
                        )
                    } else {
                        (
                            true,
                            "smart_reposition".to_string(),
                            format!(
                                "宽度跳跃: 材料{}从#{}智能重定位至#{} (最大宽度差{:.0}mm)",
                                violation.coil_id,
                                i + 1,
                                best_pos + 1,
                                best_max_diff
                            ),
                        )
                    }
                }
            } else {
                (
                    false,
                    "not_found".to_string(),
                    format!("宽度跳跃: 材料{}未在当前排程中", violation.coil_id),
                )
            }
        }
        "temp_status_filter" => {
            if let Some(pos) = items
                .iter()
                .position(|it| it.material_id == violation.material_id)
            {
                if items[pos].is_locked != Some(true) {
                    items.remove(pos);
                    (
                        true,
                        "removed".to_string(),
                        format!("适温违规: 移除材料{}出排程", violation.coil_id),
                    )
                } else {
                    (
                        false,
                        "locked".to_string(),
                        format!("适温违规: 材料{}已锁定，无法移除", violation.coil_id),
                    )
                }
            } else {
                (
                    false,
                    "not_found".to_string(),
                    format!("适温违规: 材料{}未在当前排程中", violation.coil_id),
                )
            }
        }
        "shift_capacity" => {
            // 移至下一有空余的班次
            if let Some(pos) = items
                .iter()
                .position(|it| it.material_id == violation.material_id)
            {
                if items[pos].is_locked == Some(true) {
                    (
                        false,
                        "locked".to_string(),
                        format!("班次超限: 材料{}已锁定", violation.coil_id),
                    )
                } else {
                    let current_date = items[pos].shift_date.clone();
                    let current_type = items[pos].shift_type.clone();

                    // 确定下一班次
                    let (next_date, next_type) = if current_type == "day" {
                        (current_date.clone(), "night".to_string())
                    } else {
                        let next_d = crate::engine::scheduler::next_date(&current_date);
                        (next_d, "day".to_string())
                    };

                    // 找到下一班次区域的正确插入位置
                    let insert_after = items.iter().rposition(|it| {
                        it.shift_date.as_str() < next_date.as_str()
                            || (it.shift_date == next_date
                                && it.shift_type == "day"
                                && next_type == "night")
                            || (it.shift_date == current_date && it.shift_type == current_type)
                    });

                    let mut item = items.remove(pos);
                    item.shift_date = next_date.clone();
                    item.shift_type = next_type.clone();

                    let insert_pos = insert_after
                        .map(|p| if p >= pos { p } else { p + 1 })
                        .unwrap_or(items.len());
                    let insert_pos = insert_pos.min(items.len());

                    items.insert(insert_pos, item);

                    (
                        true,
                        "moved_to_next_shift".to_string(),
                        format!(
                            "班次超限: 材料{}从{}{}班移至{}{}班",
                            violation.coil_id,
                            current_date,
                            if current_type == "day" { "白" } else { "夜" },
                            next_date,
                            if next_type == "day" { "白" } else { "夜" }
                        ),
                    )
                }
            } else {
                (
                    false,
                    "not_found".to_string(),
                    format!("班次超限: 材料{}未在当前排程中", violation.coil_id),
                )
            }
        }
        _ => {
            if let Some(pos) = items
                .iter()
                .position(|it| it.material_id == violation.material_id)
            {
                if pos > 0 && items[pos].is_locked != Some(true) {
                    let item = items.remove(pos);
                    items.insert(pos - 1, item);
                    (
                        true,
                        "move_up".to_string(),
                        format!(
                            "通用建议: 材料{}前移一位（约束:{}）",
                            violation.coil_id, violation.constraint_type
                        ),
                    )
                } else if pos == 0 {
                    (
                        false,
                        "already_top".to_string(),
                        format!(
                            "通用建议: 材料{}已在首位（约束:{}）",
                            violation.coil_id, violation.constraint_type
                        ),
                    )
                } else {
                    (
                        false,
                        "locked".to_string(),
                        format!(
                            "通用建议: 材料{}无需调整（约束:{}）",
                            violation.coil_id, violation.constraint_type
                        ),
                    )
                }
            } else {
                (
                    false,
                    "not_found".to_string(),
                    format!(
                        "通用建议: 材料{}未在当前排程中（约束:{}）",
                        violation.coil_id, violation.constraint_type
                    ),
                )
            }
        }
    };

    if changed {
        // Phase 1: set sequences to negative temporary values
        for (i, it) in items.iter().enumerate() {
            let temp_seq = -(i as i32 + 1);
            schedule_item::Entity::update_many()
                .col_expr(schedule_item::Column::Sequence, Expr::value(temp_seq))
                .filter(schedule_item::Column::Id.eq(it.id))
                .exec(db)
                .await?;
        }
        // Phase 2: set sequences to correct positive values + sync shift_date/shift_type
        for (i, it) in items.iter().enumerate() {
            let seq = i as i32 + 1;
            schedule_item::Entity::update_many()
                .col_expr(schedule_item::Column::Sequence, Expr::value(seq))
                .col_expr(
                    schedule_item::Column::ShiftDate,
                    Expr::value(it.shift_date.clone()),
                )
                .col_expr(
                    schedule_item::Column::ShiftType,
                    Expr::value(it.shift_type.clone()),
                )
                .filter(schedule_item::Column::Id.eq(it.id))
                .exec(db)
                .await?;
        }

        // Phase 3: recalculate risk_flags and plan scores based on new sequence
        recalculate_risk_flags(plan_id).await?;
    }

    write_operation_log(
        "schedule",
        "apply_risk_suggestion",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "应用风险建议 risk_id={}, constraint={}, changed={}, {}",
            risk_id, violation.constraint_type, changed, action_note
        )),
    )
    .await;

    Ok(ApplyRiskSuggestionResult {
        risk_id,
        changed,
        reason_code,
        constraint_type: violation.constraint_type,
        material_id: violation.material_id,
        coil_id: violation.coil_id,
        sequence: violation.sequence,
        action_note,
    })
}

#[tauri::command]
pub async fn get_waiting_forecast(
    forecast_days: Option<i32>,
) -> Result<Vec<WaitingForecastItem>, AppError> {
    use crate::db::get_db;
    use crate::models::material;
    use chrono::Datelike;
    use sea_orm::*;
    use std::collections::BTreeMap;

    let db = get_db();
    let config = crate::services::temp_service::load_temper_config().await?;
    let days = forecast_days.unwrap_or(7).max(1);
    let now = chrono::Utc::now();
    let current_month = now.month();

    let threshold = if config.spring_months.contains(&current_month) {
        config.spring_days
    } else if config.summer_months.contains(&current_month) {
        config.summer_days
    } else if config.autumn_months.contains(&current_month) {
        config.autumn_days
    } else if config.winter_months.contains(&current_month) {
        config.winter_days
    } else {
        config.spring_days
    };

    let waiting_materials = material::Entity::find()
        .filter(material::Column::TempStatus.eq("waiting"))
        .filter(material::Column::Status.eq("pending"))
        .all(db)
        .await?;

    let mut map: BTreeMap<String, (i32, f64)> = BTreeMap::new();
    for m in waiting_materials {
        let wait_days = now.signed_duration_since(m.coiling_time).num_days() as i32;
        let remain_days = (threshold - wait_days).max(1);
        if remain_days > days {
            continue;
        }
        let ready_date = (now + chrono::Duration::days(remain_days as i64))
            .format("%Y-%m-%d")
            .to_string();
        let entry = map.entry(ready_date).or_insert((0, 0.0));
        entry.0 += 1;
        entry.1 += m.weight;
    }

    let result = map
        .into_iter()
        .map(|(ready_date, (count, total_weight))| WaitingForecastItem {
            ready_date,
            count,
            total_weight,
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn get_waiting_forecast_details(
    ready_date: String,
) -> Result<Vec<WaitingForecastDetailItem>, AppError> {
    use crate::db::get_db;
    use crate::models::material;
    use chrono::Datelike;
    use sea_orm::*;

    let db = get_db();
    let config = crate::services::temp_service::load_temper_config().await?;
    let now = chrono::Utc::now();
    let current_month = now.month();

    let _target_date = chrono::NaiveDate::parse_from_str(&ready_date, "%Y-%m-%d")
        .map_err(|_| AppError::DataConversionError(format!("无效日期格式: {}", ready_date)))?;

    let threshold = if config.spring_months.contains(&current_month) {
        config.spring_days
    } else if config.summer_months.contains(&current_month) {
        config.summer_days
    } else if config.autumn_months.contains(&current_month) {
        config.autumn_days
    } else if config.winter_months.contains(&current_month) {
        config.winter_days
    } else {
        config.spring_days
    };

    let waiting_materials = material::Entity::find()
        .filter(material::Column::TempStatus.eq("waiting"))
        .filter(material::Column::Status.eq("pending"))
        .all(db)
        .await?;

    let mut result = Vec::new();
    for m in waiting_materials {
        let wait_days = now.signed_duration_since(m.coiling_time).num_days() as i32;
        let remain_days = (threshold - wait_days).max(1);
        let material_ready_date = (now + chrono::Duration::days(remain_days as i64))
            .format("%Y-%m-%d")
            .to_string();
        if material_ready_date != ready_date {
            continue;
        }
        result.push(WaitingForecastDetailItem {
            material_id: m.id,
            coil_id: m.coil_id,
            steel_grade: m.steel_grade,
            weight: m.weight,
            temp_wait_days: wait_days.max(0),
            ready_date: material_ready_date,
            due_date: m
                .due_date
                .map(|d| d.date_naive().format("%Y-%m-%d").to_string()),
        });
    }
    result.sort_by(|a, b| {
        a.temp_wait_days
            .cmp(&b.temp_wait_days)
            .reverse()
            .then_with(|| {
                b.weight
                    .partial_cmp(&a.weight)
                    .unwrap_or(std::cmp::Ordering::Equal)
            })
    });

    Ok(result)
}

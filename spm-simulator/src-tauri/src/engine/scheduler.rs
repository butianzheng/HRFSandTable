//! 自动排程主流程 — 8 步排程引擎
//!
//! Step 1: 数据准备 — 加载材料、策略、系统参数
//! Step 2: 适温计算 — 筛选适温材料 + 滚动适温预测
//! Step 3: 预处理   — 排除冻结、保留锁定、标记逾期、纳入期内将适温材料
//! Step 4: 优先级计算 + 多因子排序
//! Step 5: 硬约束校验
//! Step 6: 换辊配置提取（动态换辊在 Step 7 中执行）
//! Step 7: 按日期分批排程 + 动态换辊
//! Step 8: 方案评估

use crate::utils::datetime::DEFAULT_SHIFT_START;
use chrono::{Duration, NaiveDate, Timelike, Utc};
use sea_orm::*;
use std::collections::HashMap;
use std::time::Instant;

use crate::db::get_db;
use crate::engine::{
    evaluator::{self, EvalResult},
    priority,
    roll_change::{self, RollChangeConfig, RollChangePoint},
    sorter::{self, SortedMaterial},
    validator::{self, SoftConstraintsConfig},
};
use crate::models::{material, schedule_item, schedule_plan, strategy_template};
use crate::services::temp_service;
use crate::AppError;

/// 排程结果
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScheduleOutput {
    pub plan_id: i32,
    pub total_count: i32,
    pub total_weight: f64,
    pub roll_change_count: i32,
    pub eval: EvalResult,
    /// 滚动适温材料数量（期内待温→适温的材料）
    pub future_ready_count: i32,
    /// 滚动适温材料总重量
    pub future_ready_weight: f64,
    /// 本次排程实际使用的算法模式（beam/hybrid/greedy/none）
    pub scheduler_mode_used: String,
    /// 是否发生了 Beam -> 贪心兜底
    pub fallback_triggered: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum SchedulerMode {
    Hybrid,
    BeamOnly,
    GreedyOnly,
}

#[derive(Debug, Clone)]
struct HybridSchedulerConfig {
    mode: SchedulerMode,
    beam_width: usize,
    beam_lookahead: usize,
    beam_top_k: usize,
    time_budget_ms: u128,
    max_nodes: usize,
    fallback_enabled: bool,
}

impl Default for HybridSchedulerConfig {
    fn default() -> Self {
        Self {
            mode: SchedulerMode::Hybrid,
            beam_width: 10,
            beam_lookahead: 3,
            beam_top_k: 40,
            time_budget_ms: 120_000,
            max_nodes: 200_000,
            fallback_enabled: true,
        }
    }
}

impl HybridSchedulerConfig {
    fn from_config_map(config_map: &HashMap<String, HashMap<String, String>>) -> Self {
        let mut cfg = Self::default();
        let group = config_map.get("scheduler");
        let mode_raw = group
            .and_then(|g| g.get("mode"))
            .map(|v| v.to_ascii_lowercase())
            .unwrap_or_else(|| "hybrid".to_string());
        cfg.mode = match mode_raw.as_str() {
            "beam" => SchedulerMode::BeamOnly,
            "greedy" => SchedulerMode::GreedyOnly,
            _ => SchedulerMode::Hybrid,
        };

        cfg.beam_width = parse_usize_cfg(group, "beam_width", cfg.beam_width, 1, 64);
        cfg.beam_lookahead = parse_usize_cfg(group, "beam_lookahead", cfg.beam_lookahead, 1, 8);
        cfg.beam_top_k = parse_usize_cfg(group, "beam_top_k", cfg.beam_top_k, 1, 500);
        cfg.time_budget_ms =
            parse_u128_cfg(group, "time_budget_ms", cfg.time_budget_ms, 1_000, 900_000);
        cfg.max_nodes = parse_usize_cfg(group, "max_nodes", cfg.max_nodes, 1_000, 5_000_000);
        cfg.fallback_enabled = parse_bool_cfg(group, "fallback_enabled", cfg.fallback_enabled);
        cfg
    }

    fn mode_name(&self) -> &'static str {
        match self.mode {
            SchedulerMode::Hybrid => "hybrid",
            SchedulerMode::BeamOnly => "beam",
            SchedulerMode::GreedyOnly => "greedy",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PickMode {
    Beam,
    GreedyFallback,
    GreedyOnly,
}

#[derive(Debug, Clone)]
struct CandidateEval {
    need_roll_change: bool,
    next_check_time: f64,
    next_shift_cumulative: f64,
    next_roll_cumulative: f64,
}

#[derive(Debug, Clone)]
struct BeamState {
    selected_positions: Vec<usize>,
    check_time: f64,
    shift_cumulative: f64,
    roll_cumulative: f64,
    prev_sorted_idx: Option<usize>,
    score: f64,
}

/// 自动排程主入口
pub async fn auto_schedule(plan_id: i32, strategy_id: i32) -> Result<ScheduleOutput, AppError> {
    let db = get_db();

    // ═══ Step 1: 数据准备 ═══
    log::info!(
        "[排程] Step 1: 数据准备 plan={}, strategy={}",
        plan_id,
        strategy_id
    );

    // 加载排程方案
    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    // 加载策略模板
    let strategy = strategy_template::Entity::find_by_id(strategy_id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("策略模板不存在".into()))?;

    // 解析策略配置
    let sort_config = sorter::parse_sort_config(&strategy.sort_weights)?;
    let hard_config = validator::parse_hard_constraints(&strategy.constraints)?;
    let soft_config = strategy
        .soft_constraints
        .as_deref()
        .map(validator::parse_soft_constraints)
        .transpose()?
        .unwrap_or(SoftConstraintsConfig {
            constraints: vec![],
        });
    let eval_config = evaluator::parse_eval_weights(&strategy.eval_weights)?;

    // 获取班次产能上限
    let shift_capacity = hard_config
        .constraints
        .iter()
        .find(|c| c.constraint_type == "shift_capacity")
        .and_then(|c| c.max_value)
        .unwrap_or(1200.0);

    // 加载系统配置
    let sys_configs = crate::models::system_config::Entity::find().all(db).await?;
    let config_map: HashMap<String, HashMap<String, String>> = {
        let mut m: HashMap<String, HashMap<String, String>> = HashMap::new();
        for c in &sys_configs {
            m.entry(c.config_group.clone())
                .or_default()
                .insert(c.config_key.clone(), c.config_value.clone());
        }
        m
    };

    let avg_rhythm: f64 = config_map
        .get("capacity")
        .and_then(|g| g.get("avg_rhythm"))
        .and_then(|v| v.parse().ok())
        .unwrap_or(3.5);
    let scheduler_cfg = HybridSchedulerConfig::from_config_map(&config_map);
    log::info!(
        "[排程] 调度模式={} beam_width={} lookahead={} top_k={} budget={}ms max_nodes={} fallback={}",
        scheduler_cfg.mode_name(),
        scheduler_cfg.beam_width,
        scheduler_cfg.beam_lookahead,
        scheduler_cfg.beam_top_k,
        scheduler_cfg.time_budget_ms,
        scheduler_cfg.max_nodes,
        scheduler_cfg.fallback_enabled
    );

    // ═══ Step 2: 适温计算 + 滚动适温预测 ═══
    log::info!("[排程] Step 2: 适温状态刷新 + 滚动适温预测");
    temp_service::refresh_all_temper_status().await?;

    // 加载适温配置（用于滚动适温计算）
    let temper_config = temp_service::load_temper_config().await?;
    let plan_start = NaiveDate::parse_from_str(&plan.start_date, "%Y-%m-%d")
        .unwrap_or_else(|_| Utc::now().date_naive());
    let plan_end = NaiveDate::parse_from_str(&plan.end_date, "%Y-%m-%d").unwrap_or(plan_start);

    // 加载所有材料（刷新后）
    let all_materials = material::Entity::find().all(db).await?;

    // ═══ Step 3: 预处理 ═══
    log::info!("[排程] Step 3: 预处理 (total={})", all_materials.len());

    // 排除冻结材料
    let active_materials: Vec<material::Model> = all_materials
        .into_iter()
        .filter(|m| m.status.as_deref() != Some("frozen"))
        .collect();

    // 已适温材料
    let ready_materials: Vec<material::Model> = active_materials
        .iter()
        .filter(|m| m.temp_status.as_deref() == Some("ready"))
        .cloned()
        .collect();

    // 期内将适温材料（仅多日方案）
    let mut future_ready_map: HashMap<i32, String> = HashMap::new();
    if plan_start != plan_end {
        for m in active_materials
            .iter()
            .filter(|m| m.temp_status.as_deref() != Some("ready"))
        {
            if let Some(ready_date) =
                temp_service::calculate_ready_date(&m.coiling_time, &temper_config)
            {
                if ready_date.as_str() >= plan.start_date.as_str()
                    && ready_date.as_str() <= plan.end_date.as_str()
                {
                    future_ready_map.insert(m.id, ready_date);
                }
            }
        }
    }

    // 合并材料池
    let mut all_candidate_materials = ready_materials;
    for m in &active_materials {
        if future_ready_map.contains_key(&m.id) {
            all_candidate_materials.push(m.clone());
        }
    }

    let ready_count = all_candidate_materials.len() - future_ready_map.len();
    let future_count = future_ready_map.len();
    log::info!(
        "[排程] 适温材料: {}, 期内将适温: {}, 合计: {}",
        ready_count,
        future_count,
        all_candidate_materials.len(),
    );

    let empty_output = ScheduleOutput {
        plan_id,
        total_count: 0,
        total_weight: 0.0,
        roll_change_count: 0,
        eval: EvalResult {
            score_overall: 0,
            score_sequence: 0,
            score_delivery: 0,
            score_efficiency: 0,
            metrics: evaluator::EvalMetrics {
                total_count: 0,
                total_weight: 0.0,
                roll_change_count: 0,
                width_jump_count: 0,
                steel_grade_switch_count: 0,
                capacity_utilization: 0.0,
                tempered_ratio: 0.0,
                urgent_completion_rate: 0.0,
                overdue_count: 0,
                soft_score_adjust: 0,
            },
            risk_high: 0,
            risk_medium: 0,
            risk_low: 0,
            risk_summary: "{}".into(),
        },
        future_ready_count: 0,
        future_ready_weight: 0.0,
        scheduler_mode_used: "none".to_string(),
        fallback_triggered: false,
    };

    if all_candidate_materials.is_empty() {
        return Ok(empty_output);
    }

    // ═══ Step 4: 优先级计算 + 多因子排序 ═══
    log::info!("[排程] Step 4: 优先级计算 + 多因子排序");

    // 批量计算优先级
    priority::batch_calculate_priorities(&all_candidate_materials).await?;

    // 重新加载（优先级已更新）
    let material_ids: Vec<i32> = all_candidate_materials.iter().map(|m| m.id).collect();
    let updated_materials = material::Entity::find()
        .filter(material::Column::Id.is_in(material_ids))
        .all(db)
        .await?;

    // 多维排序
    let mut sorted = sorter::sort_materials(updated_materials, &sort_config);

    // 为将适温材料标注 earliest_schedule_date
    for sm in &mut sorted {
        if let Some(ready_date) = future_ready_map.get(&sm.material.id) {
            sm.earliest_schedule_date = Some(ready_date.clone());
        }
    }

    // ═══ Step 5: 硬约束校验 ═══
    log::info!("[排程] Step 5: 硬约束校验");
    let violations = validator::validate_hard_constraints(&sorted, &hard_config);
    log::info!("[排程] 硬约束违规数: {}", violations.len());

    // ═══ Step 6: 换辊配置提取（动态换辊在 Step 7 中执行） ═══
    log::info!("[排程] Step 6: 换辊配置提取");
    let roll_config = roll_change::extract_roll_config(&hard_config);

    // ═══ Step 7: 按日期分批排程 + 动态换辊 ═══
    log::info!("[排程] Step 7: 按日期分批排程 + 动态换辊");

    // 清除旧的排程项
    schedule_item::Entity::delete_many()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .exec(db)
        .await?;

    // 获取班次时间
    let day_start_str = config_map
        .get("shift")
        .and_then(|g| g.get("day_start"))
        .map(|s| s.as_str())
        .unwrap_or("08:00");
    let day_end_str = config_map
        .get("shift")
        .and_then(|g| g.get("day_end"))
        .map(|s| s.as_str())
        .unwrap_or("20:00");
    let night_start_str = config_map
        .get("shift")
        .and_then(|g| g.get("night_start"))
        .map(|s| s.as_str())
        .unwrap_or("20:00");

    let parse_time_minutes = |s: &str| -> f64 {
        let t = chrono::NaiveTime::parse_from_str(s, "%H:%M").unwrap_or(DEFAULT_SHIFT_START);
        t.hour() as f64 * 60.0 + t.minute() as f64
    };

    let day_start_min = parse_time_minutes(day_start_str);
    let day_end_min = parse_time_minutes(day_end_str);
    let night_start_min = parse_time_minutes(night_start_str);
    // 夜班结束 = 次日白班开始，用 24h 偏移
    let night_end_min = day_start_min + 24.0 * 60.0;

    let rhythm_minutes = avg_rhythm;

    // 按 earliest_schedule_date 分区
    let mut available_pool: Vec<usize> = Vec::new(); // 索引到 sorted
    let mut future_pool: Vec<usize> = Vec::new();

    for (i, sm) in sorted.iter().enumerate() {
        match &sm.earliest_schedule_date {
            None => available_pool.push(i),
            Some(_) => future_pool.push(i),
        }
    }

    let mut current_date = plan.start_date.clone();
    let mut sequence_no = 1i32;
    let mut shift_no = 1i32;
    let mut all_roll_changes: Vec<RollChangePoint> = Vec::new();
    let mut scheduled_indices: Vec<usize> = Vec::new(); // 已排入的 sorted 索引（按排程顺序）
    let schedule_started_at = Instant::now();
    let mut beam_nodes_used = 0usize;
    let mut beam_pick_count = 0usize;
    let mut fallback_pick_count = 0usize;
    let mut beam_limit_warned = false;

    while current_date.as_str() <= plan.end_date.as_str() {
        // 1. 释放该日期到期的将适温材料
        let mut still_future = Vec::new();
        for idx in future_pool.drain(..) {
            if let Some(ref rd) = sorted[idx].earliest_schedule_date {
                if rd.as_str() <= current_date.as_str() {
                    available_pool.push(idx);
                } else {
                    still_future.push(idx);
                }
            }
        }
        future_pool = still_future;

        // 2. 对当前可用材料独立排序（按 sort_keys）
        available_pool.sort_by(|&a, &b| {
            sorter::compare_sort_keys(&sorted[a].sort_keys, &sorted[b].sort_keys)
        });

        // 3. 填充白班 + 夜班，动态换辊
        let mut roll_cumulative = 0.0f64;
        let mut prev_sorted_idx: Option<usize> = None;
        let mut day_scheduled: Vec<bool> = vec![false; available_pool.len()];

        for &(shift_type_str, shift_start, shift_end) in &[
            ("day", day_start_min, day_end_min),
            ("night", night_start_min, night_end_min),
        ] {
            let mut shift_cumulative = 0.0f64;

            // 双时间轨策略：
            //   check_time  — 用名义节奏(rhythm_minutes)做可行性检查，确保重量约束是主约束
            //   actual_time — 用重量比例时长(weight × time_per_ton)做实际排程时间分配
            let shift_duration = shift_end - shift_start;
            let time_per_ton = if shift_capacity > 0.0 {
                shift_duration / shift_capacity
            } else {
                rhythm_minutes / 100.0 // fallback
            };
            let mut check_time = shift_start;
            let mut actual_time = shift_start;

            loop {
                let unscheduled_positions: Vec<usize> = day_scheduled
                    .iter()
                    .enumerate()
                    .filter_map(|(idx, done)| if !done { Some(idx) } else { None })
                    .collect();
                if unscheduled_positions.is_empty() {
                    break;
                }

                let elapsed_ms = schedule_started_at.elapsed().as_millis();
                if !beam_limit_warned
                    && scheduler_cfg.mode != SchedulerMode::GreedyOnly
                    && (elapsed_ms > scheduler_cfg.time_budget_ms
                        || beam_nodes_used >= scheduler_cfg.max_nodes)
                {
                    beam_limit_warned = true;
                    log::warn!(
                        "[排程] Beam 达到限制，切换兜底: elapsed={}ms, nodes={}",
                        elapsed_ms,
                        beam_nodes_used
                    );
                }

                let Some((pool_idx, pick_mode)) = pick_next_pool_position(
                    &scheduler_cfg,
                    schedule_started_at.elapsed().as_millis(),
                    &mut beam_nodes_used,
                    &sorted,
                    &available_pool,
                    &unscheduled_positions,
                    prev_sorted_idx,
                    roll_cumulative,
                    shift_cumulative,
                    check_time,
                    shift_end,
                    shift_capacity,
                    rhythm_minutes,
                    &roll_config,
                ) else {
                    break;
                };

                match pick_mode {
                    PickMode::Beam => beam_pick_count += 1,
                    PickMode::GreedyFallback => fallback_pick_count += 1,
                    PickMode::GreedyOnly => {}
                }

                let sorted_idx = available_pool[pool_idx];
                let sm = &sorted[sorted_idx];
                let prev_material = prev_sorted_idx.map(|idx| &sorted[idx].material);

                // 动态换辊判断
                let need_roll_change =
                    should_roll_change(&sm.material, prev_material, roll_cumulative, &roll_config);
                let extra_time = if need_roll_change {
                    roll_config.change_duration_min
                } else {
                    0.0
                };

                // 可行性检查：名义时间 + 重量容量
                if check_time + rhythm_minutes + extra_time > shift_end
                    || shift_cumulative + sm.material.weight > shift_capacity
                {
                    break; // 当前班次已满
                }

                // 换辊处理
                if need_roll_change {
                    check_time += roll_config.change_duration_min;
                    actual_time += roll_config.change_duration_min;
                    all_roll_changes.push(RollChangePoint {
                        after_index: if scheduled_indices.is_empty() {
                            0
                        } else {
                            scheduled_indices.len() - 1
                        },
                        cumulative_weight: roll_cumulative,
                        at_width_jump: prev_material
                            .map(|pm| {
                                (pm.width - sm.material.width).abs()
                                    >= roll_config.width_jump_threshold
                            })
                            .unwrap_or(false),
                        duration_min: roll_config.change_duration_min,
                    });
                    roll_cumulative = 0.0;
                }

                // 分配排程项（实际时间用重量比例）
                let item_duration = (sm.material.weight * time_per_ton).max(1.0);
                let planned_start = format_time(actual_time);
                actual_time += item_duration;
                let planned_end = format_time(actual_time);
                check_time += rhythm_minutes;
                shift_cumulative += sm.material.weight;
                roll_cumulative += sm.material.weight;
                prev_sorted_idx = Some(sorted_idx);

                // 构建风险标记（含滚动适温标记）
                let mut risk_flags_vec: Vec<serde_json::Value> = violations
                    .iter()
                    .filter(|v| v.material_id == sm.material.id)
                    .filter_map(|v| serde_json::to_value(v).ok())
                    .collect();

                if let Some(ref ready_date) = sm.earliest_schedule_date {
                    risk_flags_vec.push(serde_json::json!({
                        "constraint_type": "rolling_temp",
                        "severity": "info",
                        "message": format!("滚动适温: 预计{}适温", ready_date),
                        "material_id": sm.material.id,
                        "ready_date": ready_date,
                    }));
                }

                let risk_json = if risk_flags_vec.is_empty() {
                    None
                } else {
                    Some(serde_json::to_string(&risk_flags_vec).unwrap_or_default())
                };

                // 插入排程项
                let item = schedule_item::ActiveModel {
                    plan_id: Set(plan_id),
                    material_id: Set(sm.material.id),
                    sequence: Set(sequence_no),
                    shift_date: Set(current_date.clone()),
                    shift_no: Set(shift_no),
                    shift_type: Set(shift_type_str.to_string()),
                    planned_start: Set(Some(planned_start)),
                    planned_end: Set(Some(planned_end)),
                    cumulative_weight: Set(Some(shift_cumulative)),
                    is_roll_change: Set(Some(need_roll_change)),
                    is_locked: Set(Some(false)),
                    risk_flags: Set(risk_json),
                    ..Default::default()
                };

                item.insert(db).await?;
                scheduled_indices.push(sorted_idx);
                sequence_no += 1;

                day_scheduled[pool_idx] = true;
            }

            shift_no += 1; // 每个班次结束后递增（日班和夜班各自独立编号）
        }

        // 批量移除本日所有已排材料（倒序删除保证索引正确）
        for idx in (0..day_scheduled.len()).rev() {
            if day_scheduled[idx] {
                available_pool.remove(idx);
            }
        }

        current_date = next_date(&current_date);
    }

    if beam_pick_count > 0 || fallback_pick_count > 0 {
        log::info!(
            "[排程] 混合调度统计: beam_pick={}, fallback_pick={}, nodes={}",
            beam_pick_count,
            fallback_pick_count,
            beam_nodes_used
        );
    }

    // 未能排入的材料警告
    if !available_pool.is_empty() || !future_pool.is_empty() {
        let unscheduled = available_pool.len() + future_pool.len();
        log::warn!(
            "[排程] {} 个材料未能在排期内排入 (可用未排: {}, 待温未到期: {})",
            unscheduled,
            available_pool.len(),
            future_pool.len()
        );
    }

    // ═══ Step 8: 方案评估 ═══
    log::info!("[排程] Step 8: 方案评估");

    // 构建实际排入的材料序列用于评估
    let scheduled_sorted: Vec<SortedMaterial> = scheduled_indices
        .iter()
        .map(|&idx| sorted[idx].clone())
        .collect();

    let rc_indices = roll_change::roll_change_indices(&all_roll_changes);

    let (soft_adjust, soft_details) =
        validator::evaluate_soft_constraints(&scheduled_sorted, &soft_config, &rc_indices);

    let plan_days = {
        let start = NaiveDate::parse_from_str(&plan.start_date, "%Y-%m-%d").ok();
        let end = NaiveDate::parse_from_str(&plan.end_date, "%Y-%m-%d").ok();
        match (start, end) {
            (Some(s), Some(e)) => (e - s).num_days() as i32 + 1,
            _ => 1,
        }
    };

    let eval = evaluator::evaluate_plan(
        &scheduled_sorted,
        &all_roll_changes,
        &violations,
        &soft_details,
        soft_adjust,
        &eval_config,
        shift_capacity,
        plan_days,
    );

    let total_count = scheduled_sorted.len() as i32;
    let total_weight: f64 = scheduled_sorted.iter().map(|s| s.material.weight).sum();
    let roll_change_count = all_roll_changes.len() as i32;

    let future_ready_count = scheduled_sorted
        .iter()
        .filter(|s| s.earliest_schedule_date.is_some())
        .count() as i32;
    let future_ready_weight: f64 = scheduled_sorted
        .iter()
        .filter(|s| s.earliest_schedule_date.is_some())
        .map(|s| s.material.weight)
        .sum();
    let fallback_triggered = fallback_pick_count > 0;
    let scheduler_mode_used = if total_count == 0 {
        "none"
    } else if beam_pick_count > 0 && fallback_pick_count > 0 {
        "hybrid"
    } else if beam_pick_count > 0 {
        "beam"
    } else {
        "greedy"
    };

    // 更新方案统计
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
    plan_active.risk_summary = Set(Some(eval.risk_summary.clone()));
    plan_active.ignored_risks = Set(None);
    plan_active.updated_at = Set(Some(Utc::now()));
    plan_active.update(db).await?;

    log::info!(
        "[排程] 完成 total={}, weight={:.0}t, score={}, 滚动适温={}",
        total_count,
        total_weight,
        eval.score_overall,
        future_ready_count,
    );

    Ok(ScheduleOutput {
        plan_id,
        total_count,
        total_weight,
        roll_change_count,
        eval,
        future_ready_count,
        future_ready_weight,
        scheduler_mode_used: scheduler_mode_used.to_string(),
        fallback_triggered,
    })
}

fn parse_bool_cfg(group: Option<&HashMap<String, String>>, key: &str, default_value: bool) -> bool {
    group
        .and_then(|g| g.get(key))
        .map(|v| {
            matches!(
                v.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(default_value)
}

fn parse_usize_cfg(
    group: Option<&HashMap<String, String>>,
    key: &str,
    default_value: usize,
    min_value: usize,
    max_value: usize,
) -> usize {
    group
        .and_then(|g| g.get(key))
        .and_then(|v| v.trim().parse::<usize>().ok())
        .map(|v| v.clamp(min_value, max_value))
        .unwrap_or(default_value)
}

fn parse_u128_cfg(
    group: Option<&HashMap<String, String>>,
    key: &str,
    default_value: u128,
    min_value: u128,
    max_value: u128,
) -> u128 {
    group
        .and_then(|g| g.get(key))
        .and_then(|v| v.trim().parse::<u128>().ok())
        .map(|v| v.clamp(min_value, max_value))
        .unwrap_or(default_value)
}

fn evaluate_candidate(
    sm: &SortedMaterial,
    prev_material: Option<&material::Model>,
    roll_cumulative: f64,
    shift_cumulative: f64,
    check_time: f64,
    shift_end: f64,
    shift_capacity: f64,
    rhythm_minutes: f64,
    roll_config: &RollChangeConfig,
) -> Option<CandidateEval> {
    let need_roll_change =
        should_roll_change(&sm.material, prev_material, roll_cumulative, roll_config);
    let extra_time = if need_roll_change {
        roll_config.change_duration_min
    } else {
        0.0
    };
    if check_time + rhythm_minutes + extra_time > shift_end
        || shift_cumulative + sm.material.weight > shift_capacity
    {
        return None;
    }
    Some(CandidateEval {
        need_roll_change,
        next_check_time: check_time + rhythm_minutes + extra_time,
        next_shift_cumulative: shift_cumulative + sm.material.weight,
        next_roll_cumulative: if need_roll_change {
            sm.material.weight
        } else {
            roll_cumulative + sm.material.weight
        },
    })
}

fn candidate_increment_score(
    rank: usize,
    total_candidates: usize,
    sm: &SortedMaterial,
    eval: &CandidateEval,
    shift_capacity: f64,
    shift_cumulative: f64,
) -> f64 {
    let total = total_candidates.max(1) as f64;
    let priority_ratio = 1.0 - rank as f64 / total;
    let remain_before = (shift_capacity - shift_cumulative).max(1.0);
    let fill_ratio = (sm.material.weight / remain_before).clamp(0.0, 1.0);
    let tail_bonus = if shift_capacity - eval.next_shift_cumulative <= 80.0 {
        0.08
    } else {
        0.0
    };
    let roll_penalty = if eval.need_roll_change { 0.10 } else { 0.0 };
    priority_ratio * 0.62 + fill_ratio * 0.38 + tail_bonus - roll_penalty
}

fn greedy_pick_next_position(
    sorted: &[SortedMaterial],
    available_pool: &[usize],
    unscheduled_positions: &[usize],
    prev_sorted_idx: Option<usize>,
    roll_cumulative: f64,
    shift_cumulative: f64,
    check_time: f64,
    shift_end: f64,
    shift_capacity: f64,
    rhythm_minutes: f64,
    roll_config: &RollChangeConfig,
) -> Option<usize> {
    let mut best: Option<(usize, f64)> = None;
    for (rank, &pool_idx) in unscheduled_positions.iter().enumerate() {
        let sorted_idx = available_pool[pool_idx];
        let sm = &sorted[sorted_idx];
        let prev_material = prev_sorted_idx.map(|idx| &sorted[idx].material);
        let Some(eval) = evaluate_candidate(
            sm,
            prev_material,
            roll_cumulative,
            shift_cumulative,
            check_time,
            shift_end,
            shift_capacity,
            rhythm_minutes,
            roll_config,
        ) else {
            continue;
        };
        let score = candidate_increment_score(
            rank,
            unscheduled_positions.len(),
            sm,
            &eval,
            shift_capacity,
            shift_cumulative,
        );
        if best
            .map(|(_, best_score)| score > best_score)
            .unwrap_or(true)
        {
            best = Some((pool_idx, score));
        }
    }
    best.map(|(idx, _)| idx)
}

fn beam_pick_next_position(
    cfg: &HybridSchedulerConfig,
    beam_nodes_used: &mut usize,
    sorted: &[SortedMaterial],
    available_pool: &[usize],
    unscheduled_positions: &[usize],
    prev_sorted_idx: Option<usize>,
    roll_cumulative: f64,
    shift_cumulative: f64,
    check_time: f64,
    shift_end: f64,
    shift_capacity: f64,
    rhythm_minutes: f64,
    roll_config: &RollChangeConfig,
) -> Option<usize> {
    if unscheduled_positions.is_empty() || cfg.beam_width < 2 || cfg.beam_lookahead < 2 {
        return None;
    }

    let candidate_positions: Vec<usize> = unscheduled_positions
        .iter()
        .take(cfg.beam_top_k)
        .copied()
        .collect();
    if candidate_positions.is_empty() {
        return None;
    }

    let mut beam = vec![BeamState {
        selected_positions: Vec::new(),
        check_time,
        shift_cumulative,
        roll_cumulative,
        prev_sorted_idx,
        score: 0.0,
    }];

    for _ in 0..cfg.beam_lookahead {
        let mut next_beam: Vec<BeamState> = Vec::new();
        for state in &beam {
            for (rank, &pool_idx) in candidate_positions.iter().enumerate() {
                if state.selected_positions.contains(&pool_idx) {
                    continue;
                }
                let sorted_idx = available_pool[pool_idx];
                let sm = &sorted[sorted_idx];
                let prev_material = state.prev_sorted_idx.map(|idx| &sorted[idx].material);
                let Some(eval) = evaluate_candidate(
                    sm,
                    prev_material,
                    state.roll_cumulative,
                    state.shift_cumulative,
                    state.check_time,
                    shift_end,
                    shift_capacity,
                    rhythm_minutes,
                    roll_config,
                ) else {
                    continue;
                };

                *beam_nodes_used += 1;
                if *beam_nodes_used >= cfg.max_nodes {
                    if let Some(best_state) = beam
                        .iter()
                        .max_by(|a, b| a.score.total_cmp(&b.score))
                        .filter(|s| !s.selected_positions.is_empty())
                    {
                        return best_state.selected_positions.first().copied();
                    }
                    return None;
                }

                let mut selected_positions = state.selected_positions.clone();
                selected_positions.push(pool_idx);
                let score_delta = candidate_increment_score(
                    rank,
                    candidate_positions.len(),
                    sm,
                    &eval,
                    shift_capacity,
                    state.shift_cumulative,
                );
                next_beam.push(BeamState {
                    selected_positions,
                    check_time: eval.next_check_time,
                    shift_cumulative: eval.next_shift_cumulative,
                    roll_cumulative: eval.next_roll_cumulative,
                    prev_sorted_idx: Some(sorted_idx),
                    score: state.score + score_delta,
                });
            }
        }

        if next_beam.is_empty() {
            break;
        }

        next_beam.sort_by(|a, b| b.score.total_cmp(&a.score));
        next_beam.truncate(cfg.beam_width);
        beam = next_beam;
    }

    beam.iter()
        .filter(|state| !state.selected_positions.is_empty())
        .max_by(|a, b| a.score.total_cmp(&b.score))
        .and_then(|state| state.selected_positions.first().copied())
}

fn pick_next_pool_position(
    cfg: &HybridSchedulerConfig,
    elapsed_ms: u128,
    beam_nodes_used: &mut usize,
    sorted: &[SortedMaterial],
    available_pool: &[usize],
    unscheduled_positions: &[usize],
    prev_sorted_idx: Option<usize>,
    roll_cumulative: f64,
    shift_cumulative: f64,
    check_time: f64,
    shift_end: f64,
    shift_capacity: f64,
    rhythm_minutes: f64,
    roll_config: &RollChangeConfig,
) -> Option<(usize, PickMode)> {
    let beam_allowed = cfg.mode != SchedulerMode::GreedyOnly
        && elapsed_ms <= cfg.time_budget_ms
        && *beam_nodes_used < cfg.max_nodes;

    if beam_allowed {
        if let Some(pool_idx) = beam_pick_next_position(
            cfg,
            beam_nodes_used,
            sorted,
            available_pool,
            unscheduled_positions,
            prev_sorted_idx,
            roll_cumulative,
            shift_cumulative,
            check_time,
            shift_end,
            shift_capacity,
            rhythm_minutes,
            roll_config,
        ) {
            return Some((pool_idx, PickMode::Beam));
        }
    }

    if cfg.mode == SchedulerMode::BeamOnly && !cfg.fallback_enabled {
        return None;
    }

    let greedy = greedy_pick_next_position(
        sorted,
        available_pool,
        unscheduled_positions,
        prev_sorted_idx,
        roll_cumulative,
        shift_cumulative,
        check_time,
        shift_end,
        shift_capacity,
        rhythm_minutes,
        roll_config,
    )?;
    let mode = if cfg.mode == SchedulerMode::GreedyOnly {
        PickMode::GreedyOnly
    } else {
        PickMode::GreedyFallback
    };
    Some((greedy, mode))
}

/// 动态判断是否需要在当前材料前换辊
fn should_roll_change(
    current: &material::Model,
    prev: Option<&material::Model>,
    cumulative_weight: f64,
    config: &RollChangeConfig,
) -> bool {
    if cumulative_weight < config.tonnage_threshold {
        return false;
    }
    // 达到吨位阈值
    if let Some(prev_mat) = prev {
        let width_diff = (prev_mat.width - current.width).abs();
        if width_diff >= config.width_jump_threshold {
            return true; // 自然断点（宽度跳跃），立即换辊
        }
    }
    // finish_last_coil=false 时直接换辊；=true 时也需换辊（已达阈值）
    true
}

/// 格式化分钟数为 HH:MM
fn format_time(minutes: f64) -> String {
    let total_min = minutes.round() as u32;
    let h = (total_min / 60) % 24;
    let m = total_min % 60;
    format!("{:02}:{:02}", h, m)
}

/// 简单日期递增 (YYYY-MM-DD)
pub fn next_date(date_str: &str) -> String {
    use chrono::NaiveDate;
    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        (d + Duration::days(1)).format("%Y-%m-%d").to_string()
    } else {
        date_str.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::test_helpers::helpers::{make_material, wrap};

    #[test]
    fn pick_next_pool_position_should_skip_infeasible_head_candidate() {
        let sorted = vec![
            wrap(make_material(1, "C001", 1200.0, 150.0)), // 超出班次产能，不可排
            wrap(make_material(2, "C002", 1150.0, 80.0)),
        ];
        let available_pool = vec![0usize, 1usize];
        let unscheduled_positions = vec![0usize, 1usize];
        let roll_config = RollChangeConfig::default();
        let cfg = HybridSchedulerConfig {
            mode: SchedulerMode::GreedyOnly,
            ..Default::default()
        };
        let mut beam_nodes_used = 0usize;

        let pick = pick_next_pool_position(
            &cfg,
            0,
            &mut beam_nodes_used,
            &sorted,
            &available_pool,
            &unscheduled_positions,
            None,
            0.0,
            0.0,
            480.0,
            720.0,
            100.0,
            3.5,
            &roll_config,
        )
        .expect("应命中后续可排候选");

        assert_eq!(pick.0, 1);
        assert_eq!(pick.1, PickMode::GreedyOnly);
    }

    #[test]
    fn pick_next_pool_position_beam_only_without_fallback_should_return_none_when_beam_disabled() {
        let sorted = vec![wrap(make_material(1, "C001", 1200.0, 80.0))];
        let available_pool = vec![0usize];
        let unscheduled_positions = vec![0usize];
        let roll_config = RollChangeConfig::default();
        let cfg = HybridSchedulerConfig {
            mode: SchedulerMode::BeamOnly,
            beam_width: 1, // 触发 beam 直接不可用
            fallback_enabled: false,
            ..Default::default()
        };
        let mut beam_nodes_used = 0usize;

        let pick = pick_next_pool_position(
            &cfg,
            0,
            &mut beam_nodes_used,
            &sorted,
            &available_pool,
            &unscheduled_positions,
            None,
            0.0,
            0.0,
            480.0,
            720.0,
            100.0,
            3.5,
            &roll_config,
        );

        assert!(pick.is_none());
    }

    #[test]
    fn pick_next_pool_position_hybrid_should_fallback_to_greedy_when_time_budget_exceeded() {
        let sorted = vec![wrap(make_material(1, "C001", 1200.0, 80.0))];
        let available_pool = vec![0usize];
        let unscheduled_positions = vec![0usize];
        let roll_config = RollChangeConfig::default();
        let cfg = HybridSchedulerConfig {
            mode: SchedulerMode::Hybrid,
            time_budget_ms: 1,
            fallback_enabled: true,
            ..Default::default()
        };
        let mut beam_nodes_used = 0usize;

        let pick = pick_next_pool_position(
            &cfg,
            10, // 超过预算，Beam 不可用
            &mut beam_nodes_used,
            &sorted,
            &available_pool,
            &unscheduled_positions,
            None,
            0.0,
            0.0,
            480.0,
            720.0,
            100.0,
            3.5,
            &roll_config,
        )
        .expect("应触发贪心兜底");

        assert_eq!(pick.0, 0);
        assert_eq!(pick.1, PickMode::GreedyFallback);
    }
}

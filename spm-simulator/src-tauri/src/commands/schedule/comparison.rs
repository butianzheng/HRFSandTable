use super::risk::RiskViolationItem;
use crate::utils::log::write_operation_log;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct PlanComparisonSide {
    pub plan_id: i32,
    pub plan_name: String,
    pub plan_no: String,
    pub status: String,
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
    pub steel_grade_switches: i32,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlanComparisonResult {
    pub plan_a: PlanComparisonSide,
    pub plan_b: PlanComparisonSide,
    pub common_count: i32,
    pub only_a_count: i32,
    pub only_b_count: i32,
    pub common_coils: Vec<String>,
    pub only_a_coils: Vec<String>,
    pub only_b_coils: Vec<String>,
    pub sequence_changes: Vec<SequenceChangeItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SequenceChangeItem {
    pub coil_id: String,
    pub sequence_a: i32,
    pub sequence_b: i32,
    pub delta: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PlanOverlapItem {
    pub plan_a_id: i32,
    pub plan_b_id: i32,
    pub common_count: i32,
    pub only_a_count: i32,
    pub only_b_count: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MultiPlanComparisonResult {
    pub plans: Vec<PlanComparisonSide>,
    pub overlaps: Vec<PlanOverlapItem>,
}

pub fn format_sequence_movement(delta: i32) -> String {
    use std::cmp::Ordering;
    match delta.cmp(&0) {
        Ordering::Greater => format!("后移+{}", delta),
        Ordering::Less => format!("前移{}", delta.abs()),
        Ordering::Equal => "无变化".to_string(),
    }
}

pub fn build_constraint_risk_map(
    violations: &[RiskViolationItem],
) -> std::collections::HashMap<String, (i32, i32, i32, i32)> {
    let mut map = std::collections::HashMap::new();
    for item in violations {
        let key = if item.constraint_type.is_empty() {
            "unknown".to_string()
        } else {
            item.constraint_type.clone()
        };
        let entry = map.entry(key).or_insert((0, 0, 0, 0));
        if item.severity == "high" {
            entry.0 += 1;
        } else if item.severity == "medium" {
            entry.1 += 1;
        } else {
            entry.2 += 1;
        }
        entry.3 += 1;
    }
    map
}

pub fn build_comparison_side(
    plan: &crate::models::schedule_plan::Model,
    items: &[crate::models::schedule_item::Model],
    mat_map: &std::collections::HashMap<i32, &crate::models::material::Model>,
) -> PlanComparisonSide {
    let mut steel_switches = 0i32;
    for i in 1..items.len() {
        let prev_grade = mat_map
            .get(&items[i - 1].material_id)
            .map(|m| &m.steel_grade);
        let curr_grade = mat_map.get(&items[i].material_id).map(|m| &m.steel_grade);
        if prev_grade != curr_grade {
            steel_switches += 1;
        }
    }

    PlanComparisonSide {
        plan_id: plan.id,
        plan_name: plan.name.clone(),
        plan_no: plan.plan_no.clone(),
        status: plan.status.clone().unwrap_or_default(),
        score_overall: plan.score_overall.unwrap_or(0),
        score_sequence: plan.score_sequence.unwrap_or(0),
        score_delivery: plan.score_delivery.unwrap_or(0),
        score_efficiency: plan.score_efficiency.unwrap_or(0),
        total_count: plan.total_count.unwrap_or(0),
        total_weight: plan.total_weight.unwrap_or(0.0),
        roll_change_count: plan.roll_change_count.unwrap_or(0),
        risk_high: plan.risk_count_high.unwrap_or(0),
        risk_medium: plan.risk_count_medium.unwrap_or(0),
        risk_low: plan.risk_count_low.unwrap_or(0),
        steel_grade_switches: steel_switches,
        created_at: plan.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
    }
}

#[tauri::command]
pub async fn compare_plans(
    plan_a_id: i32,
    plan_b_id: i32,
) -> Result<PlanComparisonResult, AppError> {
    use crate::db::get_db;
    use crate::models::{material, schedule_item, schedule_plan};
    use sea_orm::*;

    let db = get_db();

    // 加载两个方案
    let plan_a = schedule_plan::Entity::find_by_id(plan_a_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_a_id))?;
    let plan_b = schedule_plan::Entity::find_by_id(plan_b_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_b_id))?;

    // 加载排程项
    let items_a = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_a_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;
    let items_b = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_b_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    // 收集所有材料 ID 并加载
    let mut all_mat_ids: Vec<i32> = items_a
        .iter()
        .map(|i| i.material_id)
        .chain(items_b.iter().map(|i| i.material_id))
        .collect();
    all_mat_ids.sort_unstable();
    all_mat_ids.dedup();

    let mats = if all_mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(all_mat_ids))
            .all(db)
            .await?
    };
    let mat_map: std::collections::HashMap<i32, &material::Model> =
        mats.iter().map(|m| (m.id, m)).collect();

    // 构建对比双方数据
    let side_a = build_comparison_side(&plan_a, &items_a, &mat_map);
    let side_b = build_comparison_side(&plan_b, &items_b, &mat_map);

    // 材料重叠分析
    let coils_a: std::collections::HashSet<String> = items_a
        .iter()
        .filter_map(|i| mat_map.get(&i.material_id).map(|m| m.coil_id.clone()))
        .collect();
    let coils_b: std::collections::HashSet<String> = items_b
        .iter()
        .filter_map(|i| mat_map.get(&i.material_id).map(|m| m.coil_id.clone()))
        .collect();

    let mut common: Vec<String> = coils_a.intersection(&coils_b).cloned().collect();
    let mut only_a: Vec<String> = coils_a.difference(&coils_b).cloned().collect();
    let mut only_b: Vec<String> = coils_b.difference(&coils_a).cloned().collect();
    common.sort();
    only_a.sort();
    only_b.sort();

    let seq_map_a: std::collections::HashMap<String, i32> = items_a
        .iter()
        .filter_map(|i| {
            mat_map
                .get(&i.material_id)
                .map(|m| (m.coil_id.clone(), i.sequence))
        })
        .collect();
    let seq_map_b: std::collections::HashMap<String, i32> = items_b
        .iter()
        .filter_map(|i| {
            mat_map
                .get(&i.material_id)
                .map(|m| (m.coil_id.clone(), i.sequence))
        })
        .collect();

    let mut sequence_changes: Vec<SequenceChangeItem> = common
        .iter()
        .filter_map(|coil_id| {
            let seq_a = *seq_map_a.get(coil_id)?;
            let seq_b = *seq_map_b.get(coil_id)?;
            let delta = seq_b - seq_a;
            if delta == 0 {
                return None;
            }
            Some(SequenceChangeItem {
                coil_id: coil_id.clone(),
                sequence_a: seq_a,
                sequence_b: seq_b,
                delta,
            })
        })
        .collect();
    sequence_changes.sort_by(|a, b| {
        b.delta
            .abs()
            .cmp(&a.delta.abs())
            .then_with(|| a.sequence_a.cmp(&b.sequence_a))
    });

    Ok(PlanComparisonResult {
        plan_a: side_a,
        plan_b: side_b,
        common_count: common.len() as i32,
        only_a_count: only_a.len() as i32,
        only_b_count: only_b.len() as i32,
        common_coils: common,
        only_a_coils: only_a,
        only_b_coils: only_b,
        sequence_changes,
    })
}

#[tauri::command]
pub async fn export_compare_sequence_csv(
    plan_a_id: i32,
    plan_b_id: i32,
    file_path: String,
) -> Result<usize, AppError> {
    let comparison = compare_plans(plan_a_id, plan_b_id).await?;
    let row_count = comparison.sequence_changes.len();

    let path = std::path::PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let mut writer = csv::Writer::from_path(&file_path)
        .map_err(|e| AppError::DataConversionError(format!("创建CSV失败: {}", e)))?;
    writer
        .write_record(["coil_id", "sequence_a", "sequence_b", "delta", "move"])
        .map_err(|e| AppError::DataConversionError(format!("写CSV表头失败: {}", e)))?;
    for item in &comparison.sequence_changes {
        let movement = format_sequence_movement(item.delta);
        writer
            .write_record([
                item.coil_id.as_str(),
                &item.sequence_a.to_string(),
                &item.sequence_b.to_string(),
                &item.delta.to_string(),
                movement.as_str(),
            ])
            .map_err(|e| AppError::DataConversionError(format!("写CSV数据失败: {}", e)))?;
    }
    writer
        .flush()
        .map_err(|e| AppError::DataConversionError(format!("写CSV失败: {}", e)))?;

    write_operation_log(
        "export",
        "export_compare_sequence_csv",
        Some("plan_compare"),
        Some(plan_a_id),
        Some(format!(
            "导出方案顺序差异: A={} B={} rows={} path={}",
            plan_a_id, plan_b_id, row_count, file_path
        )),
    )
    .await;

    Ok(row_count)
}

#[tauri::command]
pub async fn export_compare_sequence_excel(
    plan_a_id: i32,
    plan_b_id: i32,
    file_path: String,
) -> Result<usize, AppError> {
    use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};

    let comparison = compare_plans(plan_a_id, plan_b_id).await?;
    let row_count = comparison.sequence_changes.len();

    let path = std::path::PathBuf::from(&file_path);
    if let Some(parent) = path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let mut workbook = Workbook::new();
    let sheet = workbook.add_worksheet();
    sheet
        .set_name("顺序差异")
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let header_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_background_color(Color::RGB(0x1677FF))
        .set_font_color(Color::White)
        .set_font_size(11.0);
    let data_fmt = Format::new().set_font_size(10.0);
    let center_fmt = Format::new()
        .set_align(FormatAlign::Center)
        .set_font_size(10.0);

    let headers: [(&str, f64); 5] = [
        ("卷号", 22.0),
        ("A序号", 10.0),
        ("B序号", 10.0),
        ("变化(B-A)", 12.0),
        ("位移说明", 14.0),
    ];
    for (col, (title, width)) in headers.iter().enumerate() {
        sheet
            .write_string_with_format(0, col as u16, *title, &header_fmt)
            .map_err(|e| AppError::FileError(e.to_string()))?;
        sheet
            .set_column_width(col as u16, *width)
            .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    for (idx, item) in comparison.sequence_changes.iter().enumerate() {
        let row = (idx + 1) as u32;
        let movement = format_sequence_movement(item.delta);
        sheet
            .write_string_with_format(row, 0, &item.coil_id, &data_fmt)
            .map_err(|e| AppError::FileError(e.to_string()))?;
        sheet
            .write_number_with_format(row, 1, item.sequence_a as f64, &center_fmt)
            .map_err(|e| AppError::FileError(e.to_string()))?;
        sheet
            .write_number_with_format(row, 2, item.sequence_b as f64, &center_fmt)
            .map_err(|e| AppError::FileError(e.to_string()))?;
        sheet
            .write_number_with_format(row, 3, item.delta as f64, &center_fmt)
            .map_err(|e| AppError::FileError(e.to_string()))?;
        sheet
            .write_string_with_format(row, 4, movement, &data_fmt)
            .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    let moved_total = row_count as i32;
    let backward_count = comparison
        .sequence_changes
        .iter()
        .filter(|item| item.delta > 0)
        .count() as i32;
    let forward_count = comparison
        .sequence_changes
        .iter()
        .filter(|item| item.delta < 0)
        .count() as i32;
    let avg_abs_move = if row_count > 0 {
        comparison
            .sequence_changes
            .iter()
            .map(|item| item.delta.abs() as f64)
            .sum::<f64>()
            / row_count as f64
    } else {
        0.0
    };
    let max_move = comparison
        .sequence_changes
        .iter()
        .max_by_key(|item| item.delta.abs());

    let summary = workbook.add_worksheet();
    summary
        .set_name("统计摘要")
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .set_column_width(0, 18.0)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .set_column_width(1, 32.0)
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let summary_label_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Right)
        .set_font_size(11.0);
    let summary_value_fmt = Format::new().set_font_size(11.0);

    summary
        .write_string_with_format(0, 0, "方案A", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_number_with_format(0, 1, plan_a_id as f64, &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(1, 0, "方案B", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_number_with_format(1, 1, plan_b_id as f64, &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(2, 0, "顺序变化卷数", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_number_with_format(2, 1, moved_total as f64, &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(3, 0, "前移卷数", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_number_with_format(3, 1, forward_count as f64, &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(4, 0, "后移卷数", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_number_with_format(4, 1, backward_count as f64, &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(5, 0, "平均位移", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(5, 1, format!("{:.2}", avg_abs_move), &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(6, 0, "最大位移", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    let max_move_value = max_move
        .map(|item| format!("{} (Δ{})", item.coil_id, item.delta))
        .unwrap_or_else(|| "-".to_string());
    summary
        .write_string_with_format(6, 1, max_move_value, &summary_value_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(7, 0, "导出时间", &summary_label_fmt)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .write_string_with_format(
            7,
            1,
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
            &summary_value_fmt,
        )
        .map_err(|e| AppError::FileError(e.to_string()))?;

    workbook
        .save(&file_path)
        .map_err(|e| AppError::FileError(e.to_string()))?;

    write_operation_log(
        "export",
        "export_compare_sequence_excel",
        Some("plan_compare"),
        Some(plan_a_id),
        Some(format!(
            "导出方案顺序差异Excel: A={} B={} rows={} path={}",
            plan_a_id, plan_b_id, row_count, file_path
        )),
    )
    .await;

    Ok(row_count)
}

#[tauri::command]
pub async fn compare_plans_multi(
    plan_ids: Vec<i32>,
) -> Result<MultiPlanComparisonResult, AppError> {
    use crate::db::get_db;
    use crate::models::{material, schedule_item, schedule_plan};
    use sea_orm::*;

    if plan_ids.len() < 2 || plan_ids.len() > 3 {
        return Err(AppError::ConstraintViolation(
            "仅支持2-3个方案对比".to_string(),
        ));
    }

    let mut dedup = Vec::with_capacity(plan_ids.len());
    for id in plan_ids {
        if !dedup.contains(&id) {
            dedup.push(id);
        }
    }
    if dedup.len() < 2 {
        return Err(AppError::ConstraintViolation(
            "请至少选择两个不同方案".to_string(),
        ));
    }
    if dedup.len() > 3 {
        return Err(AppError::ConstraintViolation(
            "最多仅支持3个方案".to_string(),
        ));
    }

    let db = get_db();

    let mut plan_models = Vec::with_capacity(dedup.len());
    let mut items_map: std::collections::HashMap<i32, Vec<schedule_item::Model>> =
        std::collections::HashMap::new();
    let mut all_mat_ids: Vec<i32> = Vec::new();

    for pid in &dedup {
        let plan = schedule_plan::Entity::find_by_id(*pid)
            .one(db)
            .await?
            .ok_or(AppError::PlanNotFound(*pid))?;
        let items = schedule_item::Entity::find()
            .filter(schedule_item::Column::PlanId.eq(*pid))
            .order_by_asc(schedule_item::Column::Sequence)
            .all(db)
            .await?;

        all_mat_ids.extend(items.iter().map(|item| item.material_id));
        items_map.insert(*pid, items);
        plan_models.push(plan);
    }

    all_mat_ids.sort_unstable();
    all_mat_ids.dedup();
    let mats = if all_mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(all_mat_ids))
            .all(db)
            .await?
    };
    let mat_map: std::collections::HashMap<i32, &material::Model> =
        mats.iter().map(|m| (m.id, m)).collect();

    let mut plan_side_map: std::collections::HashMap<i32, PlanComparisonSide> =
        std::collections::HashMap::new();
    let mut coil_set_map: std::collections::HashMap<i32, std::collections::HashSet<String>> =
        std::collections::HashMap::new();

    for plan in &plan_models {
        let items = items_map.get(&plan.id).cloned().unwrap_or_default();
        let side = build_comparison_side(plan, &items, &mat_map);
        let coil_set: std::collections::HashSet<String> = items
            .iter()
            .filter_map(|item| mat_map.get(&item.material_id).map(|m| m.coil_id.clone()))
            .collect();
        plan_side_map.insert(plan.id, side);
        coil_set_map.insert(plan.id, coil_set);
    }

    let plans = dedup
        .iter()
        .filter_map(|pid| plan_side_map.remove(pid))
        .collect::<Vec<_>>();

    let mut overlaps = Vec::new();
    for i in 0..dedup.len() {
        for j in (i + 1)..dedup.len() {
            let a_id = dedup[i];
            let b_id = dedup[j];
            let Some(a_set) = coil_set_map.get(&a_id) else {
                continue;
            };
            let Some(b_set) = coil_set_map.get(&b_id) else {
                continue;
            };

            let common_count = a_set.intersection(b_set).count() as i32;
            let only_a_count = a_set.difference(b_set).count() as i32;
            let only_b_count = b_set.difference(a_set).count() as i32;

            overlaps.push(PlanOverlapItem {
                plan_a_id: a_id,
                plan_b_id: b_id,
                common_count,
                only_a_count,
                only_b_count,
            });
        }
    }

    Ok(MultiPlanComparisonResult { plans, overlaps })
}

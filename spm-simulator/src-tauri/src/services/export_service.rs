use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};
use sea_orm::*;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{HashMap, HashSet};

use crate::db::get_db;
use crate::models::{export_template, material, schedule_item, schedule_plan};
use crate::AppError;

const DEFAULT_EXCEL_COLUMN_KEYS: [&str; 23] = [
    "sequence",
    "coil_id",
    "steel_grade",
    "thickness",
    "width",
    "weight",
    "shift_date",
    "shift_no",
    "shift_type",
    "planned_start",
    "planned_end",
    "cumulative_weight",
    "is_roll_change",
    "is_locked",
    "risk_flags",
    "contract_no",
    "customer_name",
    "hardness_level",
    "surface_level",
    "product_type",
    "due_date",
    "temp_status",
    "remarks",
];

const DEFAULT_CSV_COLUMN_KEYS: [&str; 20] = [
    "sequence",
    "coil_id",
    "steel_grade",
    "thickness",
    "width",
    "weight",
    "shift_date",
    "shift_no",
    "shift_type",
    "planned_start",
    "planned_end",
    "cumulative_weight",
    "is_roll_change",
    "is_locked",
    "risk_flags",
    "contract_no",
    "customer_name",
    "due_date",
    "temp_status",
    "remarks",
];

#[derive(Debug, Clone)]
struct ExportColumn {
    key: String,
    title: String,
    width: f64,
    center: bool,
}

#[derive(Debug, Clone)]
struct PlanExportRow {
    sequence: i32,
    coil_id: String,
    steel_grade: String,
    thickness: f64,
    width: f64,
    weight: f64,
    shift_date: String,
    shift_no: i32,
    shift_type: String,
    planned_start: String,
    planned_end: String,
    cumulative_weight: f64,
    is_roll_change: bool,
    is_locked: bool,
    risk_flags: String,
    contract_no: String,
    customer_name: String,
    hardness_level: String,
    surface_level: String,
    product_type: String,
    due_date: String,
    temp_status: String,
    remarks: String,
}

#[derive(Debug, Clone, Default)]
struct ColumnFormatRule {
    digits: Option<usize>,
    prefix: Option<String>,
    suffix: Option<String>,
    true_text: Option<String>,
    false_text: Option<String>,
    empty_text: Option<String>,
    date_format: Option<String>,
    uppercase: bool,
    lowercase: bool,
}

impl ColumnFormatRule {
    fn is_empty(&self) -> bool {
        self.digits.is_none()
            && self.prefix.is_none()
            && self.suffix.is_none()
            && self.true_text.is_none()
            && self.false_text.is_none()
            && self.empty_text.is_none()
            && self.date_format.is_none()
            && !self.uppercase
            && !self.lowercase
    }
}

#[derive(Debug, Clone, Default)]
struct TemplateExportSpec {
    columns: Vec<ExportColumn>,
    rules: HashMap<String, ColumnFormatRule>,
}

#[derive(Debug, Clone)]
enum RawCellValue {
    Int(i64),
    Number(f64),
    Bool(bool),
    Text(String),
}

/// 导出排程方案到 Excel
pub async fn export_plan_to_excel(
    plan_id: i32,
    file_path: &str,
    template_id: Option<i32>,
) -> Result<usize, AppError> {
    if let Some(template_id) = template_id {
        return export_plan_to_excel_with_template(plan_id, file_path, template_id).await;
    }

    let db = get_db();

    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    let items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let mat_ids: Vec<i32> = items.iter().map(|i| i.material_id).collect();
    let mats = if mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(mat_ids))
            .all(db)
            .await?
    };
    let mat_map: HashMap<i32, &material::Model> = mats.iter().map(|m| (m.id, m)).collect();

    let mut workbook = Workbook::new();

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

    // ─── Sheet 1: 排程明细 ───
    let sheet = workbook.add_worksheet();
    sheet
        .set_name(format!("排程明细-{}", plan.plan_no))
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let headers: Vec<(&str, f64)> = vec![
        ("序号", 8.0),
        ("钢卷号", 16.0),
        ("钢种", 14.0),
        ("厚度(mm)", 10.0),
        ("宽度(mm)", 10.0),
        ("重量(t)", 10.0),
        ("班次日期", 14.0),
        ("班次", 8.0),
        ("班型", 8.0),
        ("计划开始", 18.0),
        ("计划结束", 18.0),
        ("累计重量(t)", 12.0),
        ("换辊", 8.0),
        ("锁定", 8.0),
        ("风险标记", 16.0),
        ("合同号", 14.0),
        ("客户", 14.0),
        ("硬度等级", 10.0),
        ("表面等级", 10.0),
        ("产品大类", 12.0),
        ("交期", 14.0),
        ("适温状态", 10.0),
        ("备注", 20.0),
    ];

    for (col, (name, width)) in headers.iter().enumerate() {
        write_cell_str(sheet, 0, col as u16, name, &header_fmt)?;
        sheet
            .set_column_width(col as u16, *width)
            .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    let row_count = items.len();
    for (idx, item) in items.iter().enumerate() {
        let row = (idx + 1) as u32;
        let mat = mat_map.get(&item.material_id);

        write_cell_num(sheet, row, 0, item.sequence as f64, &center_fmt)?;
        write_cell_str(
            sheet,
            row,
            1,
            mat.map(|m| m.coil_id.as_str()).unwrap_or("-"),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            2,
            mat.map(|m| m.steel_grade.as_str()).unwrap_or("-"),
            &data_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            3,
            mat.map(|m| m.thickness).unwrap_or(0.0),
            &data_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            4,
            mat.map(|m| m.width).unwrap_or(0.0),
            &data_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            5,
            mat.map(|m| m.weight).unwrap_or(0.0),
            &data_fmt,
        )?;
        write_cell_str(sheet, row, 6, &item.shift_date, &center_fmt)?;
        write_cell_num(sheet, row, 7, item.shift_no as f64, &center_fmt)?;
        write_cell_str(sheet, row, 8, &item.shift_type, &center_fmt)?;
        write_cell_str(
            sheet,
            row,
            9,
            item.planned_start.as_deref().unwrap_or("-"),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            10,
            item.planned_end.as_deref().unwrap_or("-"),
            &data_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            11,
            item.cumulative_weight.unwrap_or(0.0),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            12,
            if item.is_roll_change.unwrap_or(false) {
                "是"
            } else {
                ""
            },
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            13,
            if item.is_locked.unwrap_or(false) {
                "是"
            } else {
                ""
            },
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            14,
            item.risk_flags.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            15,
            mat.and_then(|m| m.contract_no.as_deref()).unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            16,
            mat.and_then(|m| m.customer_name.as_deref()).unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            17,
            mat.and_then(|m| m.hardness_level.as_deref()).unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            18,
            mat.and_then(|m| m.surface_level.as_deref()).unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            19,
            mat.and_then(|m| m.product_type.as_deref()).unwrap_or(""),
            &data_fmt,
        )?;

        let due_str = mat
            .and_then(|m| m.due_date)
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        write_cell_str(sheet, row, 20, &due_str, &center_fmt)?;
        write_cell_str(
            sheet,
            row,
            21,
            mat.and_then(|m| m.temp_status.as_deref()).unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            22,
            mat.and_then(|m| m.remarks.as_deref()).unwrap_or(""),
            &data_fmt,
        )?;
    }

    // ─── Sheet 2: 方案摘要 ───
    let summary = workbook.add_worksheet();
    summary
        .set_name("方案摘要")
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let label_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Right)
        .set_font_size(11.0);
    let value_fmt = Format::new().set_font_size(11.0);

    summary
        .set_column_width(0, 14.0)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .set_column_width(1, 30.0)
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let info: Vec<(&str, String)> = vec![
        ("方案编号:", plan.plan_no.clone()),
        ("方案名称:", plan.name.clone()),
        ("周期类型:", plan.period_type.clone()),
        ("开始日期:", plan.start_date.clone()),
        ("结束日期:", plan.end_date.clone()),
        ("状态:", plan.status.clone().unwrap_or_default()),
        ("版本:", format!("v{}", plan.version.unwrap_or(1))),
        ("排程数:", format!("{}", plan.total_count.unwrap_or(0))),
        (
            "总重量:",
            format!("{:.1}t", plan.total_weight.unwrap_or(0.0)),
        ),
        (
            "换辊次数:",
            format!("{}", plan.roll_change_count.unwrap_or(0)),
        ),
        ("综合评分:", format!("{}", plan.score_overall.unwrap_or(0))),
        ("序列评分:", format!("{}", plan.score_sequence.unwrap_or(0))),
        ("交期评分:", format!("{}", plan.score_delivery.unwrap_or(0))),
        (
            "效率评分:",
            format!("{}", plan.score_efficiency.unwrap_or(0)),
        ),
        ("高风险:", format!("{}", plan.risk_count_high.unwrap_or(0))),
        (
            "中风险:",
            format!("{}", plan.risk_count_medium.unwrap_or(0)),
        ),
        ("低风险:", format!("{}", plan.risk_count_low.unwrap_or(0))),
    ];

    for (idx, (label, value)) in info.iter().enumerate() {
        write_cell_str(summary, idx as u32, 0, label, &label_fmt)?;
        write_cell_str(summary, idx as u32, 1, value, &value_fmt)?;
    }

    workbook
        .save(file_path)
        .map_err(|e| AppError::FileError(format!("保存Excel失败: {}", e)))?;

    Ok(row_count)
}

/// 导出材料列表到 Excel
pub async fn export_materials_to_excel(
    file_path: &str,
    status_filter: Option<String>,
) -> Result<usize, AppError> {
    let db = get_db();

    let mut query = material::Entity::find();
    if let Some(ref status) = status_filter {
        query = query.filter(material::Column::Status.eq(status.clone()));
    }
    let mats = query
        .order_by_desc(material::Column::CreatedAt)
        .all(db)
        .await?;

    let mut workbook = Workbook::new();
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

    let sheet = workbook.add_worksheet();
    sheet
        .set_name("材料清单")
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let headers: Vec<(&str, f64)> = vec![
        ("钢卷号", 16.0),
        ("合同号", 14.0),
        ("客户名称", 16.0),
        ("客户代码", 12.0),
        ("钢种", 14.0),
        ("厚度(mm)", 10.0),
        ("宽度(mm)", 10.0),
        ("重量(t)", 10.0),
        ("硬度等级", 10.0),
        ("表面等级", 10.0),
        ("粗糙度要求", 10.0),
        ("延伸率要求", 10.0),
        ("产品大类", 12.0),
        ("合同属性", 10.0),
        ("合同性质", 10.0),
        ("出口标志", 8.0),
        ("集批代码", 12.0),
        ("卷取时间", 18.0),
        ("适温状态", 10.0),
        ("等温天数", 10.0),
        ("已适温", 8.0),
        ("库龄(天)", 10.0),
        ("库位", 10.0),
        ("交期", 14.0),
        ("状态", 10.0),
        ("自动优先级", 10.0),
        ("人工调整", 10.0),
        ("最终优先级", 10.0),
        ("备注", 20.0),
    ];

    for (col, (name, width)) in headers.iter().enumerate() {
        write_cell_str(sheet, 0, col as u16, name, &header_fmt)?;
        sheet
            .set_column_width(col as u16, *width)
            .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    let row_count = mats.len();
    for (idx, m) in mats.iter().enumerate() {
        let row = (idx + 1) as u32;
        write_cell_str(sheet, row, 0, &m.coil_id, &data_fmt)?;
        write_cell_str(
            sheet,
            row,
            1,
            m.contract_no.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            2,
            m.customer_name.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            3,
            m.customer_code.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(sheet, row, 4, &m.steel_grade, &data_fmt)?;
        write_cell_num(sheet, row, 5, m.thickness, &data_fmt)?;
        write_cell_num(sheet, row, 6, m.width, &data_fmt)?;
        write_cell_num(sheet, row, 7, m.weight, &data_fmt)?;
        write_cell_str(
            sheet,
            row,
            8,
            m.hardness_level.as_deref().unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            9,
            m.surface_level.as_deref().unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            10,
            m.roughness_req.as_deref().unwrap_or(""),
            &center_fmt,
        )?;
        if let Some(v) = m.elongation_req {
            write_cell_num(sheet, row, 11, v, &data_fmt)?;
        }
        write_cell_str(
            sheet,
            row,
            12,
            m.product_type.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            13,
            m.contract_attr.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            14,
            m.contract_nature.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            15,
            if m.export_flag.unwrap_or(false) {
                "是"
            } else {
                "否"
            },
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            16,
            m.batch_code.as_deref().unwrap_or(""),
            &data_fmt,
        )?;

        let ct = m.coiling_time.format("%Y-%m-%d %H:%M:%S").to_string();
        write_cell_str(sheet, row, 17, &ct, &data_fmt)?;
        write_cell_str(
            sheet,
            row,
            18,
            m.temp_status.as_deref().unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            19,
            m.temp_wait_days.unwrap_or(0) as f64,
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            20,
            if m.is_tempered.unwrap_or(false) {
                "是"
            } else {
                "否"
            },
            &center_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            21,
            m.storage_days.unwrap_or(0) as f64,
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            22,
            m.storage_loc.as_deref().unwrap_or(""),
            &data_fmt,
        )?;

        let due_str = m
            .due_date
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();
        write_cell_str(sheet, row, 23, &due_str, &center_fmt)?;
        write_cell_str(
            sheet,
            row,
            24,
            m.status.as_deref().unwrap_or(""),
            &center_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            25,
            m.priority_auto.unwrap_or(0) as f64,
            &center_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            26,
            m.priority_manual_adjust.unwrap_or(0) as f64,
            &center_fmt,
        )?;
        write_cell_num(
            sheet,
            row,
            27,
            m.priority_final.unwrap_or(0) as f64,
            &center_fmt,
        )?;
        write_cell_str(
            sheet,
            row,
            28,
            m.remarks.as_deref().unwrap_or(""),
            &data_fmt,
        )?;
    }

    workbook
        .save(file_path)
        .map_err(|e| AppError::FileError(format!("保存Excel失败: {}", e)))?;

    Ok(row_count)
}

/// 导出排程方案到 CSV
pub async fn export_plan_to_csv(
    plan_id: i32,
    file_path: &str,
    template_id: Option<i32>,
) -> Result<usize, AppError> {
    if let Some(template_id) = template_id {
        return export_plan_to_csv_with_template(plan_id, file_path, template_id).await;
    }

    let db = get_db();

    let _plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    let items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let mat_ids: Vec<i32> = items.iter().map(|i| i.material_id).collect();
    let mats = if mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(mat_ids))
            .all(db)
            .await?
    };
    let mat_map: HashMap<i32, &material::Model> = mats.iter().map(|m| (m.id, m)).collect();

    let mut wtr = csv::Writer::from_path(file_path)
        .map_err(|e| AppError::FileError(format!("创建CSV文件失败: {}", e)))?;

    wtr.write_record([
        "序号",
        "钢卷号",
        "钢种",
        "厚度",
        "宽度",
        "重量",
        "班次日期",
        "班次",
        "班型",
        "计划开始",
        "计划结束",
        "累计重量",
        "换辊",
        "锁定",
        "风险标记",
        "合同号",
        "客户",
        "交期",
        "适温状态",
        "备注",
    ])
    .map_err(|e| AppError::FileError(e.to_string()))?;

    let row_count = items.len();
    for item in &items {
        let mat = mat_map.get(&item.material_id);
        let due_str = mat
            .and_then(|m| m.due_date)
            .map(|d| d.format("%Y-%m-%d").to_string())
            .unwrap_or_default();

        let roll_change = if item.is_roll_change.unwrap_or(false) {
            "是".to_string()
        } else {
            String::new()
        };
        let locked = if item.is_locked.unwrap_or(false) {
            "是".to_string()
        } else {
            String::new()
        };

        wtr.write_record([
            &item.sequence.to_string(),
            mat.map(|m| m.coil_id.as_str()).unwrap_or(""),
            mat.map(|m| m.steel_grade.as_str()).unwrap_or(""),
            &mat.map(|m| m.thickness.to_string()).unwrap_or_default(),
            &mat.map(|m| m.width.to_string()).unwrap_or_default(),
            &mat.map(|m| m.weight.to_string()).unwrap_or_default(),
            &item.shift_date,
            &item.shift_no.to_string(),
            &item.shift_type,
            item.planned_start.as_deref().unwrap_or(""),
            item.planned_end.as_deref().unwrap_or(""),
            &item.cumulative_weight.unwrap_or(0.0).to_string(),
            &roll_change,
            &locked,
            item.risk_flags.as_deref().unwrap_or(""),
            mat.and_then(|m| m.contract_no.as_deref()).unwrap_or(""),
            mat.and_then(|m| m.customer_name.as_deref()).unwrap_or(""),
            &due_str,
            mat.and_then(|m| m.temp_status.as_deref()).unwrap_or(""),
            mat.and_then(|m| m.remarks.as_deref()).unwrap_or(""),
        ])
        .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    wtr.flush()
        .map_err(|e| AppError::FileError(e.to_string()))?;
    Ok(row_count)
}

async fn export_plan_to_excel_with_template(
    plan_id: i32,
    file_path: &str,
    template_id: i32,
) -> Result<usize, AppError> {
    let (plan, rows) = load_plan_export_data(plan_id).await?;
    let template = resolve_template_spec(template_id, &DEFAULT_EXCEL_COLUMN_KEYS).await?;

    let mut workbook = Workbook::new();
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

    let sheet = workbook.add_worksheet();
    sheet
        .set_name(format!("排程明细-{}", plan.plan_no))
        .map_err(|e| AppError::FileError(e.to_string()))?;

    for (col, item) in template.columns.iter().enumerate() {
        write_cell_str(sheet, 0, col as u16, &item.title, &header_fmt)?;
        sheet
            .set_column_width(col as u16, item.width)
            .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    for (idx, row_data) in rows.iter().enumerate() {
        let row = (idx + 1) as u32;
        for (col, item) in template.columns.iter().enumerate() {
            let fmt = if item.center { &center_fmt } else { &data_fmt };
            let value = render_cell_value(row_data, &item.key, template.rules.get(&item.key));
            write_cell_str(sheet, row, col as u16, &value, fmt)?;
        }
    }

    write_plan_summary_sheet(&mut workbook, &plan)?;

    workbook
        .save(file_path)
        .map_err(|e| AppError::FileError(format!("保存Excel失败: {}", e)))?;

    Ok(rows.len())
}

async fn export_plan_to_csv_with_template(
    plan_id: i32,
    file_path: &str,
    template_id: i32,
) -> Result<usize, AppError> {
    let (_plan, rows) = load_plan_export_data(plan_id).await?;
    let template = resolve_template_spec(template_id, &DEFAULT_CSV_COLUMN_KEYS).await?;

    let mut wtr = csv::Writer::from_path(file_path)
        .map_err(|e| AppError::FileError(format!("创建CSV文件失败: {}", e)))?;

    let header: Vec<String> = template
        .columns
        .iter()
        .map(|item| item.title.clone())
        .collect();
    wtr.write_record(header)
        .map_err(|e| AppError::FileError(e.to_string()))?;

    for row_data in &rows {
        let record: Vec<String> = template
            .columns
            .iter()
            .map(|item| render_cell_value(row_data, &item.key, template.rules.get(&item.key)))
            .collect();
        wtr.write_record(record)
            .map_err(|e| AppError::FileError(e.to_string()))?;
    }

    wtr.flush()
        .map_err(|e| AppError::FileError(e.to_string()))?;
    Ok(rows.len())
}

async fn load_plan_export_data(
    plan_id: i32,
) -> Result<(schedule_plan::Model, Vec<PlanExportRow>), AppError> {
    let db = get_db();

    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or(AppError::PlanNotFound(plan_id))?;

    let items = schedule_item::Entity::find()
        .filter(schedule_item::Column::PlanId.eq(plan_id))
        .order_by_asc(schedule_item::Column::Sequence)
        .all(db)
        .await?;

    let mat_ids: Vec<i32> = items.iter().map(|item| item.material_id).collect();
    let mats = if mat_ids.is_empty() {
        vec![]
    } else {
        material::Entity::find()
            .filter(material::Column::Id.is_in(mat_ids))
            .all(db)
            .await?
    };
    let mat_map: HashMap<i32, material::Model> = mats.into_iter().map(|m| (m.id, m)).collect();

    let rows = items
        .into_iter()
        .map(|item| {
            let mat = mat_map.get(&item.material_id);
            let due_date = mat
                .and_then(|m| m.due_date)
                .map(|d| d.format("%Y-%m-%d").to_string())
                .unwrap_or_default();

            PlanExportRow {
                sequence: item.sequence,
                coil_id: mat
                    .map(|m| m.coil_id.clone())
                    .unwrap_or_else(|| "-".to_string()),
                steel_grade: mat
                    .map(|m| m.steel_grade.clone())
                    .unwrap_or_else(|| "-".to_string()),
                thickness: mat.map(|m| m.thickness).unwrap_or(0.0),
                width: mat.map(|m| m.width).unwrap_or(0.0),
                weight: mat.map(|m| m.weight).unwrap_or(0.0),
                shift_date: item.shift_date,
                shift_no: item.shift_no,
                shift_type: item.shift_type,
                planned_start: item.planned_start.unwrap_or_default(),
                planned_end: item.planned_end.unwrap_or_default(),
                cumulative_weight: item.cumulative_weight.unwrap_or(0.0),
                is_roll_change: item.is_roll_change.unwrap_or(false),
                is_locked: item.is_locked.unwrap_or(false),
                risk_flags: item.risk_flags.unwrap_or_default(),
                contract_no: mat.and_then(|m| m.contract_no.clone()).unwrap_or_default(),
                customer_name: mat
                    .and_then(|m| m.customer_name.clone())
                    .unwrap_or_default(),
                hardness_level: mat
                    .and_then(|m| m.hardness_level.clone())
                    .unwrap_or_default(),
                surface_level: mat
                    .and_then(|m| m.surface_level.clone())
                    .unwrap_or_default(),
                product_type: mat.and_then(|m| m.product_type.clone()).unwrap_or_default(),
                due_date,
                temp_status: mat.and_then(|m| m.temp_status.clone()).unwrap_or_default(),
                remarks: mat.and_then(|m| m.remarks.clone()).unwrap_or_default(),
            }
        })
        .collect();

    Ok((plan, rows))
}

async fn resolve_template_spec(
    template_id: i32,
    default_keys: &[&str],
) -> Result<TemplateExportSpec, AppError> {
    let db = get_db();
    let template = export_template::Entity::find_by_id(template_id)
        .one(db)
        .await?
        .ok_or(AppError::Internal("导出模板不存在".to_string()))?;

    let pairs = parse_template_column_pairs(&template.columns)?;
    let columns = build_columns_from_pairs(pairs, default_keys);
    let rules = parse_template_format_rules(template.format_rules.as_deref())?;
    Ok(TemplateExportSpec { columns, rules })
}

fn parse_template_column_pairs(raw: &str) -> Result<Vec<(String, Option<String>)>, AppError> {
    let value: Value = serde_json::from_str(raw)
        .map_err(|e| AppError::DataConversionError(format!("导出模板列配置JSON格式错误: {}", e)))?;
    let array = value.as_array().ok_or(AppError::DataConversionError(
        "导出模板列配置必须是JSON数组".to_string(),
    ))?;

    let mut pairs = Vec::new();
    for item in array {
        match item {
            Value::String(key) => {
                pairs.push((key.clone(), None));
            }
            Value::Object(map) => {
                let key = map
                    .get("key")
                    .or_else(|| map.get("field"))
                    .or_else(|| map.get("name"))
                    .and_then(|v| v.as_str())
                    .map(|v| v.trim().to_string());
                if let Some(key) = key {
                    if key.is_empty() {
                        continue;
                    }
                    let title = map
                        .get("title")
                        .or_else(|| map.get("label"))
                        .and_then(|v| v.as_str())
                        .map(|v| v.to_string());
                    pairs.push((key, title));
                }
            }
            _ => {}
        }
    }

    Ok(pairs)
}

fn parse_template_format_rules(
    raw: Option<&str>,
) -> Result<HashMap<String, ColumnFormatRule>, AppError> {
    let Some(raw) = raw else {
        return Ok(HashMap::new());
    };
    if raw.trim().is_empty() {
        return Ok(HashMap::new());
    }

    let value: Value = serde_json::from_str(raw).map_err(|e| {
        AppError::DataConversionError(format!("导出模板格式规则JSON格式错误: {}", e))
    })?;
    let obj = value.as_object().ok_or(AppError::DataConversionError(
        "导出模板格式规则必须是JSON对象".to_string(),
    ))?;

    let mut rules = HashMap::new();
    for (key, value) in obj {
        let Some((canonical_key, _, _, _)) = resolve_column_meta(key) else {
            continue;
        };
        if let Some(rule) = parse_single_format_rule(value)? {
            rules.insert(canonical_key.to_string(), rule);
        }
    }

    Ok(rules)
}

fn parse_single_format_rule(value: &Value) -> Result<Option<ColumnFormatRule>, AppError> {
    if value.is_null() {
        return Ok(None);
    }

    let obj = value.as_object().ok_or(AppError::DataConversionError(
        "格式规则项必须是JSON对象".to_string(),
    ))?;

    let digits = obj
        .get("digits")
        .or_else(|| obj.get("precision"))
        .and_then(|v| v.as_u64())
        .map(|v| v as usize);
    let prefix = obj
        .get("prefix")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let suffix = obj
        .get("suffix")
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let true_text = obj
        .get("true")
        .or_else(|| obj.get("true_text"))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let false_text = obj
        .get("false")
        .or_else(|| obj.get("false_text"))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let empty_text = obj
        .get("empty")
        .or_else(|| obj.get("empty_text"))
        .or_else(|| obj.get("null_text"))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let date_format = obj
        .get("date_format")
        .or_else(|| obj.get("format"))
        .and_then(|v| v.as_str())
        .map(|v| v.to_string());
    let uppercase = obj
        .get("uppercase")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let lowercase = obj
        .get("lowercase")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    let rule = ColumnFormatRule {
        digits,
        prefix,
        suffix,
        true_text,
        false_text,
        empty_text,
        date_format,
        uppercase,
        lowercase,
    };

    if rule.is_empty() {
        Ok(None)
    } else {
        Ok(Some(rule))
    }
}

fn build_columns_from_pairs(
    pairs: Vec<(String, Option<String>)>,
    default_keys: &[&str],
) -> Vec<ExportColumn> {
    let mut columns = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    for (raw_key, custom_title) in pairs {
        let Some((key, default_title, width, center)) = resolve_column_meta(&raw_key) else {
            continue;
        };
        if !seen.insert(key.to_string()) {
            continue;
        }

        let title = custom_title
            .as_deref()
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .unwrap_or(default_title)
            .to_string();

        columns.push(ExportColumn {
            key: key.to_string(),
            title,
            width,
            center,
        });
    }

    if columns.is_empty() {
        build_default_columns(default_keys)
    } else {
        columns
    }
}

fn build_default_columns(default_keys: &[&str]) -> Vec<ExportColumn> {
    default_keys
        .iter()
        .filter_map(|key| {
            resolve_column_meta(key).map(|(canonical, title, width, center)| ExportColumn {
                key: canonical.to_string(),
                title: title.to_string(),
                width,
                center,
            })
        })
        .collect()
}

fn normalize_column_key(input: &str) -> String {
    input
        .trim()
        .to_lowercase()
        .replace('-', "_")
        .replace(' ', "")
}

fn resolve_column_meta(input: &str) -> Option<(&'static str, &'static str, f64, bool)> {
    let key = normalize_column_key(input);
    match key.as_str() {
        "sequence" | "seq" | "序号" => Some(("sequence", "序号", 8.0, true)),
        "coil_id" | "coilid" | "钢卷号" => Some(("coil_id", "钢卷号", 16.0, false)),
        "steel_grade" | "steelgrade" | "钢种" => Some(("steel_grade", "钢种", 14.0, false)),
        "thickness" | "厚度" | "厚度(mm)" => Some(("thickness", "厚度(mm)", 10.0, false)),
        "width" | "宽度" | "宽度(mm)" => Some(("width", "宽度(mm)", 10.0, false)),
        "weight" | "重量" | "重量(t)" => Some(("weight", "重量(t)", 10.0, false)),
        "shift_date" | "shiftdate" | "班次日期" => Some(("shift_date", "班次日期", 14.0, true)),
        "shift_no" | "shiftno" | "班次" => Some(("shift_no", "班次", 8.0, true)),
        "shift_type" | "shifttype" | "班型" => Some(("shift_type", "班型", 8.0, true)),
        "planned_start" | "plannedstart" | "计划开始" => {
            Some(("planned_start", "计划开始", 18.0, false))
        }
        "planned_end" | "plannedend" | "计划结束" => {
            Some(("planned_end", "计划结束", 18.0, false))
        }
        "cumulative_weight" | "cumulativeweight" | "累计重量" | "累计重量(t)" => {
            Some(("cumulative_weight", "累计重量(t)", 12.0, false))
        }
        "is_roll_change" | "roll_change" | "isrollchange" | "换辊" => {
            Some(("is_roll_change", "换辊", 8.0, true))
        }
        "is_locked" | "locked" | "islocked" | "锁定" => Some(("is_locked", "锁定", 8.0, true)),
        "risk_flags" | "riskflags" | "风险标记" => {
            Some(("risk_flags", "风险标记", 16.0, false))
        }
        "contract_no" | "contractno" | "合同号" => Some(("contract_no", "合同号", 14.0, false)),
        "customer_name" | "customername" | "客户" | "客户名称" => {
            Some(("customer_name", "客户", 14.0, false))
        }
        "hardness_level" | "hardnesslevel" | "硬度等级" => {
            Some(("hardness_level", "硬度等级", 10.0, true))
        }
        "surface_level" | "surfacelevel" | "表面等级" => {
            Some(("surface_level", "表面等级", 10.0, true))
        }
        "product_type" | "producttype" | "产品大类" => {
            Some(("product_type", "产品大类", 12.0, false))
        }
        "due_date" | "duedate" | "交期" => Some(("due_date", "交期", 14.0, true)),
        "temp_status" | "tempstatus" | "适温状态" => {
            Some(("temp_status", "适温状态", 10.0, true))
        }
        "remarks" | "备注" => Some(("remarks", "备注", 20.0, false)),
        _ => None,
    }
}

fn raw_cell_value(row_data: &PlanExportRow, key: &str) -> Option<RawCellValue> {
    match key {
        "sequence" => Some(RawCellValue::Int(row_data.sequence as i64)),
        "coil_id" => Some(RawCellValue::Text(row_data.coil_id.clone())),
        "steel_grade" => Some(RawCellValue::Text(row_data.steel_grade.clone())),
        "thickness" => Some(RawCellValue::Number(row_data.thickness)),
        "width" => Some(RawCellValue::Number(row_data.width)),
        "weight" => Some(RawCellValue::Number(row_data.weight)),
        "shift_date" => Some(RawCellValue::Text(row_data.shift_date.clone())),
        "shift_no" => Some(RawCellValue::Int(row_data.shift_no as i64)),
        "shift_type" => Some(RawCellValue::Text(row_data.shift_type.clone())),
        "planned_start" => Some(RawCellValue::Text(row_data.planned_start.clone())),
        "planned_end" => Some(RawCellValue::Text(row_data.planned_end.clone())),
        "cumulative_weight" => Some(RawCellValue::Number(row_data.cumulative_weight)),
        "is_roll_change" => Some(RawCellValue::Bool(row_data.is_roll_change)),
        "is_locked" => Some(RawCellValue::Bool(row_data.is_locked)),
        "risk_flags" => Some(RawCellValue::Text(row_data.risk_flags.clone())),
        "contract_no" => Some(RawCellValue::Text(row_data.contract_no.clone())),
        "customer_name" => Some(RawCellValue::Text(row_data.customer_name.clone())),
        "hardness_level" => Some(RawCellValue::Text(row_data.hardness_level.clone())),
        "surface_level" => Some(RawCellValue::Text(row_data.surface_level.clone())),
        "product_type" => Some(RawCellValue::Text(row_data.product_type.clone())),
        "due_date" => Some(RawCellValue::Text(row_data.due_date.clone())),
        "temp_status" => Some(RawCellValue::Text(row_data.temp_status.clone())),
        "remarks" => Some(RawCellValue::Text(row_data.remarks.clone())),
        _ => None,
    }
}

fn render_cell_value(
    row_data: &PlanExportRow,
    key: &str,
    rule: Option<&ColumnFormatRule>,
) -> String {
    let Some(raw) = raw_cell_value(row_data, key) else {
        return String::new();
    };

    let mut value = match raw {
        RawCellValue::Int(v) => {
            if let Some(digits) = rule.and_then(|r| r.digits) {
                format!("{:.*}", digits, v as f64)
            } else {
                v.to_string()
            }
        }
        RawCellValue::Number(v) => {
            if let Some(digits) = rule.and_then(|r| r.digits) {
                format!("{:.*}", digits, v)
            } else {
                v.to_string()
            }
        }
        RawCellValue::Bool(v) => {
            if v {
                rule.and_then(|r| r.true_text.as_deref())
                    .unwrap_or("是")
                    .to_string()
            } else {
                rule.and_then(|r| r.false_text.as_deref())
                    .unwrap_or("")
                    .to_string()
            }
        }
        RawCellValue::Text(mut v) => {
            if key == "due_date" {
                if let Some(date_format) = rule.and_then(|r| r.date_format.as_deref()) {
                    if let Ok(date) = chrono::NaiveDate::parse_from_str(&v, "%Y-%m-%d") {
                        v = date.format(date_format).to_string();
                    }
                }
            }
            v
        }
    };

    if value.is_empty() {
        if let Some(empty_text) = rule.and_then(|r| r.empty_text.as_deref()) {
            value = empty_text.to_string();
        }
    }

    if let Some(rule) = rule {
        if rule.lowercase {
            value = value.to_lowercase();
        } else if rule.uppercase {
            value = value.to_uppercase();
        }
        if let Some(prefix) = rule.prefix.as_deref() {
            value = format!("{}{}", prefix, value);
        }
        if let Some(suffix) = rule.suffix.as_deref() {
            value = format!("{}{}", value, suffix);
        }
    }

    value
}

fn write_plan_summary_sheet(
    workbook: &mut Workbook,
    plan: &schedule_plan::Model,
) -> Result<(), AppError> {
    let summary = workbook.add_worksheet();
    summary
        .set_name("方案摘要")
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let label_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Right)
        .set_font_size(11.0);
    let value_fmt = Format::new().set_font_size(11.0);

    summary
        .set_column_width(0, 14.0)
        .map_err(|e| AppError::FileError(e.to_string()))?;
    summary
        .set_column_width(1, 30.0)
        .map_err(|e| AppError::FileError(e.to_string()))?;

    let info: Vec<(&str, String)> = vec![
        ("方案编号:", plan.plan_no.clone()),
        ("方案名称:", plan.name.clone()),
        ("周期类型:", plan.period_type.clone()),
        ("开始日期:", plan.start_date.clone()),
        ("结束日期:", plan.end_date.clone()),
        ("状态:", plan.status.clone().unwrap_or_default()),
        ("版本:", format!("v{}", plan.version.unwrap_or(1))),
        ("排程数:", format!("{}", plan.total_count.unwrap_or(0))),
        (
            "总重量:",
            format!("{:.1}t", plan.total_weight.unwrap_or(0.0)),
        ),
        (
            "换辊次数:",
            format!("{}", plan.roll_change_count.unwrap_or(0)),
        ),
        ("综合评分:", format!("{}", plan.score_overall.unwrap_or(0))),
        ("序列评分:", format!("{}", plan.score_sequence.unwrap_or(0))),
        ("交期评分:", format!("{}", plan.score_delivery.unwrap_or(0))),
        (
            "效率评分:",
            format!("{}", plan.score_efficiency.unwrap_or(0)),
        ),
        ("高风险:", format!("{}", plan.risk_count_high.unwrap_or(0))),
        (
            "中风险:",
            format!("{}", plan.risk_count_medium.unwrap_or(0)),
        ),
        ("低风险:", format!("{}", plan.risk_count_low.unwrap_or(0))),
    ];

    for (idx, (label, value)) in info.iter().enumerate() {
        write_cell_str(summary, idx as u32, 0, label, &label_fmt)?;
        write_cell_str(summary, idx as u32, 1, value, &value_fmt)?;
    }

    Ok(())
}

/// 获取材料统计
pub async fn get_material_stats() -> Result<MaterialStats, AppError> {
    let db = get_db();
    let total = material::Entity::find().count(db).await?;
    let pending = material::Entity::find()
        .filter(material::Column::Status.eq("pending"))
        .count(db)
        .await?;
    let frozen = material::Entity::find()
        .filter(material::Column::Status.eq("frozen"))
        .count(db)
        .await?;
    let completed = material::Entity::find()
        .filter(material::Column::Status.eq("completed"))
        .count(db)
        .await?;
    let tempered = material::Entity::find()
        .filter(material::Column::TempStatus.eq("ready"))
        .count(db)
        .await?;
    let waiting = material::Entity::find()
        .filter(material::Column::TempStatus.eq("waiting"))
        .count(db)
        .await?;

    Ok(MaterialStats {
        total,
        pending,
        frozen: frozen,
        completed,
        tempered,
        waiting,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MaterialStats {
    pub total: u64,
    pub pending: u64,
    pub frozen: u64,
    pub completed: u64,
    pub tempered: u64,
    pub waiting: u64,
}

// ─── 辅助函数 ───

fn write_cell_str(
    sheet: &mut rust_xlsxwriter::Worksheet,
    row: u32,
    col: u16,
    value: &str,
    fmt: &Format,
) -> Result<(), AppError> {
    sheet
        .write_string_with_format(row, col, value, fmt)
        .map(|_| ())
        .map_err(|e| AppError::FileError(e.to_string()))
}

fn write_cell_num(
    sheet: &mut rust_xlsxwriter::Worksheet,
    row: u32,
    col: u16,
    value: f64,
    fmt: &Format,
) -> Result<(), AppError> {
    sheet
        .write_number_with_format(row, col, value, fmt)
        .map(|_| ())
        .map_err(|e| AppError::FileError(e.to_string()))
}

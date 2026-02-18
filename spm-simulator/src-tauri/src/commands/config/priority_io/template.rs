use super::super::types::write_operation_log;
use crate::AppError;
use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};

#[tauri::command]
pub async fn export_priority_config_template_csv(file_path: String) -> Result<usize, AppError> {
    let mut writer = csv::Writer::from_path(&file_path)
        .map_err(|e| AppError::FileError(format!("创建CSV失败: {}", e)))?;
    writer
        .write_record([
            "config_type",
            "id",
            "dimension_type",
            "dimension_code",
            "dimension_name",
            "score",
            "weight",
            "enabled",
            "sort_order",
            "description",
            "customer_code",
            "customer_name",
            "priority_level",
            "priority_type",
            "priority_score",
            "batch_code",
            "batch_name",
            "product_type",
            "product_name",
            "remarks",
            "rule_config",
        ])
        .map_err(|e| AppError::FileError(format!("写CSV表头失败: {}", e)))?;

    let sample_rows: Vec<[String; 21]> = vec![
        [
            "weight".to_string(),
            String::new(),
            "delivery".to_string(),
            String::new(),
            "交期属性".to_string(),
            String::new(),
            "0.9".to_string(),
            "true".to_string(),
            "2".to_string(),
            "D+0/D+7/前欠等".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
        ],
        [
            "dimension".to_string(),
            String::new(),
            "delivery".to_string(),
            "D_PLUS_0".to_string(),
            "D+0".to_string(),
            "1000".to_string(),
            String::new(),
            "true".to_string(),
            "1".to_string(),
            "当天必交".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "{\"rule\":\"due_today\"}".to_string(),
        ],
        [
            "customer".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "true".to_string(),
            String::new(),
            String::new(),
            "C001".to_string(),
            "重点客户A".to_string(),
            "key".to_string(),
            String::new(),
            "80".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "示例客户".to_string(),
            String::new(),
        ],
        [
            "batch".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "true".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "urgent".to_string(),
            "100".to_string(),
            "B001".to_string(),
            "紧急集批".to_string(),
            String::new(),
            String::new(),
            "示例集批".to_string(),
            String::new(),
        ],
        [
            "product_type".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "true".to_string(),
            String::new(),
            String::new(),
            String::new(),
            String::new(),
            "priority".to_string(),
            String::new(),
            "100".to_string(),
            String::new(),
            String::new(),
            "冷轧基料".to_string(),
            "优先产品".to_string(),
            "示例产品".to_string(),
            String::new(),
        ],
    ];

    for row in &sample_rows {
        writer
            .write_record(row)
            .map_err(|e| AppError::FileError(format!("写CSV模板失败: {}", e)))?;
    }
    writer
        .flush()
        .map_err(|e| AppError::FileError(format!("写入CSV模板失败: {}", e)))?;

    write_operation_log(
        "export_priority_config_template_csv",
        Some("priority_config"),
        None,
        Some(format!(
            "导出优先级配置CSV模板: rows={}, file={}",
            sample_rows.len(),
            file_path
        )),
    )
    .await;

    Ok(sample_rows.len())
}

#[tauri::command]
pub async fn export_priority_config_template_excel(file_path: String) -> Result<usize, AppError> {
    let header_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_background_color(Color::RGB(0x1677FF))
        .set_font_color(Color::White)
        .set_font_size(10.0);
    let data_fmt = Format::new().set_font_size(10.0);

    let mut workbook = Workbook::new();
    let mut total_rows = 0usize;

    let write_sheet = |workbook: &mut Workbook,
                       sheet_name: &str,
                       headers: &[&str],
                       sample: &[&str],
                       header_fmt: &Format,
                       data_fmt: &Format|
     -> Result<(), AppError> {
        let sheet = workbook.add_worksheet();
        sheet
            .set_name(sheet_name)
            .map_err(|e| AppError::FileError(format!("创建工作表失败: {}", e)))?;
        for (col, title) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *title, header_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel模板失败: {}", e)))?;
        }
        for (col, value) in sample.iter().enumerate() {
            sheet
                .write_string_with_format(1, col as u16, *value, data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel模板失败: {}", e)))?;
        }
        sheet.autofit();
        Ok(())
    };

    write_sheet(
        &mut workbook,
        "weight_config",
        &[
            "dimension_type",
            "dimension_name",
            "weight",
            "enabled",
            "sort_order",
            "description",
        ],
        &["delivery", "交期属性", "0.9", "true", "2", "D+0/D+7/前欠等"],
        &header_fmt,
        &data_fmt,
    )?;
    total_rows += 1;

    write_sheet(
        &mut workbook,
        "dimension_config",
        &[
            "id",
            "dimension_type",
            "dimension_code",
            "dimension_name",
            "score",
            "enabled",
            "sort_order",
            "rule_config",
            "description",
        ],
        &[
            "",
            "delivery",
            "D_PLUS_0",
            "D+0",
            "1000",
            "true",
            "1",
            "{\"rule\":\"due_today\"}",
            "当天必交",
        ],
        &header_fmt,
        &data_fmt,
    )?;
    total_rows += 1;

    write_sheet(
        &mut workbook,
        "customer_config",
        &[
            "id",
            "customer_code",
            "customer_name",
            "priority_level",
            "priority_score",
            "enabled",
            "remarks",
        ],
        &["", "C001", "重点客户A", "key", "80", "true", "示例客户"],
        &header_fmt,
        &data_fmt,
    )?;
    total_rows += 1;

    write_sheet(
        &mut workbook,
        "batch_config",
        &[
            "id",
            "batch_code",
            "batch_name",
            "priority_type",
            "priority_score",
            "enabled",
            "remarks",
        ],
        &["", "B001", "紧急集批", "urgent", "100", "true", "示例集批"],
        &header_fmt,
        &data_fmt,
    )?;
    total_rows += 1;

    write_sheet(
        &mut workbook,
        "product_type_config",
        &[
            "id",
            "product_type",
            "product_name",
            "priority_level",
            "priority_score",
            "enabled",
            "remarks",
        ],
        &[
            "",
            "冷轧基料",
            "优先产品",
            "priority",
            "100",
            "true",
            "示例产品",
        ],
        &header_fmt,
        &data_fmt,
    )?;
    total_rows += 1;

    workbook
        .save(&file_path)
        .map_err(|e| AppError::FileError(format!("导出Excel模板失败: {}", e)))?;

    write_operation_log(
        "export_priority_config_template_excel",
        Some("priority_config"),
        None,
        Some(format!(
            "导出优先级配置Excel模板: sheets={}, file={}",
            total_rows, file_path
        )),
    )
    .await;

    Ok(total_rows)
}

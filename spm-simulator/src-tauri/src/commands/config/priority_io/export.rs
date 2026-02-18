use super::super::priority_batch::get_batch_priority_configs;
use super::super::priority_customer::get_customer_priority_configs;
use super::super::priority_dimension::get_priority_dimension_configs;
use super::super::priority_product::get_product_type_priority_configs;
use super::super::priority_weight::get_priority_weight_configs;
use super::super::types::write_operation_log;
use crate::AppError;

#[tauri::command]
pub async fn export_priority_configs_csv(file_path: String) -> Result<usize, AppError> {
    let weights = get_priority_weight_configs().await?;
    let dimensions = get_priority_dimension_configs(None).await?;
    let customers = get_customer_priority_configs().await?;
    let batches = get_batch_priority_configs().await?;
    let products = get_product_type_priority_configs().await?;

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

    let mut total_rows: usize = 0;

    for row in &weights {
        writer
            .write_record([
                "weight".to_string(),
                row.id.to_string(),
                row.dimension_type.clone(),
                String::new(),
                row.dimension_name.clone(),
                String::new(),
                row.weight.to_string(),
                row.enabled.to_string(),
                row.sort_order.unwrap_or(0).to_string(),
                row.description.clone().unwrap_or_default(),
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
            ])
            .map_err(|e| AppError::FileError(format!("写CSV数据失败: {}", e)))?;
        total_rows += 1;
    }

    for row in &dimensions {
        writer
            .write_record([
                "dimension".to_string(),
                row.id.to_string(),
                row.dimension_type.clone(),
                row.dimension_code.clone(),
                row.dimension_name.clone(),
                row.score.to_string(),
                String::new(),
                row.enabled.to_string(),
                row.sort_order.unwrap_or(0).to_string(),
                row.description.clone().unwrap_or_default(),
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
                row.rule_config.clone().unwrap_or_default(),
            ])
            .map_err(|e| AppError::FileError(format!("写CSV数据失败: {}", e)))?;
        total_rows += 1;
    }

    for row in &customers {
        writer
            .write_record([
                "customer".to_string(),
                row.id.to_string(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                row.enabled.to_string(),
                String::new(),
                String::new(),
                row.customer_code.clone(),
                row.customer_name.clone(),
                row.priority_level.clone(),
                String::new(),
                row.priority_score.to_string(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                row.remarks.clone().unwrap_or_default(),
                String::new(),
            ])
            .map_err(|e| AppError::FileError(format!("写CSV数据失败: {}", e)))?;
        total_rows += 1;
    }

    for row in &batches {
        writer
            .write_record([
                "batch".to_string(),
                row.id.to_string(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                row.enabled.to_string(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                row.priority_type.clone(),
                row.priority_score.to_string(),
                row.batch_code.clone(),
                row.batch_name.clone(),
                String::new(),
                String::new(),
                row.remarks.clone().unwrap_or_default(),
                String::new(),
            ])
            .map_err(|e| AppError::FileError(format!("写CSV数据失败: {}", e)))?;
        total_rows += 1;
    }

    for row in &products {
        writer
            .write_record([
                "product_type".to_string(),
                row.id.to_string(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                row.enabled.to_string(),
                String::new(),
                String::new(),
                String::new(),
                String::new(),
                row.priority_level.clone(),
                String::new(),
                row.priority_score.to_string(),
                String::new(),
                String::new(),
                row.product_type.clone(),
                row.product_name.clone(),
                row.remarks.clone().unwrap_or_default(),
                String::new(),
            ])
            .map_err(|e| AppError::FileError(format!("写CSV数据失败: {}", e)))?;
        total_rows += 1;
    }

    writer
        .flush()
        .map_err(|e| AppError::FileError(format!("写入CSV失败: {}", e)))?;

    write_operation_log(
        "export_priority_configs_csv",
        Some("priority_config"),
        None,
        Some(format!(
            "导出优先级配置CSV: rows={}, file={}",
            total_rows, file_path
        )),
    )
    .await;

    Ok(total_rows)
}

#[tauri::command]
pub async fn export_priority_configs_excel(file_path: String) -> Result<usize, AppError> {
    use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};

    let weights = get_priority_weight_configs().await?;
    let dimensions = get_priority_dimension_configs(None).await?;
    let customers = get_customer_priority_configs().await?;
    let batches = get_batch_priority_configs().await?;
    let products = get_product_type_priority_configs().await?;

    let header_fmt = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_background_color(Color::RGB(0x1677FF))
        .set_font_color(Color::White)
        .set_font_size(10.0);
    let data_fmt = Format::new().set_font_size(10.0);

    let mut workbook = Workbook::new();

    {
        let sheet = workbook.add_worksheet();
        sheet
            .set_name("weight_config")
            .map_err(|e| AppError::FileError(format!("创建工作表失败: {}", e)))?;
        let headers = [
            "dimension_type",
            "dimension_name",
            "weight",
            "enabled",
            "sort_order",
            "description",
        ];
        for (col, title) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *title, &header_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        for (idx, row) in weights.iter().enumerate() {
            let r = idx as u32 + 1;
            sheet
                .write_string_with_format(r, 0, &row.dimension_type, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 1, &row.dimension_name, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 2, row.weight.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 3, row.enabled.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 4, row.sort_order.unwrap_or(0).to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(
                    r,
                    5,
                    row.description.clone().unwrap_or_default(),
                    &data_fmt,
                )
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        sheet.autofit();
    }

    {
        let sheet = workbook.add_worksheet();
        sheet
            .set_name("dimension_config")
            .map_err(|e| AppError::FileError(format!("创建工作表失败: {}", e)))?;
        let headers = [
            "id",
            "dimension_type",
            "dimension_code",
            "dimension_name",
            "score",
            "enabled",
            "sort_order",
            "rule_config",
            "description",
        ];
        for (col, title) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *title, &header_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        for (idx, row) in dimensions.iter().enumerate() {
            let r = idx as u32 + 1;
            sheet
                .write_string_with_format(r, 0, row.id.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 1, &row.dimension_type, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 2, &row.dimension_code, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 3, &row.dimension_name, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 4, row.score.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 5, row.enabled.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 6, row.sort_order.unwrap_or(0).to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(
                    r,
                    7,
                    row.rule_config.clone().unwrap_or_default(),
                    &data_fmt,
                )
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(
                    r,
                    8,
                    row.description.clone().unwrap_or_default(),
                    &data_fmt,
                )
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        sheet.autofit();
    }

    {
        let sheet = workbook.add_worksheet();
        sheet
            .set_name("customer_config")
            .map_err(|e| AppError::FileError(format!("创建工作表失败: {}", e)))?;
        let headers = [
            "id",
            "customer_code",
            "customer_name",
            "priority_level",
            "priority_score",
            "enabled",
            "remarks",
        ];
        for (col, title) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *title, &header_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        for (idx, row) in customers.iter().enumerate() {
            let r = idx as u32 + 1;
            sheet
                .write_string_with_format(r, 0, row.id.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 1, &row.customer_code, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 2, &row.customer_name, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 3, &row.priority_level, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 4, row.priority_score.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 5, row.enabled.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 6, row.remarks.clone().unwrap_or_default(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        sheet.autofit();
    }

    {
        let sheet = workbook.add_worksheet();
        sheet
            .set_name("batch_config")
            .map_err(|e| AppError::FileError(format!("创建工作表失败: {}", e)))?;
        let headers = [
            "id",
            "batch_code",
            "batch_name",
            "priority_type",
            "priority_score",
            "enabled",
            "remarks",
        ];
        for (col, title) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *title, &header_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        for (idx, row) in batches.iter().enumerate() {
            let r = idx as u32 + 1;
            sheet
                .write_string_with_format(r, 0, row.id.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 1, &row.batch_code, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 2, &row.batch_name, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 3, &row.priority_type, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 4, row.priority_score.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 5, row.enabled.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 6, row.remarks.clone().unwrap_or_default(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        sheet.autofit();
    }

    {
        let sheet = workbook.add_worksheet();
        sheet
            .set_name("product_type_config")
            .map_err(|e| AppError::FileError(format!("创建工作表失败: {}", e)))?;
        let headers = [
            "id",
            "product_type",
            "product_name",
            "priority_level",
            "priority_score",
            "enabled",
            "remarks",
        ];
        for (col, title) in headers.iter().enumerate() {
            sheet
                .write_string_with_format(0, col as u16, *title, &header_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        for (idx, row) in products.iter().enumerate() {
            let r = idx as u32 + 1;
            sheet
                .write_string_with_format(r, 0, row.id.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 1, &row.product_type, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 2, &row.product_name, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 3, &row.priority_level, &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 4, row.priority_score.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 5, row.enabled.to_string(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
            sheet
                .write_string_with_format(r, 6, row.remarks.clone().unwrap_or_default(), &data_fmt)
                .map_err(|e| AppError::FileError(format!("写Excel失败: {}", e)))?;
        }
        sheet.autofit();
    }

    workbook
        .save(&file_path)
        .map_err(|e| AppError::FileError(format!("导出Excel失败: {}", e)))?;

    let total_rows =
        weights.len() + dimensions.len() + customers.len() + batches.len() + products.len();
    write_operation_log(
        "export_priority_configs_excel",
        Some("priority_config"),
        None,
        Some(format!(
            "导出优先级配置Excel: rows={}, file={}",
            total_rows, file_path
        )),
    )
    .await;

    Ok(total_rows)
}

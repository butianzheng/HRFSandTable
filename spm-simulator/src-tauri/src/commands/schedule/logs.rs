use super::comparison::{build_constraint_risk_map, compare_plans, format_sequence_movement};
use super::history::get_plan_versions;
use super::risk::get_risk_analysis;
use crate::utils::log::write_operation_log;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationLogEntry {
    pub id: i32,
    pub log_type: String,
    pub action: String,
    pub target_type: String,
    pub target_id: i32,
    pub detail: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationLogFilter {
    pub target_type: Option<String>,
    pub target_id: Option<i32>,
    pub log_type: Option<String>,
    pub action: Option<String>,
    pub start_time: Option<String>,
    pub end_time: Option<String>,
    pub limit: Option<u64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OperationLogEstimate {
    pub count: u64,
    pub cap: u64,
    pub capped: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CleanupEstimate {
    pub older_than_days: i64,
    pub logs: u64,
    pub history_plans: u64,
    pub materials: u64,
}

fn parse_filter_time(
    value: &str,
    field_name: &str,
) -> Result<chrono::DateTime<chrono::Utc>, AppError> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|e| AppError::Internal(format!("{} 格式错误: {}", field_name, e)))
}

#[tauri::command]
pub async fn get_operation_logs(
    filter: Option<OperationLogFilter>,
) -> Result<Vec<OperationLogEntry>, AppError> {
    use crate::db::get_db;
    use crate::models::operation_log::{self, Entity as LogEntity};
    use sea_orm::*;

    let db = get_db();
    let mut query = LogEntity::find();

    if let Some(ref f) = filter {
        if let Some(ref tt) = f.target_type {
            query = query.filter(operation_log::Column::TargetType.eq(tt.clone()));
        }
        if let Some(tid) = f.target_id {
            query = query.filter(operation_log::Column::TargetId.eq(tid));
        }
        if let Some(ref lt) = f.log_type {
            query = query.filter(operation_log::Column::LogType.eq(lt.clone()));
        }
        if let Some(ref action) = f.action {
            query = query.filter(operation_log::Column::Action.eq(action.clone()));
        }
        let start_at = f
            .start_time
            .as_deref()
            .map(|v| parse_filter_time(v, "start_time"))
            .transpose()?;
        let end_at = f
            .end_time
            .as_deref()
            .map(|v| parse_filter_time(v, "end_time"))
            .transpose()?;
        if let (Some(start), Some(end)) = (start_at, end_at) {
            if start > end {
                return Err(AppError::Internal(
                    "start_time 不能晚于 end_time".to_string(),
                ));
            }
        }
        if let Some(start) = start_at {
            query = query.filter(operation_log::Column::CreatedAt.gte(start));
        }
        if let Some(end) = end_at {
            query = query.filter(operation_log::Column::CreatedAt.lte(end));
        }
    }

    let limit = filter.as_ref().and_then(|f| f.limit).unwrap_or(200);

    let logs = query
        .order_by_desc(operation_log::Column::CreatedAt)
        .limit(limit)
        .all(db)
        .await?;

    let result: Vec<OperationLogEntry> = logs
        .into_iter()
        .map(|l| OperationLogEntry {
            id: l.id,
            log_type: l.log_type,
            action: l.action,
            target_type: l.target_type.unwrap_or_default(),
            target_id: l.target_id.unwrap_or(0),
            detail: l.detail.unwrap_or_default(),
            created_at: l.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
        })
        .collect();

    Ok(result)
}

#[tauri::command]
pub async fn get_operation_log_estimate(
    filter: Option<OperationLogFilter>,
    cap: Option<u64>,
) -> Result<OperationLogEstimate, AppError> {
    use crate::db::get_db;
    use crate::models::operation_log::{self, Entity as LogEntity};
    use sea_orm::*;

    let db = get_db();
    let effective_cap = cap.unwrap_or(2000).clamp(1, 100000);
    let mut query = LogEntity::find();

    if let Some(ref f) = filter {
        if let Some(ref tt) = f.target_type {
            query = query.filter(operation_log::Column::TargetType.eq(tt.clone()));
        }
        if let Some(tid) = f.target_id {
            query = query.filter(operation_log::Column::TargetId.eq(tid));
        }
        if let Some(ref lt) = f.log_type {
            query = query.filter(operation_log::Column::LogType.eq(lt.clone()));
        }
        if let Some(ref action) = f.action {
            query = query.filter(operation_log::Column::Action.eq(action.clone()));
        }
        let start_at = f
            .start_time
            .as_deref()
            .map(|v| parse_filter_time(v, "start_time"))
            .transpose()?;
        let end_at = f
            .end_time
            .as_deref()
            .map(|v| parse_filter_time(v, "end_time"))
            .transpose()?;
        if let (Some(start), Some(end)) = (start_at, end_at) {
            if start > end {
                return Err(AppError::Internal(
                    "start_time 不能晚于 end_time".to_string(),
                ));
            }
        }
        if let Some(start) = start_at {
            query = query.filter(operation_log::Column::CreatedAt.gte(start));
        }
        if let Some(end) = end_at {
            query = query.filter(operation_log::Column::CreatedAt.lte(end));
        }
    }

    let rows: Vec<i32> = query
        .order_by_desc(operation_log::Column::CreatedAt)
        .limit(effective_cap + 1)
        .select_only()
        .column(operation_log::Column::Id)
        .into_tuple()
        .all(db)
        .await?;

    let capped = rows.len() as u64 > effective_cap;
    let count = if capped {
        effective_cap
    } else {
        rows.len() as u64
    };

    Ok(OperationLogEstimate {
        count,
        cap: effective_cap,
        capped,
    })
}

#[tauri::command]
pub async fn export_logs(
    filter: Option<OperationLogFilter>,
    file_path: String,
) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::operation_log::{self, Entity as LogEntity};
    use sea_orm::*;

    let db = get_db();
    let mut query = LogEntity::find();

    if let Some(ref f) = filter {
        if let Some(ref tt) = f.target_type {
            query = query.filter(operation_log::Column::TargetType.eq(tt.clone()));
        }
        if let Some(tid) = f.target_id {
            query = query.filter(operation_log::Column::TargetId.eq(tid));
        }
        if let Some(ref lt) = f.log_type {
            query = query.filter(operation_log::Column::LogType.eq(lt.clone()));
        }
        if let Some(ref action) = f.action {
            query = query.filter(operation_log::Column::Action.eq(action.clone()));
        }
        let start_at = f
            .start_time
            .as_deref()
            .map(|v| parse_filter_time(v, "start_time"))
            .transpose()?;
        let end_at = f
            .end_time
            .as_deref()
            .map(|v| parse_filter_time(v, "end_time"))
            .transpose()?;
        if let (Some(start), Some(end)) = (start_at, end_at) {
            if start > end {
                return Err(AppError::Internal(
                    "start_time 不能晚于 end_time".to_string(),
                ));
            }
        }
        if let Some(start) = start_at {
            query = query.filter(operation_log::Column::CreatedAt.gte(start));
        }
        if let Some(end) = end_at {
            query = query.filter(operation_log::Column::CreatedAt.lte(end));
        }
        if let Some(limit) = f.limit {
            query = query.limit(limit);
        }
    }

    let logs = query
        .order_by_desc(operation_log::Column::CreatedAt)
        .all(db)
        .await?;

    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let mut writer = csv::Writer::from_path(&file_path)
        .map_err(|e| AppError::FileError(format!("创建日志导出文件失败: {}", e)))?;

    writer
        .write_record([
            "time",
            "log_type",
            "action",
            "target_type",
            "target_id",
            "detail",
        ])
        .map_err(|e| AppError::FileError(format!("写入日志表头失败: {}", e)))?;

    for l in &logs {
        writer
            .write_record([
                l.created_at.map(|d| d.to_rfc3339()).unwrap_or_default(),
                l.log_type.clone(),
                l.action.clone(),
                l.target_type.clone().unwrap_or_default(),
                l.target_id.map(|v| v.to_string()).unwrap_or_default(),
                l.detail.clone().unwrap_or_default(),
            ])
            .map_err(|e| AppError::FileError(format!("写入日志记录失败: {}", e)))?;
    }

    writer
        .flush()
        .map_err(|e| AppError::FileError(format!("保存日志导出文件失败: {}", e)))?;

    write_operation_log(
        "system",
        "export_logs",
        Some("system"),
        None,
        Some(format!("导出日志 {} 条 -> {}", logs.len(), file_path)),
    )
    .await;

    Ok(logs.len() as u64)
}

#[tauri::command]
pub async fn export_logs_excel(
    filter: Option<OperationLogFilter>,
    file_path: String,
) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::operation_log::{self, Entity as LogEntity};
    use rust_xlsxwriter::{Color, Format, FormatAlign, Workbook};
    use sea_orm::*;

    let db = get_db();
    let mut query = LogEntity::find();

    if let Some(ref f) = filter {
        if let Some(ref tt) = f.target_type {
            query = query.filter(operation_log::Column::TargetType.eq(tt.clone()));
        }
        if let Some(tid) = f.target_id {
            query = query.filter(operation_log::Column::TargetId.eq(tid));
        }
        if let Some(ref lt) = f.log_type {
            query = query.filter(operation_log::Column::LogType.eq(lt.clone()));
        }
        if let Some(ref action) = f.action {
            query = query.filter(operation_log::Column::Action.eq(action.clone()));
        }
        let start_at = f
            .start_time
            .as_deref()
            .map(|v| parse_filter_time(v, "start_time"))
            .transpose()?;
        let end_at = f
            .end_time
            .as_deref()
            .map(|v| parse_filter_time(v, "end_time"))
            .transpose()?;
        if let (Some(start), Some(end)) = (start_at, end_at) {
            if start > end {
                return Err(AppError::Internal(
                    "start_time 不能晚于 end_time".to_string(),
                ));
            }
        }
        if let Some(start) = start_at {
            query = query.filter(operation_log::Column::CreatedAt.gte(start));
        }
        if let Some(end) = end_at {
            query = query.filter(operation_log::Column::CreatedAt.lte(end));
        }
        if let Some(limit) = f.limit {
            query = query.limit(limit);
        }
    }

    let logs = query
        .order_by_desc(operation_log::Column::CreatedAt)
        .all(db)
        .await?;

    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet
        .set_name("logs")
        .map_err(|e| AppError::FileError(format!("设置日志工作表名称失败: {}", e)))?;

    let header_format = Format::new()
        .set_bold()
        .set_font_color(Color::White)
        .set_background_color(Color::Blue)
        .set_align(FormatAlign::Center);
    let wrap_format = Format::new().set_text_wrap();

    let headers = [
        "time",
        "log_type",
        "action",
        "target_type",
        "target_id",
        "detail",
    ];
    for (col, header) in headers.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, *header, &header_format)
            .map_err(|e| AppError::FileError(format!("写入日志Excel表头失败: {}", e)))?;
    }

    for (idx, row) in logs.iter().enumerate() {
        let excel_row = (idx as u32) + 1;
        worksheet
            .write_string(
                excel_row,
                0,
                row.created_at
                    .map(|d| d.format("%Y-%m-%d %H:%M:%S").to_string())
                    .unwrap_or_default(),
            )
            .map_err(|e| AppError::FileError(format!("写入日志Excel时间失败: {}", e)))?;
        worksheet
            .write_string(excel_row, 1, row.log_type.as_str())
            .map_err(|e| AppError::FileError(format!("写入日志Excel类型失败: {}", e)))?;
        worksheet
            .write_string(excel_row, 2, row.action.as_str())
            .map_err(|e| AppError::FileError(format!("写入日志Excel操作失败: {}", e)))?;
        worksheet
            .write_string(
                excel_row,
                3,
                row.target_type.clone().unwrap_or_default().as_str(),
            )
            .map_err(|e| AppError::FileError(format!("写入日志Excel目标类型失败: {}", e)))?;
        worksheet
            .write_string(
                excel_row,
                4,
                row.target_id
                    .map(|v| v.to_string())
                    .unwrap_or_default()
                    .as_str(),
            )
            .map_err(|e| AppError::FileError(format!("写入日志Excel目标ID失败: {}", e)))?;
        worksheet
            .write_string_with_format(
                excel_row,
                5,
                row.detail.clone().unwrap_or_default().as_str(),
                &wrap_format,
            )
            .map_err(|e| AppError::FileError(format!("写入日志Excel详情失败: {}", e)))?;
    }

    worksheet.autofit();
    workbook
        .save(&file_path)
        .map_err(|e| AppError::FileError(format!("保存日志Excel失败: {}", e)))?;

    write_operation_log(
        "system",
        "export_logs_excel",
        Some("system"),
        None,
        Some(format!("导出日志Excel {} 条 -> {}", logs.len(), file_path)),
    )
    .await;

    Ok(logs.len() as u64)
}

#[tauri::command]
pub async fn export_plan_history_report(plan_id: i32, file_path: String) -> Result<u64, AppError> {
    let versions = get_plan_versions(plan_id).await?;
    let logs = get_operation_logs(Some(OperationLogFilter {
        target_type: Some("plan".to_string()),
        target_id: Some(plan_id),
        log_type: None,
        action: None,
        start_time: None,
        end_time: None,
        limit: Some(2000),
    }))
    .await?;

    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)?;
        }
    }

    let mut writer = csv::Writer::from_path(&file_path)
        .map_err(|e| AppError::FileError(format!("创建历史报告文件失败: {}", e)))?;

    writer
        .write_record([
            "section", "field1", "field2", "field3", "field4", "field5", "field6", "field7",
        ])
        .map_err(|e| AppError::FileError(format!("写入历史报告表头失败: {}", e)))?;

    writer
        .write_record(["meta", "plan_id", &plan_id.to_string(), "", "", "", "", ""])
        .map_err(|e| AppError::FileError(format!("写入报告元信息失败: {}", e)))?;

    writer
        .write_record([
            "versions",
            "plan_id",
            "version",
            "plan_no",
            "name",
            "status",
            "score_overall",
            "created_at",
        ])
        .map_err(|e| AppError::FileError(format!("写入版本表头失败: {}", e)))?;
    for row in &versions {
        writer
            .write_record([
                "versions",
                &row.plan_id.to_string(),
                &row.version.to_string(),
                &row.plan_no,
                &row.name,
                &row.status,
                &row.score_overall.to_string(),
                &row.created_at,
            ])
            .map_err(|e| AppError::FileError(format!("写入版本记录失败: {}", e)))?;
    }

    writer
        .write_record([
            "version_stats",
            "plan_id",
            "version",
            "total_count",
            "total_weight",
            "roll_change_count",
            "risk_high",
            "risk_medium/risk_low",
        ])
        .map_err(|e| AppError::FileError(format!("写入版本统计表头失败: {}", e)))?;
    for row in &versions {
        writer
            .write_record([
                "version_stats",
                &row.plan_id.to_string(),
                &row.version.to_string(),
                &row.total_count.to_string(),
                &row.total_weight.to_string(),
                &row.roll_change_count.to_string(),
                &row.risk_high.to_string(),
                &format!("{}/{}", row.risk_medium, row.risk_low),
            ])
            .map_err(|e| AppError::FileError(format!("写入版本统计记录失败: {}", e)))?;
    }

    writer
        .write_record([
            "version_delta",
            "from_plan_id",
            "to_plan_id",
            "score_overall_delta",
            "total_count_delta",
            "total_weight_delta",
            "roll_change_delta",
            "risk_h/m/l_delta",
        ])
        .map_err(|e| AppError::FileError(format!("写入版本差异表头失败: {}", e)))?;
    for pair in versions.windows(2) {
        let from = &pair[0];
        let to = &pair[1];
        writer
            .write_record([
                "version_delta",
                &from.plan_id.to_string(),
                &to.plan_id.to_string(),
                &(to.score_overall - from.score_overall).to_string(),
                &(to.total_count - from.total_count).to_string(),
                &(to.total_weight - from.total_weight).to_string(),
                &(to.roll_change_count - from.roll_change_count).to_string(),
                &format!(
                    "{}/{}/{}",
                    to.risk_high - from.risk_high,
                    to.risk_medium - from.risk_medium,
                    to.risk_low - from.risk_low
                ),
            ])
            .map_err(|e| AppError::FileError(format!("写入版本差异记录失败: {}", e)))?;
    }

    writer
        .write_record([
            "sequence_diff",
            "from_plan_id",
            "to_plan_id",
            "coil_id",
            "sequence_from",
            "sequence_to",
            "delta",
            "move",
        ])
        .map_err(|e| AppError::FileError(format!("写入顺序差异表头失败: {}", e)))?;
    let mut sequence_diff_count: usize = 0;
    for pair in versions.windows(2) {
        let from = &pair[0];
        let to = &pair[1];

        let sequence_compare = compare_plans(from.plan_id, to.plan_id).await?;
        for item in &sequence_compare.sequence_changes {
            writer
                .write_record([
                    "sequence_diff",
                    &from.plan_id.to_string(),
                    &to.plan_id.to_string(),
                    &item.coil_id,
                    &item.sequence_a.to_string(),
                    &item.sequence_b.to_string(),
                    &item.delta.to_string(),
                    &format_sequence_movement(item.delta),
                ])
                .map_err(|e| AppError::FileError(format!("写入顺序差异记录失败: {}", e)))?;
            sequence_diff_count += 1;
        }
    }

    writer
        .write_record([
            "risk_diff",
            "from_plan_id",
            "to_plan_id",
            "constraint_type",
            "from_h/m/l",
            "to_h/m/l",
            "delta_total",
            "delta_h/m/l",
        ])
        .map_err(|e| AppError::FileError(format!("写入风险差异表头失败: {}", e)))?;
    let mut risk_diff_count: usize = 0;
    for pair in versions.windows(2) {
        let from = &pair[0];
        let to = &pair[1];
        let from_risk = get_risk_analysis(from.plan_id).await?;
        let to_risk = get_risk_analysis(to.plan_id).await?;
        let from_map = build_constraint_risk_map(&from_risk.violations);
        let to_map = build_constraint_risk_map(&to_risk.violations);
        let mut keys: Vec<String> = from_map.keys().chain(to_map.keys()).cloned().collect();
        keys.sort();
        keys.dedup();
        for key in keys {
            let (from_h, from_m, from_l, from_total) =
                from_map.get(&key).cloned().unwrap_or((0, 0, 0, 0));
            let (to_h, to_m, to_l, to_total) = to_map.get(&key).cloned().unwrap_or((0, 0, 0, 0));
            writer
                .write_record([
                    "risk_diff",
                    &from.plan_id.to_string(),
                    &to.plan_id.to_string(),
                    &key,
                    &format!("{}/{}/{}", from_h, from_m, from_l),
                    &format!("{}/{}/{}", to_h, to_m, to_l),
                    &(to_total - from_total).to_string(),
                    &format!("{}/{}/{}", to_h - from_h, to_m - from_m, to_l - from_l),
                ])
                .map_err(|e| AppError::FileError(format!("写入风险差异记录失败: {}", e)))?;
            risk_diff_count += 1;
        }
    }

    writer
        .write_record([
            "logs",
            "id",
            "created_at",
            "log_type",
            "action",
            "target_id",
            "detail",
            "",
        ])
        .map_err(|e| AppError::FileError(format!("写入日志表头失败: {}", e)))?;
    for row in &logs {
        writer
            .write_record([
                "logs",
                &row.id.to_string(),
                &row.created_at,
                &row.log_type,
                &row.action,
                &row.target_id.to_string(),
                &row.detail,
                "",
            ])
            .map_err(|e| AppError::FileError(format!("写入日志记录失败: {}", e)))?;
    }

    writer
        .flush()
        .map_err(|e| AppError::FileError(format!("保存历史报告失败: {}", e)))?;

    write_operation_log(
        "plan",
        "export_history_report",
        Some("plan"),
        Some(plan_id),
        Some(format!(
            "导出历史追溯报告: versions={}, version_delta={}, sequence_diff={}, risk_diff={}, logs={} -> {}",
            versions.len(),
            versions.len().saturating_sub(1),
            sequence_diff_count,
            risk_diff_count,
            logs.len(),
            file_path
        )),
    )
    .await;

    Ok((versions.len() * 2
        + versions.len().saturating_sub(1)
        + sequence_diff_count
        + risk_diff_count
        + logs.len()) as u64)
}

#[tauri::command]
pub async fn get_cleanup_estimate(
    older_than_days: Option<i64>,
) -> Result<CleanupEstimate, AppError> {
    use crate::db::get_db;
    use crate::models::{material, operation_log, schedule_plan};
    use sea_orm::*;

    let db = get_db();
    let days = older_than_days.unwrap_or(30).max(0);
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);

    let logs = operation_log::Entity::find()
        .filter(operation_log::Column::CreatedAt.lt(cutoff))
        .count(db)
        .await?;

    let history_plans = schedule_plan::Entity::find()
        .filter(schedule_plan::Column::Status.eq("archived"))
        .filter(schedule_plan::Column::CreatedAt.lt(cutoff))
        .count(db)
        .await?;

    let materials = material::Entity::find()
        .filter(
            Condition::any()
                .add(material::Column::Status.eq("completed"))
                .add(material::Column::Status.eq("frozen")),
        )
        .filter(
            Condition::any()
                .add(material::Column::UpdatedAt.lt(cutoff))
                .add(material::Column::CreatedAt.lt(cutoff)),
        )
        .count(db)
        .await?;

    Ok(CleanupEstimate {
        older_than_days: days,
        logs,
        history_plans,
        materials,
    })
}

#[tauri::command]
pub async fn clear_logs(keep_days: Option<i64>) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::operation_log;
    use sea_orm::*;

    let db = get_db();
    let mut query = operation_log::Entity::delete_many();
    if let Some(days) = keep_days {
        let days = days.max(0);
        let cutoff = chrono::Utc::now() - chrono::Duration::days(days);
        query = query.filter(operation_log::Column::CreatedAt.lt(cutoff));
    }

    let result = query.exec(db).await?;
    write_operation_log(
        "system",
        "clear_logs",
        Some("system"),
        None,
        Some(format!(
            "清理日志 {} 条，keep_days={}",
            result.rows_affected,
            keep_days
                .map(|v| v.to_string())
                .unwrap_or_else(|| "all".to_string())
        )),
    )
    .await;

    Ok(result.rows_affected)
}

#[tauri::command]
pub async fn clean_history_plans(older_than_days: Option<i64>) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::schedule_plan;
    use sea_orm::*;

    let db = get_db();
    let days = older_than_days.unwrap_or(30).max(0);
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);

    let result = schedule_plan::Entity::delete_many()
        .filter(schedule_plan::Column::Status.eq("archived"))
        .filter(schedule_plan::Column::CreatedAt.lt(cutoff))
        .exec(db)
        .await?;

    write_operation_log(
        "system",
        "clean_history_plans",
        Some("system"),
        None,
        Some(format!(
            "清理历史方案 {} 条，older_than_days={}",
            result.rows_affected, days
        )),
    )
    .await;

    Ok(result.rows_affected)
}

#[tauri::command]
pub async fn clean_materials(older_than_days: Option<i64>) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::material;
    use sea_orm::*;

    let db = get_db();
    let days = older_than_days.unwrap_or(30).max(0);
    let cutoff = chrono::Utc::now() - chrono::Duration::days(days);

    let result = material::Entity::delete_many()
        .filter(
            Condition::any()
                .add(material::Column::Status.eq("completed"))
                .add(material::Column::Status.eq("frozen")),
        )
        .filter(
            Condition::any()
                .add(material::Column::UpdatedAt.lt(cutoff))
                .add(material::Column::CreatedAt.lt(cutoff)),
        )
        .exec(db)
        .await?;

    write_operation_log(
        "system",
        "clean_materials",
        Some("system"),
        None,
        Some(format!(
            "清理材料 {} 条，older_than_days={}",
            result.rows_affected, days
        )),
    )
    .await;

    Ok(result.rows_affected)
}

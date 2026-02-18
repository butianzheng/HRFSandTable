use crate::db::get_db;
use crate::models::operation_log;
use sea_orm::{ActiveModelTrait, Set};

pub async fn write_operation_log(
    log_type: &str,
    action: &str,
    target_type: Option<&str>,
    target_id: Option<i32>,
    detail: Option<String>,
) {
    let db = get_db();
    let entry = operation_log::ActiveModel {
        log_type: Set(log_type.to_string()),
        action: Set(action.to_string()),
        target_type: Set(target_type.map(|v| v.to_string())),
        target_id: Set(target_id),
        detail: Set(detail),
        ..Default::default()
    };

    if let Err(err) = entry.insert(db).await {
        log::warn!("写操作日志失败: {}", err);
    }
}

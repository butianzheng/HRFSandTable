use crate::models::error_log::{ErrorFilter, ErrorSeverity, ErrorStats, ErrorType};
use crate::services::error_tracking_service::ErrorTrackingService;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct LogErrorRequest {
    pub error_type: String,
    pub severity: String,
    pub message: String,
    pub stack_trace: Option<String>,
    pub context: Option<serde_json::Value>,
    pub user_agent: Option<String>,
    pub url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetErrorsRequest {
    pub filter: ErrorFilter,
    pub page: u64,
    pub page_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GetErrorsResponse {
    pub errors: Vec<crate::models::error_log::Model>,
    pub total: u64,
}

/// 记录错误
#[tauri::command]
pub async fn log_error(app: tauri::AppHandle, request: LogErrorRequest) -> Result<(), AppError> {
    let error_type = match request.error_type.as_str() {
        "frontend" => ErrorType::Frontend,
        "backend" => ErrorType::Backend,
        "panic" => ErrorType::Panic,
        _ => return Err(AppError::InvalidInput("Invalid error type".to_string())),
    };

    let severity = match request.severity.as_str() {
        "error" => ErrorSeverity::Error,
        "warning" => ErrorSeverity::Warning,
        "info" => ErrorSeverity::Info,
        _ => return Err(AppError::InvalidInput("Invalid severity".to_string())),
    };

    ErrorTrackingService::log_error(
        &app,
        error_type,
        severity,
        &request.message,
        request.stack_trace,
        request.context,
        request.user_agent,
        request.url,
    )
    .await
}

/// 获取错误列表
#[tauri::command]
pub async fn get_errors(
    app: tauri::AppHandle,
    request: GetErrorsRequest,
) -> Result<GetErrorsResponse, AppError> {
    let (errors, total) =
        ErrorTrackingService::get_errors(&app, request.filter, request.page, request.page_size)
            .await?;

    Ok(GetErrorsResponse { errors, total })
}

/// 获取错误统计
#[tauri::command]
pub async fn get_error_stats(app: tauri::AppHandle) -> Result<ErrorStats, AppError> {
    ErrorTrackingService::get_stats(&app).await
}

/// 标记错误为已解决
#[tauri::command]
pub async fn resolve_error(app: tauri::AppHandle, error_id: i32) -> Result<(), AppError> {
    ErrorTrackingService::resolve_error(&app, error_id).await
}

/// 删除错误
#[tauri::command]
pub async fn delete_error(app: tauri::AppHandle, error_id: i32) -> Result<(), AppError> {
    ErrorTrackingService::delete_error(&app, error_id).await
}

/// 清理旧错误
#[tauri::command]
pub async fn cleanup_old_errors(app: tauri::AppHandle, days: i64) -> Result<u64, AppError> {
    ErrorTrackingService::cleanup_old_errors(&app, days).await
}

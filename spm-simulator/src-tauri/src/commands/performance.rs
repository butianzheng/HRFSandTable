use crate::models::performance_metric::{
    MetricType, PerformanceAlert, PerformanceBaseline, PerformanceStats,
};
use crate::services::performance_service::PerformanceService;
use crate::AppError;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordMetricRequest {
    pub metric_type: String,
    pub metric_name: String,
    pub value: f64,
    pub unit: String,
    pub metadata: Option<serde_json::Value>,
}

/// 记录性能指标
#[tauri::command]
pub async fn record_performance_metric(
    app: tauri::AppHandle,
    request: RecordMetricRequest,
) -> Result<(), AppError> {
    let metric_type = match request.metric_type.as_str() {
        "app_startup" => MetricType::AppStartup,
        "page_render" => MetricType::PageRender,
        "api_call" => MetricType::ApiCall,
        "algorithm_execution" => MetricType::AlgorithmExecution,
        "memory_usage" => MetricType::MemoryUsage,
        "database_query" => MetricType::DatabaseQuery,
        _ => return Err(AppError::InvalidInput("Invalid metric type".to_string())),
    };

    PerformanceService::record_metric(
        &app,
        metric_type,
        &request.metric_name,
        request.value,
        &request.unit,
        request.metadata,
    )
    .await
}

/// 获取性能统计数据
#[tauri::command]
pub async fn get_performance_stats(
    app: tauri::AppHandle,
    metric_type: Option<String>,
    metric_name: Option<String>,
    hours: Option<i64>,
) -> Result<Vec<PerformanceStats>, AppError> {
    PerformanceService::get_stats(&app, metric_type, metric_name, hours).await
}

/// 获取性能基线
#[tauri::command]
pub async fn get_performance_baselines(
    app: tauri::AppHandle,
) -> Result<Vec<PerformanceBaseline>, AppError> {
    PerformanceService::get_baselines(&app).await
}

/// 检查性能告警
#[tauri::command]
pub async fn check_performance_alerts(
    app: tauri::AppHandle,
    hours: Option<i64>,
) -> Result<Vec<PerformanceAlert>, AppError> {
    PerformanceService::check_alerts(&app, hours).await
}

/// 清理旧的性能数据
#[tauri::command]
pub async fn cleanup_performance_metrics(
    app: tauri::AppHandle,
    days: i64,
) -> Result<u64, AppError> {
    PerformanceService::cleanup_old_metrics(&app, days).await
}

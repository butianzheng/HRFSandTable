use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "performance_metrics")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub metric_type: String, // 指标类型: app_startup, page_render, api_call, algorithm_execution, memory_usage
    pub metric_name: String, // 指标名称: 具体的操作名称
    pub value: f64,          // 指标值: 时间(ms)或内存(MB)
    pub unit: String,        // 单位: ms, MB, %
    pub metadata: Option<String>, // 额外元数据 (JSON)
    pub created_at: DateTime, // 记录时间
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// 性能指标类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MetricType {
    AppStartup,         // 应用启动
    PageRender,         // 页面渲染
    ApiCall,            // API 调用
    AlgorithmExecution, // 算法执行
    MemoryUsage,        // 内存使用
    DatabaseQuery,      // 数据库查询
}

impl MetricType {
    pub fn as_str(&self) -> &str {
        match self {
            MetricType::AppStartup => "app_startup",
            MetricType::PageRender => "page_render",
            MetricType::ApiCall => "api_call",
            MetricType::AlgorithmExecution => "algorithm_execution",
            MetricType::MemoryUsage => "memory_usage",
            MetricType::DatabaseQuery => "database_query",
        }
    }
}

// 性能统计数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceStats {
    pub metric_type: String,
    pub metric_name: String,
    pub count: i64,
    pub avg: f64,
    pub min: f64,
    pub max: f64,
    pub p50: f64,
    pub p95: f64,
    pub p99: f64,
}

// 性能基线配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceBaseline {
    pub metric_type: String,
    pub metric_name: String,
    pub baseline_avg: f64,
    pub baseline_p95: f64,
    pub warning_threshold: f64,  // 警告阈值 (倍数)
    pub critical_threshold: f64, // 严重阈值 (倍数)
}

// 性能告警
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAlert {
    pub metric_type: String,
    pub metric_name: String,
    pub current_value: f64,
    pub baseline_value: f64,
    pub threshold_exceeded: f64,
    pub severity: AlertSeverity,
    pub timestamp: DateTime,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Warning,
    Critical,
}

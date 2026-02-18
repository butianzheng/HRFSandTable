use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "error_logs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub error_type: String,            // 错误类型: frontend, backend, panic
    pub severity: String,              // 严重程度: error, warning, info
    pub message: String,               // 错误消息
    pub stack_trace: Option<String>,   // 堆栈跟踪
    pub context: Option<String>,       // 上下文信息 (JSON)
    pub user_agent: Option<String>,    // 用户代理
    pub url: Option<String>,           // 发生错误的 URL
    pub fingerprint: String,           // 错误指纹（用于去重）
    pub count: i32,                    // 重复次数
    pub first_seen: DateTime,          // 首次出现时间
    pub last_seen: DateTime,           // 最后出现时间
    pub resolved: bool,                // 是否已解决
    pub resolved_at: Option<DateTime>, // 解决时间
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

// 错误类型
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorType {
    Frontend, // 前端错误
    Backend,  // 后端错误
    Panic,    // Rust panic
}

impl ErrorType {
    pub fn as_str(&self) -> &str {
        match self {
            ErrorType::Frontend => "frontend",
            ErrorType::Backend => "backend",
            ErrorType::Panic => "panic",
        }
    }
}

// 错误严重程度
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Error,   // 错误
    Warning, // 警告
    Info,    // 信息
}

impl ErrorSeverity {
    pub fn as_str(&self) -> &str {
        match self {
            ErrorSeverity::Error => "error",
            ErrorSeverity::Warning => "warning",
            ErrorSeverity::Info => "info",
        }
    }
}

// 错误统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorStats {
    pub total_errors: i64,
    pub unresolved_errors: i64,
    pub error_by_type: Vec<ErrorTypeCount>,
    pub error_by_severity: Vec<ErrorSeverityCount>,
    pub recent_errors: Vec<Model>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorTypeCount {
    pub error_type: String,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorSeverityCount {
    pub severity: String,
    pub count: i64,
}

// 错误过滤器
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorFilter {
    pub error_type: Option<String>,
    pub severity: Option<String>,
    pub resolved: Option<bool>,
    pub search: Option<String>,
    pub start_date: Option<DateTime>,
    pub end_date: Option<DateTime>,
}

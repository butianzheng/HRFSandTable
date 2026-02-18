use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    // Import errors (E1xxx)
    #[error("E1001: 文件格式错误: {0}")]
    FileFormatError(String),
    #[error("E1002: 字段映射缺失: {0}")]
    FieldMappingMissing(String),
    #[error("E1003: 数据转换错误: {0}")]
    DataConversionError(String),

    // Schedule errors (E2xxx)
    #[error("E2001: 方案不存在: {0}")]
    PlanNotFound(i32),
    #[error("E2002: 材料未适温: {0}")]
    MaterialNotTempered(String),
    #[error("E2003: 排程约束违规: {0}")]
    ConstraintViolation(String),

    // Config errors (E3xxx)
    #[error("E3001: 模板名称重复: {0}")]
    TemplateDuplicate(String),
    #[error("E3002: 系统模板不可删除")]
    SystemTemplateProtected,

    // System errors (E4xxx)
    #[error("E4001: 数据库错误: {0}")]
    DatabaseError(String),
    #[error("E4002: 文件操作错误: {0}")]
    FileError(String),

    // Undo errors (E5xxx)
    #[error("E5001: 无可撤销操作")]
    NothingToUndo,
    #[error("E5002: 无可重做操作")]
    NothingToRedo,

    // Performance errors (E6xxx)
    #[error("E6001: 无效的输入参数: {0}")]
    InvalidInput(String),

    // Generic
    #[error("{0}")]
    Internal(String),
}

impl From<sea_orm::DbErr> for AppError {
    fn from(err: sea_orm::DbErr) -> Self {
        AppError::DatabaseError(err.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::FileError(err.to_string())
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

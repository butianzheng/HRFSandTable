use crate::db::get_db_from_app;
use crate::models::error_log::{
    self, ErrorFilter, ErrorSeverity, ErrorSeverityCount, ErrorStats, ErrorType, ErrorTypeCount,
};
use crate::AppError;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, Order, PaginatorTrait, QueryFilter, QueryOrder,
    QuerySelect, Set,
};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use tauri::AppHandle;

/// 错误追踪服务
pub struct ErrorTrackingService;

impl ErrorTrackingService {
    /// 记录错误
    pub async fn log_error(
        app: &AppHandle,
        error_type: ErrorType,
        severity: ErrorSeverity,
        message: &str,
        stack_trace: Option<String>,
        context: Option<serde_json::Value>,
        user_agent: Option<String>,
        url: Option<String>,
    ) -> Result<(), AppError> {
        let db = get_db_from_app(app)?;

        // 生成错误指纹（用于去重）
        let fingerprint = Self::generate_fingerprint(error_type.as_str(), message, &stack_trace);

        // 检查是否已存在相同错误
        let existing = error_log::Entity::find()
            .filter(error_log::Column::Fingerprint.eq(&fingerprint))
            .one(db)
            .await?;

        let now = chrono::Utc::now().naive_utc();

        if let Some(existing_error) = existing {
            // 更新现有错误的计数和最后出现时间
            let mut active: error_log::ActiveModel = existing_error.into();
            active.count = Set(active.count.unwrap() + 1);
            active.last_seen = Set(now);
            active.update(db).await?;
        } else {
            // 创建新错误记录
            let error = error_log::ActiveModel {
                error_type: Set(error_type.as_str().to_string()),
                severity: Set(severity.as_str().to_string()),
                message: Set(message.to_string()),
                stack_trace: Set(stack_trace),
                context: Set(context.map(|c| c.to_string())),
                user_agent: Set(user_agent),
                url: Set(url),
                fingerprint: Set(fingerprint),
                count: Set(1),
                first_seen: Set(now),
                last_seen: Set(now),
                resolved: Set(false),
                resolved_at: Set(None),
                ..Default::default()
            };

            error.insert(db).await?;
        }

        Ok(())
    }

    /// 获取错误列表
    pub async fn get_errors(
        app: &AppHandle,
        filter: ErrorFilter,
        page: u64,
        page_size: u64,
    ) -> Result<(Vec<error_log::Model>, u64), AppError> {
        let db = get_db_from_app(app)?;

        let mut query = error_log::Entity::find();

        // 应用过滤条件
        if let Some(error_type) = filter.error_type {
            query = query.filter(error_log::Column::ErrorType.eq(error_type));
        }

        if let Some(severity) = filter.severity {
            query = query.filter(error_log::Column::Severity.eq(severity));
        }

        if let Some(resolved) = filter.resolved {
            query = query.filter(error_log::Column::Resolved.eq(resolved));
        }

        if let Some(search) = filter.search {
            query = query.filter(error_log::Column::Message.contains(&search));
        }

        if let Some(start_date) = filter.start_date {
            query = query.filter(error_log::Column::FirstSeen.gte(start_date));
        }

        if let Some(end_date) = filter.end_date {
            query = query.filter(error_log::Column::LastSeen.lte(end_date));
        }

        // 按最后出现时间倒序排列
        query = query.order_by(error_log::Column::LastSeen, Order::Desc);

        // 分页
        let paginator = query.paginate(db, page_size);
        let total = paginator.num_items().await?;
        let errors = paginator.fetch_page(page - 1).await?;

        Ok((errors, total))
    }

    /// 获取错误统计
    pub async fn get_stats(app: &AppHandle) -> Result<ErrorStats, AppError> {
        let db = get_db_from_app(app)?;

        // 总错误数
        let total_errors = error_log::Entity::find().count(db).await?;

        // 未解决错误数
        let unresolved_errors = error_log::Entity::find()
            .filter(error_log::Column::Resolved.eq(false))
            .count(db)
            .await?;

        // 按类型统计
        let all_errors = error_log::Entity::find().all(db).await?;

        let mut type_counts: HashMap<String, i64> = HashMap::new();
        let mut severity_counts: HashMap<String, i64> = HashMap::new();

        for error in &all_errors {
            *type_counts.entry(error.error_type.clone()).or_insert(0) += error.count as i64;
            *severity_counts.entry(error.severity.clone()).or_insert(0) += error.count as i64;
        }

        let error_by_type = type_counts
            .into_iter()
            .map(|(error_type, count)| ErrorTypeCount { error_type, count })
            .collect();

        let error_by_severity = severity_counts
            .into_iter()
            .map(|(severity, count)| ErrorSeverityCount { severity, count })
            .collect();

        // 最近的错误
        let recent_errors = error_log::Entity::find()
            .order_by(error_log::Column::LastSeen, Order::Desc)
            .limit(10)
            .all(db)
            .await?;

        Ok(ErrorStats {
            total_errors: total_errors as i64,
            unresolved_errors: unresolved_errors as i64,
            error_by_type,
            error_by_severity,
            recent_errors,
        })
    }

    /// 标记错误为已解决
    pub async fn resolve_error(app: &AppHandle, error_id: i32) -> Result<(), AppError> {
        let db = get_db_from_app(app)?;

        let error = error_log::Entity::find_by_id(error_id)
            .one(db)
            .await?
            .ok_or_else(|| AppError::Internal("Error not found".to_string()))?;

        let mut active: error_log::ActiveModel = error.into();
        active.resolved = Set(true);
        active.resolved_at = Set(Some(chrono::Utc::now().naive_utc()));
        active.update(db).await?;

        Ok(())
    }

    /// 删除错误
    pub async fn delete_error(app: &AppHandle, error_id: i32) -> Result<(), AppError> {
        let db = get_db_from_app(app)?;

        error_log::Entity::delete_by_id(error_id).exec(db).await?;

        Ok(())
    }

    /// 清理旧错误
    pub async fn cleanup_old_errors(app: &AppHandle, days: i64) -> Result<u64, AppError> {
        let db = get_db_from_app(app)?;
        let cutoff_time = chrono::Utc::now().naive_utc() - chrono::Duration::days(days);

        let result = error_log::Entity::delete_many()
            .filter(error_log::Column::Resolved.eq(true))
            .filter(error_log::Column::ResolvedAt.lt(cutoff_time))
            .exec(db)
            .await?;

        Ok(result.rows_affected)
    }

    /// 生成错误指纹
    fn generate_fingerprint(
        error_type: &str,
        message: &str,
        stack_trace: &Option<String>,
    ) -> String {
        let mut hasher = Sha256::new();
        hasher.update(error_type.as_bytes());
        hasher.update(message.as_bytes());

        if let Some(stack) = stack_trace {
            // 只使用堆栈的前几行来生成指纹，避免行号变化导致指纹不同
            let lines: Vec<&str> = stack.lines().take(3).collect();
            hasher.update(lines.join("\n").as_bytes());
        }

        format!("{:x}", hasher.finalize())
    }
}

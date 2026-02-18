use crate::db::get_db_from_app;
use crate::models::performance_metric::{
    self, AlertSeverity, MetricType, PerformanceAlert, PerformanceBaseline, PerformanceStats,
};
use crate::AppError;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use std::collections::HashMap;
use std::time::Instant;
use tauri::AppHandle;

/// 性能监控服务
pub struct PerformanceService;

impl PerformanceService {
    /// 记录性能指标
    pub async fn record_metric(
        app: &AppHandle,
        metric_type: MetricType,
        metric_name: &str,
        value: f64,
        unit: &str,
        metadata: Option<serde_json::Value>,
    ) -> Result<(), AppError> {
        let db = get_db_from_app(app)?;

        let metric = performance_metric::ActiveModel {
            metric_type: Set(metric_type.as_str().to_string()),
            metric_name: Set(metric_name.to_string()),
            value: Set(value),
            unit: Set(unit.to_string()),
            metadata: Set(metadata.map(|m| m.to_string())),
            created_at: Set(chrono::Utc::now().naive_utc()),
            ..Default::default()
        };

        metric.insert(db).await?;
        Ok(())
    }

    /// 获取性能统计数据
    pub async fn get_stats(
        app: &AppHandle,
        metric_type: Option<String>,
        metric_name: Option<String>,
        hours: Option<i64>,
    ) -> Result<Vec<PerformanceStats>, AppError> {
        let db = get_db_from_app(app)?;
        let hours = hours.unwrap_or(24);

        let cutoff_time = chrono::Utc::now().naive_utc() - chrono::Duration::hours(hours);

        let mut query = performance_metric::Entity::find()
            .filter(performance_metric::Column::CreatedAt.gte(cutoff_time));

        if let Some(mt) = metric_type {
            query = query.filter(performance_metric::Column::MetricType.eq(mt));
        }

        if let Some(mn) = metric_name {
            query = query.filter(performance_metric::Column::MetricName.eq(mn));
        }

        let metrics = query.all(db).await?;

        // 按 metric_type 和 metric_name 分组统计
        let mut groups: HashMap<(String, String), Vec<f64>> = HashMap::new();

        for metric in metrics {
            let key = (metric.metric_type.clone(), metric.metric_name.clone());
            groups.entry(key).or_default().push(metric.value);
        }

        let mut stats = Vec::new();

        for ((mt, mn), mut values) in groups {
            if values.is_empty() {
                continue;
            }

            values.sort_by(|a, b| a.partial_cmp(b).unwrap());

            let count = values.len() as i64;
            let sum: f64 = values.iter().sum();
            let avg = sum / count as f64;
            let min = *values.first().unwrap();
            let max = *values.last().unwrap();

            let p50_idx = (count as f64 * 0.50) as usize;
            let p95_idx = (count as f64 * 0.95) as usize;
            let p99_idx = (count as f64 * 0.99) as usize;

            let p50 = values[p50_idx.min(values.len() - 1)];
            let p95 = values[p95_idx.min(values.len() - 1)];
            let p99 = values[p99_idx.min(values.len() - 1)];

            stats.push(PerformanceStats {
                metric_type: mt,
                metric_name: mn,
                count,
                avg,
                min,
                max,
                p50,
                p95,
                p99,
            });
        }

        Ok(stats)
    }

    /// 获取性能基线
    pub async fn get_baselines(_app: &AppHandle) -> Result<Vec<PerformanceBaseline>, AppError> {
        // 默认性能基线配置
        Ok(vec![
            PerformanceBaseline {
                metric_type: "app_startup".to_string(),
                metric_name: "total".to_string(),
                baseline_avg: 2000.0,
                baseline_p95: 3000.0,
                warning_threshold: 1.5,
                critical_threshold: 2.0,
            },
            PerformanceBaseline {
                metric_type: "page_render".to_string(),
                metric_name: "materials".to_string(),
                baseline_avg: 500.0,
                baseline_p95: 1000.0,
                warning_threshold: 2.0,
                critical_threshold: 3.0,
            },
            PerformanceBaseline {
                metric_type: "page_render".to_string(),
                metric_name: "schedule".to_string(),
                baseline_avg: 800.0,
                baseline_p95: 1500.0,
                warning_threshold: 2.0,
                critical_threshold: 3.0,
            },
            PerformanceBaseline {
                metric_type: "algorithm_execution".to_string(),
                metric_name: "auto_schedule".to_string(),
                baseline_avg: 5000.0,
                baseline_p95: 10000.0,
                warning_threshold: 1.5,
                critical_threshold: 2.0,
            },
            PerformanceBaseline {
                metric_type: "api_call".to_string(),
                metric_name: "get_materials".to_string(),
                baseline_avg: 200.0,
                baseline_p95: 500.0,
                warning_threshold: 2.0,
                critical_threshold: 3.0,
            },
        ])
    }

    /// 检查性能告警
    pub async fn check_alerts(
        app: &AppHandle,
        hours: Option<i64>,
    ) -> Result<Vec<PerformanceAlert>, AppError> {
        let stats = Self::get_stats(app, None, None, hours).await?;
        let baselines = Self::get_baselines(app).await?;

        let mut alerts = Vec::new();

        for stat in stats {
            if let Some(baseline) = baselines
                .iter()
                .find(|b| b.metric_type == stat.metric_type && b.metric_name == stat.metric_name)
            {
                let avg_ratio = stat.avg / baseline.baseline_avg;
                let p95_ratio = stat.p95 / baseline.baseline_p95;

                if avg_ratio >= baseline.critical_threshold
                    || p95_ratio >= baseline.critical_threshold
                {
                    alerts.push(PerformanceAlert {
                        metric_type: stat.metric_type.clone(),
                        metric_name: stat.metric_name.clone(),
                        current_value: stat.avg,
                        baseline_value: baseline.baseline_avg,
                        threshold_exceeded: avg_ratio,
                        severity: AlertSeverity::Critical,
                        timestamp: chrono::Utc::now().naive_utc(),
                    });
                } else if avg_ratio >= baseline.warning_threshold
                    || p95_ratio >= baseline.warning_threshold
                {
                    alerts.push(PerformanceAlert {
                        metric_type: stat.metric_type.clone(),
                        metric_name: stat.metric_name.clone(),
                        current_value: stat.avg,
                        baseline_value: baseline.baseline_avg,
                        threshold_exceeded: avg_ratio,
                        severity: AlertSeverity::Warning,
                        timestamp: chrono::Utc::now().naive_utc(),
                    });
                }
            }
        }

        Ok(alerts)
    }

    /// 清理旧的性能数据
    pub async fn cleanup_old_metrics(app: &AppHandle, days: i64) -> Result<u64, AppError> {
        let db = get_db_from_app(app)?;
        let cutoff_time = chrono::Utc::now().naive_utc() - chrono::Duration::days(days);

        let result = performance_metric::Entity::delete_many()
            .filter(performance_metric::Column::CreatedAt.lt(cutoff_time))
            .exec(db)
            .await?;

        Ok(result.rows_affected)
    }
}

/// 性能计时器
pub struct PerformanceTimer {
    start: Instant,
    metric_type: MetricType,
    metric_name: String,
    metadata: Option<serde_json::Value>,
}

impl PerformanceTimer {
    pub fn new(metric_type: MetricType, metric_name: impl Into<String>) -> Self {
        Self {
            start: Instant::now(),
            metric_type,
            metric_name: metric_name.into(),
            metadata: None,
        }
    }

    pub fn with_metadata(mut self, metadata: serde_json::Value) -> Self {
        self.metadata = Some(metadata);
        self
    }

    pub async fn finish(self, app: &AppHandle) -> Result<f64, AppError> {
        let elapsed = self.start.elapsed().as_millis() as f64;

        PerformanceService::record_metric(
            app,
            self.metric_type,
            &self.metric_name,
            elapsed,
            "ms",
            self.metadata,
        )
        .await?;

        Ok(elapsed)
    }

    pub fn elapsed_ms(&self) -> f64 {
        self.start.elapsed().as_millis() as f64
    }
}

// 宏：简化性能计时
#[macro_export]
macro_rules! perf_timer {
    ($metric_type:expr, $metric_name:expr) => {
        $crate::services::performance_service::PerformanceTimer::new($metric_type, $metric_name)
    };
    ($metric_type:expr, $metric_name:expr, $metadata:expr) => {
        $crate::services::performance_service::PerformanceTimer::new($metric_type, $metric_name)
            .with_metadata($metadata)
    };
}

use crate::models::system_config;
use crate::AppError;
use sea_orm::{ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, QueryFilter, Statement};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};
use tauri::AppHandle;
use tauri::Manager;

const DB_FILE_NAME: &str = "spm_simulator.db";

#[derive(Debug, Clone, Copy)]
enum BackupPeriod {
    Daily,
    Weekly,
}

impl BackupPeriod {
    fn from_str(value: &str) -> Self {
        match value.trim().to_lowercase().as_str() {
            "weekly" => BackupPeriod::Weekly,
            _ => BackupPeriod::Daily,
        }
    }

    fn interval_days(self) -> u64 {
        match self {
            BackupPeriod::Daily => 1,
            BackupPeriod::Weekly => 7,
        }
    }
}

#[derive(Debug, Clone)]
struct BackupConfig {
    enabled: bool,
    period: BackupPeriod,
    path: Option<PathBuf>,
    keep_days: Option<u64>,
}

impl Default for BackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            period: BackupPeriod::Daily,
            path: None,
            keep_days: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileInfo {
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub created_at: String,
}

fn app_data_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_data_dir()
        .map_err(|e| AppError::FileError(e.to_string()))
}

fn db_path(app: &AppHandle) -> Result<PathBuf, AppError> {
    Ok(app_data_dir(app)?.join(DB_FILE_NAME))
}

fn parse_bool(value: &str) -> bool {
    matches!(
        value.trim().to_lowercase().as_str(),
        "1" | "true" | "yes" | "on"
    )
}

async fn load_backup_config() -> Result<BackupConfig, AppError> {
    let db = crate::db::get_db();
    let rows = system_config::Entity::find()
        .filter(system_config::Column::ConfigGroup.eq("backup"))
        .all(db)
        .await?;

    let mut config = BackupConfig::default();
    for row in rows {
        match row.config_key.as_str() {
            "enabled" => {
                config.enabled = parse_bool(&row.config_value);
            }
            "period" => {
                config.period = BackupPeriod::from_str(&row.config_value);
            }
            "path" => {
                let raw = row.config_value.trim();
                if !raw.is_empty() {
                    config.path = Some(PathBuf::from(raw));
                }
            }
            "keep_days" => {
                config.keep_days = row
                    .config_value
                    .trim()
                    .parse::<u64>()
                    .ok()
                    .filter(|days| *days > 0);
            }
            _ => {}
        }
    }

    Ok(config)
}

async fn load_backup_config_or_default() -> BackupConfig {
    match load_backup_config().await {
        Ok(cfg) => cfg,
        Err(err) => {
            log::warn!("读取备份配置失败，使用默认路径: {}", err);
            BackupConfig::default()
        }
    }
}

fn resolve_backup_dir(app: &AppHandle, config: &BackupConfig) -> Result<PathBuf, AppError> {
    if let Some(path) = &config.path {
        if path.is_absolute() {
            return Ok(path.clone());
        }
        return Ok(app_data_dir(app)?.join(path));
    }
    Ok(app_data_dir(app)?.join("backups"))
}

fn list_backup_paths(dir: &Path) -> Result<Vec<PathBuf>, AppError> {
    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut paths = Vec::new();
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        if path.extension().and_then(|v| v.to_str()) != Some("db") {
            continue;
        }
        paths.push(path);
    }

    Ok(paths)
}

fn latest_backup_time(paths: &[PathBuf]) -> Option<SystemTime> {
    paths.iter().fold(None, |acc, path| {
        let modified = std::fs::metadata(path).ok()?.modified().ok()?;
        Some(match acc {
            Some(current) if current > modified => current,
            _ => modified,
        })
    })
}

fn should_auto_backup(latest: Option<SystemTime>, period: BackupPeriod) -> bool {
    let Some(latest_time) = latest else {
        return true;
    };

    let interval = Duration::from_secs(period.interval_days() * 24 * 60 * 60);
    match SystemTime::now().duration_since(latest_time) {
        Ok(delta) => delta >= interval,
        Err(_) => false,
    }
}

fn cleanup_expired_backups(dir: &Path, keep_days: Option<u64>) -> Result<u64, AppError> {
    let Some(days) = keep_days else {
        return Ok(0);
    };

    let ttl = Duration::from_secs(days * 24 * 60 * 60);
    let now = SystemTime::now();
    let mut removed = 0u64;

    for path in list_backup_paths(dir)? {
        let metadata = match std::fs::metadata(&path) {
            Ok(v) => v,
            Err(_) => continue,
        };
        let modified = match metadata.modified() {
            Ok(v) => v,
            Err(_) => continue,
        };
        let expired = match now.duration_since(modified) {
            Ok(delta) => delta > ttl,
            Err(_) => false,
        };
        if !expired {
            continue;
        }
        if std::fs::remove_file(&path).is_ok() {
            removed += 1;
        }
    }

    Ok(removed)
}

async fn create_backup_with_config(
    app: &AppHandle,
    config: &BackupConfig,
) -> Result<BackupFileInfo, AppError> {
    let source = db_path(app)?;
    if !source.exists() {
        return Err(AppError::FileError("数据库文件不存在".to_string()));
    }

    let dir = resolve_backup_dir(app, config)?;
    std::fs::create_dir_all(&dir)?;

    let file_name = format!(
        "spm_backup_{}.db",
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let target = dir.join(file_name);
    std::fs::copy(&source, &target)?;

    let _ = cleanup_expired_backups(&dir, config.keep_days);
    to_backup_info(&target)
}

async fn backup_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    let config = load_backup_config_or_default().await;
    resolve_backup_dir(app, &config)
}

fn to_backup_info(path: &Path) -> Result<BackupFileInfo, AppError> {
    let metadata = std::fs::metadata(path)?;
    let modified = metadata.modified().unwrap_or(std::time::SystemTime::now());
    let created_at = chrono::DateTime::<chrono::Utc>::from(modified).to_rfc3339();
    let file_name = path
        .file_name()
        .and_then(|v| v.to_str())
        .unwrap_or_default()
        .to_string();

    Ok(BackupFileInfo {
        file_name,
        file_path: path.to_string_lossy().to_string(),
        file_size: metadata.len(),
        created_at,
    })
}

pub async fn create_backup(app: &AppHandle) -> Result<BackupFileInfo, AppError> {
    let config = load_backup_config_or_default().await;
    create_backup_with_config(app, &config).await
}

pub async fn get_backups(app: &AppHandle) -> Result<Vec<BackupFileInfo>, AppError> {
    let dir = backup_dir(app).await?;
    let mut backups = Vec::new();
    for path in list_backup_paths(&dir)? {
        backups.push(to_backup_info(&path)?);
    }

    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

pub async fn delete_backup(app: &AppHandle, backup_file_path: &str) -> Result<(), AppError> {
    let base_dir = backup_dir(app).await?;
    std::fs::create_dir_all(&base_dir)?;
    let base_dir = std::fs::canonicalize(&base_dir)
        .map_err(|e| AppError::FileError(format!("备份目录不可用: {}", e)))?;

    let path = Path::new(backup_file_path);
    if !path.exists() {
        return Err(AppError::FileError(format!(
            "备份文件不存在: {}",
            backup_file_path
        )));
    }

    let file_path = std::fs::canonicalize(path)
        .map_err(|e| AppError::FileError(format!("备份文件路径无效: {}", e)))?;
    if !file_path.starts_with(&base_dir) {
        return Err(AppError::FileError("仅允许删除备份目录下文件".to_string()));
    }
    if file_path.extension().and_then(|v| v.to_str()) != Some("db") {
        return Err(AppError::FileError("仅支持删除 .db 备份文件".to_string()));
    }

    std::fs::remove_file(file_path)?;
    Ok(())
}

pub async fn run_startup_auto_backup(app: &AppHandle) -> Result<(), AppError> {
    let config = load_backup_config().await?;
    if !config.enabled {
        return Ok(());
    }

    let dir = resolve_backup_dir(app, &config)?;
    std::fs::create_dir_all(&dir)?;
    let paths = list_backup_paths(&dir)?;

    if should_auto_backup(latest_backup_time(&paths), config.period) {
        let backup = create_backup_with_config(app, &config).await?;
        log::info!("自动备份成功: {}", backup.file_name);
    }

    let removed = cleanup_expired_backups(&dir, config.keep_days)?;
    if removed > 0 {
        log::info!("已清理过期备份: {} 个", removed);
    }

    Ok(())
}

pub async fn restore_backup(_app: &AppHandle, backup_file_path: &str) -> Result<(), AppError> {
    let backup_path = Path::new(backup_file_path);
    if !backup_path.exists() {
        return Err(AppError::FileError(format!(
            "备份文件不存在: {}",
            backup_file_path
        )));
    }

    let db = crate::db::get_db();
    let escaped = backup_file_path.replace('\'', "''");
    let attach_sql = format!("ATTACH DATABASE '{}' AS backup_db", escaped);

    db.execute(Statement::from_string(DatabaseBackend::Sqlite, attach_sql))
        .await?;

    let res = async {
        db.execute(Statement::from_string(
            DatabaseBackend::Sqlite,
            "PRAGMA foreign_keys=OFF".to_string(),
        ))
        .await?;
        db.execute(Statement::from_string(
            DatabaseBackend::Sqlite,
            "BEGIN IMMEDIATE".to_string(),
        ))
        .await?;

        let tables = [
            "material",
            "schedule_plan",
            "schedule_item",
            "strategy_template",
            "field_mapping",
            "export_template",
            "system_config",
            "maintenance_plan",
            "operation_log",
            "undo_stack",
            "priority_dimension_config",
            "customer_priority_config",
            "batch_priority_config",
            "product_type_priority_config",
            "priority_weight_config",
        ];

        for table in tables {
            let exists_sql = format!(
                "SELECT 1 FROM backup_db.sqlite_master WHERE type='table' AND name='{}' LIMIT 1",
                table
            );
            let exists = db
                .query_one(Statement::from_string(
                    DatabaseBackend::Sqlite,
                    exists_sql,
                ))
                .await?
                .is_some();
            if !exists {
                continue;
            }

            db.execute(Statement::from_string(
                DatabaseBackend::Sqlite,
                format!("DELETE FROM \"{}\"", table),
            ))
            .await?;
            db.execute(Statement::from_string(
                DatabaseBackend::Sqlite,
                format!(
                    "INSERT INTO \"{}\" SELECT * FROM backup_db.\"{}\"",
                    table, table
                ),
            ))
            .await?;
        }

        let seq_exists = db
            .query_one(Statement::from_string(
                DatabaseBackend::Sqlite,
                "SELECT 1 FROM backup_db.sqlite_master WHERE type='table' AND name='sqlite_sequence' LIMIT 1"
                    .to_string(),
            ))
            .await?
            .is_some();
        if seq_exists {
            db.execute(Statement::from_string(
                DatabaseBackend::Sqlite,
                "DELETE FROM sqlite_sequence".to_string(),
            ))
            .await?;
            db.execute(Statement::from_string(
                DatabaseBackend::Sqlite,
                "INSERT INTO sqlite_sequence SELECT * FROM backup_db.sqlite_sequence".to_string(),
            ))
            .await?;
        }

        db.execute(Statement::from_string(
            DatabaseBackend::Sqlite,
            "COMMIT".to_string(),
        ))
        .await?;

        Ok::<(), AppError>(())
    }
    .await;

    if res.is_err() {
        let _ = db
            .execute(Statement::from_string(
                DatabaseBackend::Sqlite,
                "ROLLBACK".to_string(),
            ))
            .await;
    }

    let _ = db
        .execute(Statement::from_string(
            DatabaseBackend::Sqlite,
            "DETACH DATABASE backup_db".to_string(),
        ))
        .await;
    let _ = db
        .execute(Statement::from_string(
            DatabaseBackend::Sqlite,
            "PRAGMA foreign_keys=ON".to_string(),
        ))
        .await;

    res
}

#[cfg(test)]
mod tests {
    use super::{should_auto_backup, BackupPeriod};
    use std::time::{Duration, SystemTime};

    #[test]
    fn should_auto_backup_when_no_previous_backup() {
        assert!(should_auto_backup(None, BackupPeriod::Daily));
        assert!(should_auto_backup(None, BackupPeriod::Weekly));
    }

    #[test]
    fn should_auto_backup_respects_daily_period() {
        let now = SystemTime::now();
        let within_one_day = now - Duration::from_secs(23 * 60 * 60);
        let over_one_day = now - Duration::from_secs(25 * 60 * 60);

        assert!(!should_auto_backup(
            Some(within_one_day),
            BackupPeriod::Daily
        ));
        assert!(should_auto_backup(Some(over_one_day), BackupPeriod::Daily));
    }

    #[test]
    fn should_auto_backup_respects_weekly_period() {
        let now = SystemTime::now();
        let within_one_week = now - Duration::from_secs(6 * 24 * 60 * 60);
        let over_one_week = now - Duration::from_secs(8 * 24 * 60 * 60);

        assert!(!should_auto_backup(
            Some(within_one_week),
            BackupPeriod::Weekly
        ));
        assert!(should_auto_backup(
            Some(over_one_week),
            BackupPeriod::Weekly
        ));
    }
}

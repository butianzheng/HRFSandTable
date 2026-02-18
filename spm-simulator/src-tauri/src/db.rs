use sea_orm::{ConnectionTrait, Database, DatabaseConnection, Statement};
use std::sync::OnceLock;
use tauri::AppHandle;
use tauri::Manager;

static DB: OnceLock<DatabaseConnection> = OnceLock::new();

pub fn get_db() -> &'static DatabaseConnection {
    DB.get().expect("Database not initialized")
}

pub fn get_db_from_app(_app: &AppHandle) -> Result<&'static DatabaseConnection, crate::AppError> {
    DB.get()
        .ok_or_else(|| crate::AppError::DatabaseError("Database not initialized".to_string()))
}

pub async fn init_database_for_test(db_url: &str) -> Result<(), Box<dyn std::error::Error>> {
    if DB.get().is_some() {
        return Ok(());
    }

    if let Some(raw_path) = db_url.strip_prefix("sqlite:") {
        let file_path = raw_path.split('?').next().unwrap_or_default();
        if !file_path.is_empty() {
            if let Some(parent) = std::path::Path::new(file_path).parent() {
                std::fs::create_dir_all(parent)?;
            }
        }
    }

    let db = Database::connect(db_url).await?;
    run_migrations(&db).await?;
    // Parallel tests may race between `get` and `set`; ignore loser branch safely.
    if DB.set(db).is_err() {
        return Ok(());
    }
    Ok(())
}

/// CLI/脚本场景初始化数据库（复用测试初始化逻辑）
pub async fn init_database_for_cli(db_url: &str) -> Result<(), Box<dyn std::error::Error>> {
    init_database_for_test(db_url).await
}

pub async fn init_database(app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_dir = app.path().app_data_dir()?;
    std::fs::create_dir_all(&app_dir)?;

    let db_path = app_dir.join("spm_simulator.db");
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

    log::info!("Initializing database at: {}", db_url);

    let db = Database::connect(&db_url).await?;

    // Run migrations
    run_migrations(&db).await?;

    DB.set(db).map_err(|_| "Database already initialized")?;

    log::info!("Database initialized successfully");
    Ok(())
}

async fn run_migrations(db: &DatabaseConnection) -> Result<(), Box<dyn std::error::Error>> {
    // Create tables using raw SQL for simplicity and full control
    let sql = include_str!("migration/init.sql");
    for statement in split_sql_statements(sql) {
        db.execute(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            statement,
        ))
        .await
        .ok(); // Ignore errors for IF NOT EXISTS statements
    }

    // Insert default data
    let defaults = include_str!("migration/defaults.sql");
    for statement in split_sql_statements(defaults) {
        db.execute(Statement::from_string(
            sea_orm::DatabaseBackend::Sqlite,
            statement,
        ))
        .await
        .ok();
    }

    Ok(())
}

fn split_sql_statements(sql: &str) -> Vec<String> {
    let mut statements = Vec::new();
    let mut buffer = String::new();

    for line in sql.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with("--") {
            continue;
        }

        buffer.push_str(line);
        buffer.push('\n');

        if trimmed.ends_with(';') {
            let stmt = buffer.trim();
            if !stmt.is_empty() {
                statements.push(stmt.trim_end_matches(';').trim().to_string());
            }
            buffer.clear();
        }
    }

    let tail = buffer.trim();
    if !tail.is_empty() {
        statements.push(tail.to_string());
    }

    statements
}

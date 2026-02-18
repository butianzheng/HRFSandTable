use crate::utils::log::write_operation_log as write_log_full;
use crate::AppError;
use sea_orm::prelude::Expr;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MaterialFilter {
    pub status: Option<String>,
    pub temp_status: Option<String>,
    pub steel_grade: Option<String>,
    pub width_min: Option<f64>,
    pub width_max: Option<f64>,
    pub thickness_min: Option<f64>,
    pub thickness_max: Option<f64>,
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pagination {
    pub page: u64,
    pub page_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PagedResult<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub page_size: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportResult {
    pub batch_id: i32,
    pub total: usize,
    pub success: usize,
    pub failed: usize,
    pub skipped: usize,
    pub overwritten: usize,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RefreshResult {
    pub total: usize,
    pub tempered: usize,
    pub waiting: usize,
}

/// 物料模块专用日志写入（log_type/target_type 固定为 "material"）
async fn write_operation_log(action: &str, detail: Option<String>, target_id: Option<i32>) {
    write_log_full("material", action, Some("material"), target_id, detail).await;
}

#[tauri::command]
pub async fn import_materials(
    file_path: String,
    mapping_id: Option<i32>,
    conflict_mode: Option<String>,
) -> Result<ImportResult, AppError> {
    let mode = conflict_mode.as_deref().unwrap_or("skip");
    log::info!(
        "Importing materials from: {}, mapping_id: {:?}, conflict_mode: {}",
        file_path,
        mapping_id,
        mode
    );

    let summary =
        crate::services::import_service::import_from_excel(&file_path, mapping_id, mode).await?;

    let result = ImportResult {
        batch_id: summary.batch_id,
        total: summary.total,
        success: summary.success,
        failed: summary.failed,
        skipped: summary.skipped,
        overwritten: summary.overwritten,
        errors: summary.errors,
    };

    write_operation_log(
        "import",
        Some(format!(
            "导入材料: 文件={}, mode={}, 成功={}, 跳过={}, 覆盖={}, 失败={}",
            file_path, mode, result.success, result.skipped, result.overwritten, result.failed
        )),
        None,
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn test_import_materials(
    file_path: String,
    mapping_id: Option<i32>,
    mappings_json: Option<String>,
    value_transforms: Option<String>,
    sample_limit: Option<usize>,
) -> Result<crate::services::import_service::ImportTestResult, AppError> {
    let result = crate::services::import_service::test_import_from_file(
        &file_path,
        mapping_id,
        mappings_json.as_deref(),
        value_transforms.as_deref(),
        sample_limit,
    )
    .await?;

    write_operation_log(
        "import_test",
        Some(format!(
            "沙盒测试导入: 文件={}, mapping_id={:?}, total={}, success={}, failed={}",
            file_path, mapping_id, result.total, result.success, result.failed
        )),
        None,
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn get_materials(
    filter: Option<MaterialFilter>,
    pagination: Option<Pagination>,
) -> Result<PagedResult<crate::models::material::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::material::Entity as Material;
    use sea_orm::*;

    let db = get_db();
    let page = pagination.as_ref().map(|p| p.page).unwrap_or(1);
    let page_size = pagination.as_ref().map(|p| p.page_size).unwrap_or(50);

    let mut query = Material::find();

    if let Some(ref f) = filter {
        if let Some(ref status) = f.status {
            query = query.filter(crate::models::material::Column::Status.eq(status.clone()));
        }
        if let Some(ref temp_status) = f.temp_status {
            query =
                query.filter(crate::models::material::Column::TempStatus.eq(temp_status.clone()));
        }
        if let Some(ref steel_grade) = f.steel_grade {
            query =
                query.filter(crate::models::material::Column::SteelGrade.eq(steel_grade.clone()));
        }
        if let Some(width_min) = f.width_min {
            query = query.filter(crate::models::material::Column::Width.gte(width_min));
        }
        if let Some(width_max) = f.width_max {
            query = query.filter(crate::models::material::Column::Width.lte(width_max));
        }
        if let Some(thickness_min) = f.thickness_min {
            query = query.filter(crate::models::material::Column::Thickness.gte(thickness_min));
        }
        if let Some(thickness_max) = f.thickness_max {
            query = query.filter(crate::models::material::Column::Thickness.lte(thickness_max));
        }
        if let Some(ref keyword) = f.keyword {
            let kw = keyword.trim();
            if !kw.is_empty() {
                let like_kw = format!("%{}%", kw);
                query = query.filter(
                    Condition::any()
                        .add(crate::models::material::Column::CoilId.like(like_kw.clone()))
                        .add(crate::models::material::Column::SteelGrade.like(like_kw.clone()))
                        .add(crate::models::material::Column::CustomerName.like(like_kw.clone()))
                        .add(crate::models::material::Column::ContractNo.like(like_kw.clone())),
                );
            }
        }
    }

    let total = query.clone().count(db).await?;

    let items = query
        .order_by_desc(crate::models::material::Column::CreatedAt)
        .paginate(db, page_size)
        .fetch_page(page.saturating_sub(1))
        .await?;

    Ok(PagedResult {
        items,
        total,
        page,
        page_size,
    })
}

#[tauri::command]
pub async fn update_material_status(ids: Vec<i32>, status: String) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::material::Entity as Material;
    use sea_orm::*;

    let valid_statuses = ["pending", "completed", "frozen"];
    if !valid_statuses.contains(&status.as_str()) {
        return Err(AppError::ConstraintViolation(format!(
            "无效的材料状态: {}，允许值: {:?}",
            status, valid_statuses
        )));
    }

    let db = get_db();
    let result = Material::update_many()
        .col_expr(
            crate::models::material::Column::Status,
            Expr::value(&status),
        )
        .col_expr(
            crate::models::material::Column::UpdatedAt,
            Expr::current_timestamp().into(),
        )
        .filter(crate::models::material::Column::Id.is_in(ids))
        .exec(db)
        .await?;

    write_operation_log(
        "update",
        Some(format!(
            "批量更新材料状态为 {}: {} 条",
            status, result.rows_affected
        )),
        None,
    )
    .await;

    Ok(result.rows_affected)
}

#[tauri::command]
pub async fn update_material_priority(ids: Vec<i32>, priority: i32) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::material::Entity as Material;
    use sea_orm::*;

    let db = get_db();
    let result = Material::update_many()
        .col_expr(
            crate::models::material::Column::PriorityManualAdjust,
            Expr::value(priority),
        )
        .col_expr(
            crate::models::material::Column::UpdatedAt,
            Expr::current_timestamp().into(),
        )
        .filter(crate::models::material::Column::Id.is_in(ids))
        .exec(db)
        .await?;

    write_operation_log(
        "update",
        Some(format!(
            "批量调整材料优先级为 {}: {} 条",
            priority, result.rows_affected
        )),
        None,
    )
    .await;

    Ok(result.rows_affected)
}

#[tauri::command]
pub async fn refresh_temper_status() -> Result<RefreshResult, AppError> {
    let (total, tempered, waiting) =
        crate::services::temp_service::refresh_all_temper_status().await?;

    let result = RefreshResult {
        total,
        tempered,
        waiting,
    };

    write_operation_log(
        "update",
        Some(format!(
            "刷新适温状态: total={}, ready={}, waiting={}",
            result.total, result.tempered, result.waiting
        )),
        None,
    )
    .await;

    Ok(result)
}

#[tauri::command]
pub async fn delete_materials(ids: Vec<i32>) -> Result<u64, AppError> {
    use crate::db::get_db;
    use crate::models::material::Entity as Material;
    use sea_orm::*;

    let db = get_db();
    let result = Material::delete_many()
        .filter(crate::models::material::Column::Id.is_in(ids))
        .exec(db)
        .await?;

    write_operation_log(
        "delete",
        Some(format!("批量删除材料: {} 条", result.rows_affected)),
        None,
    )
    .await;

    Ok(result.rows_affected)
}

// ─── 导入批次管理命令 ───

#[derive(Debug, Serialize, Deserialize)]
pub struct DeleteBatchResult {
    pub batch_id: i32,
    pub deleted_materials: u64,
    pub kept_materials: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReplaceResult {
    pub cleared_material_count: u64,
    pub cleared_schedule_item_count: u64,
    pub import: ImportResult,
}

#[tauri::command]
pub async fn get_import_batches() -> Result<Vec<crate::models::import_batch::Model>, AppError> {
    use crate::db::get_db;
    use crate::models::import_batch;
    use sea_orm::*;

    let db = get_db();
    let batches = import_batch::Entity::find()
        .filter(import_batch::Column::Status.ne("deleted"))
        .order_by_desc(import_batch::Column::CreatedAt)
        .all(db)
        .await?;

    Ok(batches)
}

#[tauri::command]
pub async fn delete_import_batch(batch_id: i32) -> Result<DeleteBatchResult, AppError> {
    use crate::db::get_db;
    use crate::models::{import_batch, material};
    use sea_orm::*;

    let db = get_db();

    // 统计该批次下的材料
    let total_in_batch = material::Entity::find()
        .filter(material::Column::ImportBatchId.eq(batch_id))
        .count(db)
        .await?;

    // 只删除 pending 状态的材料
    let delete_result = material::Entity::delete_many()
        .filter(material::Column::ImportBatchId.eq(batch_id))
        .filter(material::Column::Status.eq("pending"))
        .exec(db)
        .await?;

    let deleted = delete_result.rows_affected;
    let kept = total_in_batch - deleted;

    // 更新批次状态
    import_batch::Entity::update_many()
        .col_expr(import_batch::Column::Status, Expr::value("deleted"))
        .filter(import_batch::Column::Id.eq(batch_id))
        .exec(db)
        .await?;

    write_operation_log(
        "delete_batch",
        Some(format!(
            "删除导入批次: batch_id={}, 删除材料={}, 保留={}",
            batch_id, deleted, kept
        )),
        None,
    )
    .await;

    Ok(DeleteBatchResult {
        batch_id,
        deleted_materials: deleted,
        kept_materials: kept,
    })
}

#[tauri::command]
pub async fn replace_all_materials(
    file_path: String,
    mapping_id: Option<i32>,
) -> Result<ReplaceResult, AppError> {
    use crate::db::get_db;
    use crate::models::{import_batch, material, schedule_item};
    use sea_orm::*;

    let db = get_db();

    // 1. 删除所有排程项（解除 material_id 外键约束）
    let clear_schedule_result = schedule_item::Entity::delete_many().exec(db).await?;
    let cleared_schedule_item_count = clear_schedule_result.rows_affected;

    // 2. 删除所有材料（不限状态，全部清除）
    let clear_material_result = material::Entity::delete_many().exec(db).await?;
    let cleared_material_count = clear_material_result.rows_affected;

    // 3. 将所有 active 批次标记为 superseded
    import_batch::Entity::update_many()
        .col_expr(import_batch::Column::Status, Expr::value("superseded"))
        .filter(import_batch::Column::Status.eq("active"))
        .exec(db)
        .await?;

    // 4. 以 skip 模式执行新导入
    let summary =
        crate::services::import_service::import_from_excel(&file_path, mapping_id, "skip").await?;

    let import_result = ImportResult {
        batch_id: summary.batch_id,
        total: summary.total,
        success: summary.success,
        failed: summary.failed,
        skipped: summary.skipped,
        overwritten: summary.overwritten,
        errors: summary.errors,
    };

    write_operation_log(
        "replace_all",
        Some(format!(
            "全量替换材料: 清除材料{}条, 清除排程项{}条, 新导入成功={}",
            cleared_material_count, cleared_schedule_item_count, import_result.success
        )),
        None,
    )
    .await;

    Ok(ReplaceResult {
        cleared_material_count,
        cleared_schedule_item_count,
        import: import_result,
    })
}

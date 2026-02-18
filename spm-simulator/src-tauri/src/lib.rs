pub mod commands;
pub mod db;
pub mod engine;
mod error;
pub mod migration;
pub mod models;
pub mod services;
pub mod utils;

pub use error::AppError;

/// 给 CLI/benchmark 脚本使用的数据库初始化入口
pub async fn init_database_for_cli(db_url: &str) -> Result<(), Box<dyn std::error::Error>> {
    db::init_database_for_cli(db_url).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            tauri::async_runtime::block_on(async move {
                db::init_database(&app_handle)
                    .await
                    .expect("Failed to initialize database");
                if let Err(err) =
                    services::backup_service::run_startup_auto_backup(&app_handle).await
                {
                    log::warn!("启动自动备份失败: {}", err);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::material::import_materials,
            commands::material::test_import_materials,
            commands::material::get_materials,
            commands::material::update_material_status,
            commands::material::update_material_priority,
            commands::material::refresh_temper_status,
            commands::material::delete_materials,
            commands::material::get_import_batches,
            commands::material::delete_import_batch,
            commands::material::replace_all_materials,
            commands::schedule::create_plan,
            commands::schedule::get_plan,
            commands::schedule::get_plans,
            commands::schedule::save_plan,
            commands::schedule::delete_plan,
            commands::schedule::auto_schedule,
            commands::schedule::analyze_schedule_idle_gaps,
            commands::schedule::add_to_schedule,
            commands::schedule::remove_from_schedule,
            commands::schedule::move_schedule_item,
            commands::schedule::lock_schedule_items,
            commands::schedule::get_schedule_items,
            commands::schedule::update_plan_status,
            commands::schedule::push_undo,
            commands::schedule::undo_action,
            commands::schedule::redo_action,
            commands::schedule::get_undo_redo_count,
            commands::schedule::clear_undo_stack,
            commands::schedule::get_risk_analysis,
            commands::schedule::evaluate_risks,
            commands::schedule::apply_risk_suggestion,
            commands::schedule::ignore_risk,
            commands::schedule::unignore_risk,
            commands::schedule::get_waiting_forecast,
            commands::schedule::get_waiting_forecast_details,
            commands::schedule::compare_plans,
            commands::schedule::export_compare_sequence_csv,
            commands::schedule::export_compare_sequence_excel,
            commands::schedule::compare_plans_multi,
            commands::schedule::get_plan_versions,
            commands::schedule::rollback_plan_version,
            commands::schedule::get_operation_logs,
            commands::schedule::get_operation_log_estimate,
            commands::schedule::export_logs,
            commands::schedule::export_logs_excel,
            commands::schedule::export_plan_history_report,
            commands::schedule::get_cleanup_estimate,
            commands::schedule::clear_logs,
            commands::schedule::clean_history_plans,
            commands::schedule::clean_materials,
            commands::config::get_system_config,
            commands::config::update_system_config,
            commands::config::get_shift_config,
            commands::config::update_shift_config,
            commands::config::get_priority_weight_configs,
            commands::config::upsert_priority_weight_configs,
            commands::config::get_priority_dimension_configs,
            commands::config::upsert_priority_dimension_config,
            commands::config::delete_priority_dimension_config,
            commands::config::get_customer_priority_configs,
            commands::config::upsert_customer_priority_config,
            commands::config::delete_customer_priority_config,
            commands::config::get_batch_priority_configs,
            commands::config::upsert_batch_priority_config,
            commands::config::delete_batch_priority_config,
            commands::config::get_product_type_priority_configs,
            commands::config::upsert_product_type_priority_config,
            commands::config::delete_product_type_priority_config,
            commands::config::import_priority_configs,
            commands::config::export_priority_configs_csv,
            commands::config::export_priority_configs_excel,
            commands::config::export_priority_config_template_csv,
            commands::config::export_priority_config_template_excel,
            commands::config::get_strategy_templates,
            commands::config::create_strategy_template,
            commands::config::update_strategy_template,
            commands::config::delete_strategy_template,
            commands::config::set_default_strategy,
            commands::config::export_strategy_template,
            commands::config::import_strategy_template,
            commands::config::get_maintenance_plans,
            commands::config::create_maintenance_plan,
            commands::config::update_maintenance_plan,
            commands::config::delete_maintenance_plan,
            commands::field_mapping::get_field_mappings,
            commands::field_mapping::get_field_mapping,
            commands::field_mapping::create_field_mapping,
            commands::field_mapping::update_field_mapping,
            commands::field_mapping::delete_field_mapping,
            commands::field_mapping::preview_file_headers,
            commands::export::export_plan_excel,
            commands::export::export_plan_csv,
            commands::export::export_materials_excel,
            commands::export::get_material_stats,
            commands::export::get_export_templates,
            commands::export::create_export_template,
            commands::export::update_export_template,
            commands::export::delete_export_template,
            commands::export::backup_database,
            commands::export::get_backups,
            commands::export::restore_database,
            commands::export::delete_backup,
            commands::performance::record_performance_metric,
            commands::performance::get_performance_stats,
            commands::performance::get_performance_baselines,
            commands::performance::check_performance_alerts,
            commands::performance::cleanup_performance_metrics,
            commands::error_tracking::log_error,
            commands::error_tracking::get_errors,
            commands::error_tracking::get_error_stats,
            commands::error_tracking::resolve_error,
            commands::error_tracking::delete_error,
            commands::error_tracking::cleanup_old_errors,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

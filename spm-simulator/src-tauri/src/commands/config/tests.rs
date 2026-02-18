use super::*;
use calamine::Reader;
use std::time::{SystemTime, UNIX_EPOCH};

fn unique_suffix() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("系统时间异常")
        .as_nanos();
    nanos.to_string()
}

async fn ensure_test_db_initialized() {
    let seed = unique_suffix();
    let db_path = std::env::temp_dir().join(format!("spm_priority_config_test_{}.db", seed));
    let db_url = format!("sqlite:{}?mode=rwc", db_path.display());
    crate::db::init_database_for_test(&db_url)
        .await
        .expect("初始化测试数据库失败");
}

#[tokio::test]
async fn priority_import_precheck_and_apply_should_work() {
    ensure_test_db_initialized().await;

    let seed = unique_suffix();
    let csv_path = std::env::temp_dir().join(format!("priority_import_{}.csv", seed));
    let csv_content = format!(
        concat!(
            "config_type,id,dimension_type,dimension_code,dimension_name,score,weight,enabled,sort_order,description,customer_code,customer_name,priority_level,priority_type,priority_score,batch_code,batch_name,product_type,product_name,remarks,rule_config\n",
            "weight,,weight_test_{seed},,测试权重,,{weight},true,99,测试权重,,,,,,,,,,,\n",
            "customer,,,,,,,,,,C_TEST_{seed},客户测试{seed},key,,80,,,,,测试客户,\n",
            "dimension,,delivery,D_TEST_{seed},测试交期,777,,true,88,测试维度,,,,,,,,,,,{{\"expr\":\"ok\"}}\n",
            "unknown,,,,,,,,,,,,,,,,,,,,\n",
            "dimension,,contract,C_BAD_{seed},坏JSON,10,,true,89,测试坏JSON,,,,,,,,,,,{{bad}}\n"
        ),
        seed = seed,
        weight = "0.7",
    );
    std::fs::write(&csv_path, csv_content).expect("写入CSV测试文件失败");

    let before_weight = get_priority_weight_configs()
        .await
        .expect("读取权重失败")
        .len();
    let before_customer = get_customer_priority_configs()
        .await
        .expect("读取客户配置失败")
        .len();
    let before_dimension = get_priority_dimension_configs(None)
        .await
        .expect("读取维度配置失败")
        .len();

    let precheck = import_priority_configs(csv_path.to_string_lossy().to_string(), Some(true))
        .await
        .expect("预检失败");
    assert!(precheck.dry_run);
    assert_eq!(precheck.imported_weight, 1);
    assert_eq!(precheck.imported_customer, 1);
    assert_eq!(precheck.imported_dimension, 1);
    assert_eq!(precheck.skipped_rows, 2);
    assert!(!precheck.warnings.is_empty());

    let after_precheck_weight = get_priority_weight_configs()
        .await
        .expect("读取权重失败")
        .len();
    let after_precheck_customer = get_customer_priority_configs()
        .await
        .expect("读取客户配置失败")
        .len();
    let after_precheck_dimension = get_priority_dimension_configs(None)
        .await
        .expect("读取维度配置失败")
        .len();
    assert_eq!(after_precheck_weight, before_weight);
    assert_eq!(after_precheck_customer, before_customer);
    assert_eq!(after_precheck_dimension, before_dimension);

    let import_result =
        import_priority_configs(csv_path.to_string_lossy().to_string(), Some(false))
            .await
            .expect("正式导入失败");
    assert!(!import_result.dry_run);
    assert_eq!(import_result.imported_weight, 1);
    assert_eq!(import_result.imported_customer, 1);
    assert_eq!(import_result.imported_dimension, 1);
    assert_eq!(import_result.skipped_rows, 2);

    let after_import_weight = get_priority_weight_configs()
        .await
        .expect("读取权重失败")
        .len();
    let after_import_customer = get_customer_priority_configs()
        .await
        .expect("读取客户配置失败")
        .len();
    let after_import_dimension = get_priority_dimension_configs(None)
        .await
        .expect("读取维度配置失败")
        .len();
    assert!(after_import_weight > before_weight);
    assert!(after_import_customer > before_customer);
    assert!(after_import_dimension > before_dimension);

    let _ = std::fs::remove_file(&csv_path);
}

#[tokio::test]
async fn priority_template_and_data_export_should_work() {
    ensure_test_db_initialized().await;

    let seed = unique_suffix();
    let csv_tpl_path = std::env::temp_dir().join(format!("priority_tpl_{}.csv", seed));
    let xlsx_tpl_path = std::env::temp_dir().join(format!("priority_tpl_{}.xlsx", seed));
    let csv_data_path = std::env::temp_dir().join(format!("priority_data_{}.csv", seed));
    let xlsx_data_path = std::env::temp_dir().join(format!("priority_data_{}.xlsx", seed));

    let tpl_csv_rows =
        export_priority_config_template_csv(csv_tpl_path.to_string_lossy().to_string())
            .await
            .expect("导出CSV模板失败");
    assert!(tpl_csv_rows > 0);
    let tpl_csv_content = std::fs::read_to_string(&csv_tpl_path).expect("读取CSV模板失败");
    assert!(tpl_csv_content.contains("config_type"));
    assert!(tpl_csv_content.contains("weight"));

    let tpl_xlsx_sheets =
        export_priority_config_template_excel(xlsx_tpl_path.to_string_lossy().to_string())
            .await
            .expect("导出Excel模板失败");
    assert!(tpl_xlsx_sheets >= 5);
    let tpl_wb = calamine::open_workbook_auto(&xlsx_tpl_path).expect("打开Excel模板失败");
    let tpl_sheet_names = tpl_wb.sheet_names().to_vec();
    assert!(tpl_sheet_names.iter().any(|s| s == "weight_config"));
    assert!(tpl_sheet_names.iter().any(|s| s == "dimension_config"));
    assert!(tpl_sheet_names.iter().any(|s| s == "customer_config"));
    assert!(tpl_sheet_names.iter().any(|s| s == "batch_config"));
    assert!(tpl_sheet_names.iter().any(|s| s == "product_type_config"));

    let csv_rows = export_priority_configs_csv(csv_data_path.to_string_lossy().to_string())
        .await
        .expect("导出CSV数据失败");
    assert!(csv_rows > 0);
    let csv_content = std::fs::read_to_string(&csv_data_path).expect("读取CSV数据失败");
    assert!(csv_content.contains("config_type"));

    let xlsx_rows = export_priority_configs_excel(xlsx_data_path.to_string_lossy().to_string())
        .await
        .expect("导出Excel数据失败");
    assert!(xlsx_rows > 0);
    let wb = calamine::open_workbook_auto(&xlsx_data_path).expect("打开Excel数据失败");
    let sheet_names = wb.sheet_names().to_vec();
    assert!(sheet_names.iter().any(|s| s == "weight_config"));
    assert!(sheet_names.iter().any(|s| s == "dimension_config"));

    let _ = std::fs::remove_file(&csv_tpl_path);
    let _ = std::fs::remove_file(&xlsx_tpl_path);
    let _ = std::fs::remove_file(&csv_data_path);
    let _ = std::fs::remove_file(&xlsx_data_path);
}

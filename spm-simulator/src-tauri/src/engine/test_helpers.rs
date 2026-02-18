//! 引擎测试共用辅助函数

#[cfg(test)]
pub mod helpers {
    use crate::engine::sorter::SortedMaterial;
    use crate::models::material;
    use chrono::Utc;

    /// 创建测试用 material::Model
    pub fn make_material(id: i32, coil_id: &str, width: f64, weight: f64) -> material::Model {
        material::Model {
            id,
            coil_id: coil_id.to_string(),
            contract_no: None,
            customer_name: None,
            customer_code: None,
            steel_grade: "Q235".to_string(),
            thickness: 2.0,
            width,
            weight,
            hardness_level: None,
            surface_level: None,
            roughness_req: None,
            elongation_req: None,
            product_type: None,
            contract_attr: None,
            contract_nature: None,
            export_flag: None,
            weekly_delivery: None,
            batch_code: None,
            coiling_time: Utc::now(),
            temp_status: Some("ready".to_string()),
            temp_wait_days: None,
            is_tempered: Some(true),
            tempered_at: None,
            storage_days: None,
            storage_loc: None,
            due_date: None,
            status: Some("active".to_string()),
            priority_auto: None,
            priority_manual_adjust: None,
            priority_final: None,
            priority_detail: None,
            priority_reason: None,
            remarks: None,
            created_at: None,
            updated_at: None,
            import_batch_id: None,
        }
    }

    /// 将 material::Model 包装为 SortedMaterial（空排序键）
    pub fn wrap(m: material::Model) -> SortedMaterial {
        SortedMaterial {
            material: m,
            sort_keys: vec![],
            earliest_schedule_date: None,
        }
    }
}

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "material")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub coil_id: String,
    pub contract_no: Option<String>,
    pub customer_name: Option<String>,
    pub customer_code: Option<String>,
    pub steel_grade: String,
    pub thickness: f64,
    pub width: f64,
    pub weight: f64,
    pub hardness_level: Option<String>,
    pub surface_level: Option<String>,
    pub roughness_req: Option<String>,
    pub elongation_req: Option<f64>,
    pub product_type: Option<String>,
    pub contract_attr: Option<String>,
    pub contract_nature: Option<String>,
    pub export_flag: Option<bool>,
    pub weekly_delivery: Option<bool>,
    pub batch_code: Option<String>,
    pub coiling_time: ChronoDateTimeUtc,
    pub temp_status: Option<String>,
    pub temp_wait_days: Option<i32>,
    pub is_tempered: Option<bool>,
    pub tempered_at: Option<ChronoDateTimeUtc>,
    pub storage_days: Option<i32>,
    pub storage_loc: Option<String>,
    pub due_date: Option<ChronoDateTimeUtc>,
    pub status: Option<String>,
    pub priority_auto: Option<i32>,
    pub priority_manual_adjust: Option<i32>,
    pub priority_final: Option<i32>,
    pub priority_detail: Option<String>,
    pub priority_reason: Option<String>,
    pub remarks: Option<String>,
    pub created_at: Option<ChronoDateTimeUtc>,
    pub updated_at: Option<ChronoDateTimeUtc>,
    pub import_batch_id: Option<i32>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

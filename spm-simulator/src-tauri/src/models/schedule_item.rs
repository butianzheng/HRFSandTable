use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "schedule_item")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub plan_id: i32,
    pub material_id: i32,
    pub sequence: i32,
    pub shift_date: String,
    pub shift_no: i32,
    pub shift_type: String,
    pub planned_start: Option<String>,
    pub planned_end: Option<String>,
    pub cumulative_weight: Option<f64>,
    pub is_roll_change: Option<bool>,
    pub is_locked: Option<bool>,
    pub lock_reason: Option<String>,
    pub risk_flags: Option<String>,
    pub created_at: Option<ChronoDateTimeUtc>,
    pub updated_at: Option<ChronoDateTimeUtc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

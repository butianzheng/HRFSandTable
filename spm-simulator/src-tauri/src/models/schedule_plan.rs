use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "schedule_plan")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    #[sea_orm(unique)]
    pub plan_no: String,
    pub name: String,
    pub period_type: String,
    pub start_date: String,
    pub end_date: String,
    pub strategy_id: Option<i32>,
    pub status: Option<String>,
    pub version: Option<i32>,
    pub parent_id: Option<i32>,
    pub total_count: Option<i32>,
    pub total_weight: Option<f64>,
    pub roll_change_count: Option<i32>,
    pub score_overall: Option<i32>,
    pub score_sequence: Option<i32>,
    pub score_delivery: Option<i32>,
    pub score_efficiency: Option<i32>,
    pub risk_count_high: Option<i32>,
    pub risk_count_medium: Option<i32>,
    pub risk_count_low: Option<i32>,
    pub risk_summary: Option<String>,
    pub created_at: Option<ChronoDateTimeUtc>,
    pub updated_at: Option<ChronoDateTimeUtc>,
    pub remarks: Option<String>,
    pub ignored_risks: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

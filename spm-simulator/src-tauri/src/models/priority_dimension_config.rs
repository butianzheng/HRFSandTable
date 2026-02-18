use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "priority_dimension_config")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub dimension_type: String,
    pub dimension_code: String,
    pub dimension_name: String,
    pub score: i32,
    pub enabled: bool,
    pub sort_order: Option<i32>,
    pub rule_config: Option<String>,
    pub description: Option<String>,
    pub created_at: Option<ChronoDateTimeUtc>,
    pub updated_at: Option<ChronoDateTimeUtc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

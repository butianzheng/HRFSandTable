use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "field_mapping")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: i32,
    pub template_name: String,
    pub is_default: Option<bool>,
    pub source_type: String,
    pub mappings: String,
    pub value_transforms: Option<String>,
    pub created_at: Option<ChronoDateTimeUtc>,
    pub updated_at: Option<ChronoDateTimeUtc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

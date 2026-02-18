//! 优先级计算器 — 6 维因子加权求和
//!
//! Priority = Σ weight_i × score_i + manual_adjust
//!
//! 6 个维度：
//!   1. assessment  — 合同考核 (weight 1.0)
//!   2. delivery    — 交期属性 (weight 0.9)
//!   3. contract    — 合同属性 (weight 0.5)
//!   4. customer    — 客户优先级 (weight 0.6)
//!   5. batch       — 集批优先级 (weight 0.4)
//!   6. product_type — 产品大类 (weight 0.5)

use chrono::{Datelike, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::models::material;

/// 各维度分数的明细
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriorityDetail {
    pub assessment_score: i32,
    pub delivery_score: i32,
    pub contract_score: i32,
    pub customer_score: i32,
    pub batch_score: i32,
    pub product_type_score: i32,
    pub manual_adjust: i32,
    pub final_score: i32,
    pub reasons: Vec<String>,
}

/// 优先级维度权重
#[derive(Debug, Clone)]
pub struct DimensionWeights {
    pub assessment: f64,
    pub delivery: f64,
    pub contract: f64,
    pub customer: f64,
    pub batch: f64,
    pub product_type: f64,
}

impl Default for DimensionWeights {
    fn default() -> Self {
        Self {
            assessment: 1.0,
            delivery: 0.9,
            contract: 0.5,
            customer: 0.6,
            batch: 0.4,
            product_type: 0.5,
        }
    }
}

/// 优先级计算上下文——从 DB 加载的各种配置映射
#[derive(Debug, Clone)]
pub struct PriorityContext {
    pub weights: DimensionWeights,
    /// delivery dimension_code → score
    pub delivery_scores: HashMap<String, i32>,
    /// contract dimension_code → score
    pub contract_scores: HashMap<String, i32>,
    /// customer_code → score
    pub customer_scores: HashMap<String, i32>,
    /// batch_code → score
    pub batch_scores: HashMap<String, i32>,
    /// product_type → score
    pub product_type_scores: HashMap<String, i32>,
}

impl Default for PriorityContext {
    fn default() -> Self {
        let mut delivery = HashMap::new();
        delivery.insert("D+0".into(), 1000);
        delivery.insert("D+7".into(), 900);
        delivery.insert("super_overdue".into(), 800);
        delivery.insert("double_overdue".into(), 700);
        delivery.insert("overdue".into(), 600);
        delivery.insert("current_period".into(), 500);
        delivery.insert("current_delayed".into(), 400);
        delivery.insert("next_period".into(), 300);
        delivery.insert("next_delayed".into(), 200);
        delivery.insert("no_requirement".into(), 0);

        let mut contract = HashMap::new();
        contract.insert("export_contract".into(), 100);
        contract.insert("futures_contract".into(), 90);
        contract.insert("spot_contract".into(), 80);
        contract.insert("transition_contract".into(), 70);
        contract.insert("other".into(), 0);

        Self {
            weights: DimensionWeights::default(),
            delivery_scores: delivery,
            contract_scores: contract,
            customer_scores: HashMap::new(),
            batch_scores: HashMap::new(),
            product_type_scores: HashMap::new(),
        }
    }
}

/// 为单个材料计算综合优先级
pub fn calculate_priority(mat: &material::Model, ctx: &PriorityContext) -> PriorityDetail {
    let mut reasons = Vec::new();

    // ---- 1. 合同考核 ----
    let assessment_score = calculate_assessment(mat, &mut reasons);

    // ---- 2. 交期属性 ----
    let delivery_score = calculate_delivery(mat, ctx, &mut reasons);

    // ---- 3. 合同属性 ----
    let contract_score = calculate_contract(mat, ctx, &mut reasons);

    // ---- 4. 客户优先级 ----
    let customer_score = calculate_customer(mat, ctx, &mut reasons);

    // ---- 5. 集批优先级 ----
    let batch_score = calculate_batch(mat, ctx, &mut reasons);

    // ---- 6. 产品大类 ----
    let product_type_score = calculate_product_type(mat, ctx, &mut reasons);

    // 人工调整
    let manual_adjust = mat.priority_manual_adjust.unwrap_or(0);

    // 加权汇总
    let w = &ctx.weights;
    let weighted_sum = w.assessment * assessment_score as f64
        + w.delivery * delivery_score as f64
        + w.contract * contract_score as f64
        + w.customer * customer_score as f64
        + w.batch * batch_score as f64
        + w.product_type * product_type_score as f64
        + manual_adjust as f64;

    let final_score = weighted_sum.round() as i32;

    PriorityDetail {
        assessment_score,
        delivery_score,
        contract_score,
        customer_score,
        batch_score,
        product_type_score,
        manual_adjust,
        final_score,
        reasons,
    }
}

// ---------- 维度 1: 合同考核 ----------
fn calculate_assessment(mat: &material::Model, reasons: &mut Vec<String>) -> i32 {
    let nature = mat.contract_nature.as_deref().unwrap_or("");
    let has_delivery = mat.due_date.is_some();

    let is_assessed = (nature == "订单" || nature == "框架订单") && has_delivery;
    if is_assessed {
        reasons.push("考核合同".into());
        100
    } else {
        0
    }
}

// ---------- 维度 2: 交期属性 ----------
fn calculate_delivery(
    mat: &material::Model,
    ctx: &PriorityContext,
    reasons: &mut Vec<String>,
) -> i32 {
    let due = match mat.due_date {
        Some(d) => d,
        None => {
            reasons.push("交期:无要求".into());
            return *ctx.delivery_scores.get("no_requirement").unwrap_or(&0);
        }
    };

    let today = Utc::now().date_naive();
    let due_date = due.date_naive();
    let diff_days = (due_date - today).num_days();

    let (code, label) = if diff_days <= 0 {
        // 已到期或逾期
        let overdue_days = -diff_days;
        if overdue_days > 60 {
            ("double_overdue", "双前欠(逾期>60天)")
        } else if overdue_days > 30 {
            ("super_overdue", "超级前欠(逾期>30天)")
        } else if overdue_days > 0 {
            ("overdue", "前欠(已逾期)")
        } else {
            ("D+0", "D+0(当天到期)")
        }
    } else if diff_days <= 7 {
        ("D+7", "D+7(7天内到期)")
    } else {
        // 根据月份判断
        let due_month = due_date.month();
        let current_month = today.month();
        let current_year = today.year();
        let due_year = due_date.year();

        if due_year == current_year && due_month == current_month {
            ("current_period", "本期(本月到期)")
        } else if (due_year == current_year && due_month == current_month + 1)
            || (due_month == 1 && current_month == 12 && due_year == current_year + 1)
        {
            ("next_period", "次月本期")
        } else {
            ("no_requirement", "远期")
        }
    };

    reasons.push(format!("交期:{}", label));
    *ctx.delivery_scores.get(code).unwrap_or(&0)
}

// ---------- 维度 3: 合同属性 ----------
fn calculate_contract(
    mat: &material::Model,
    ctx: &PriorityContext,
    reasons: &mut Vec<String>,
) -> i32 {
    let is_export = mat.export_flag.unwrap_or(false);
    if is_export {
        reasons.push("合同:出口".into());
        return *ctx.contract_scores.get("export_contract").unwrap_or(&100);
    }

    let attr = mat.contract_attr.as_deref().unwrap_or("");
    let code = match attr {
        "期货" | "futures" => "futures_contract",
        "现货" | "spot" => "spot_contract",
        "过渡材" | "transition" => "transition_contract",
        _ => "other",
    };

    reasons.push(format!("合同:{}", attr));
    *ctx.contract_scores.get(code).unwrap_or(&0)
}

// ---------- 维度 4: 客户优先级 ----------
fn calculate_customer(
    mat: &material::Model,
    ctx: &PriorityContext,
    reasons: &mut Vec<String>,
) -> i32 {
    let code = mat.customer_code.as_deref().unwrap_or("");
    if let Some(&score) = ctx.customer_scores.get(code) {
        reasons.push(format!("客户:已配置({}分)", score));
        score
    } else {
        // 默认普通客户
        50
    }
}

// ---------- 维度 5: 集批优先级 ----------
fn calculate_batch(mat: &material::Model, ctx: &PriorityContext, reasons: &mut Vec<String>) -> i32 {
    let batch = mat.batch_code.as_deref().unwrap_or("");
    if let Some(&score) = ctx.batch_scores.get(batch) {
        reasons.push(format!("集批:已配置({}分)", score));
        score
    } else {
        0
    }
}

// ---------- 维度 6: 产品大类 ----------
fn calculate_product_type(
    mat: &material::Model,
    ctx: &PriorityContext,
    reasons: &mut Vec<String>,
) -> i32 {
    let pt = mat.product_type.as_deref().unwrap_or("");
    if let Some(&score) = ctx.product_type_scores.get(pt) {
        reasons.push(format!("产品类型:已配置({}分)", score));
        score
    } else {
        0
    }
}

/// 从数据库加载完整的优先级计算上下文
pub async fn load_priority_context() -> Result<PriorityContext, crate::AppError> {
    use crate::db::get_db;
    use sea_orm::*;

    let db = get_db();
    let mut ctx = PriorityContext::default();

    // 加载权重
    let weights = crate::models::priority_weight_config::Entity::find()
        .filter(crate::models::priority_weight_config::Column::Enabled.eq(true))
        .all(db)
        .await?;
    for w in &weights {
        match w.dimension_type.as_str() {
            "assessment" => ctx.weights.assessment = w.weight,
            "delivery" => ctx.weights.delivery = w.weight,
            "contract" => ctx.weights.contract = w.weight,
            "customer" => ctx.weights.customer = w.weight,
            "batch" => ctx.weights.batch = w.weight,
            "product_type" => ctx.weights.product_type = w.weight,
            _ => {}
        }
    }

    // 加载交期维度
    let dims = crate::models::priority_dimension_config::Entity::find()
        .filter(crate::models::priority_dimension_config::Column::Enabled.eq(true))
        .all(db)
        .await?;
    for d in &dims {
        match d.dimension_type.as_str() {
            "delivery" => {
                ctx.delivery_scores
                    .insert(d.dimension_code.clone(), d.score);
            }
            "contract" => {
                ctx.contract_scores
                    .insert(d.dimension_code.clone(), d.score);
            }
            _ => {}
        }
    }

    // 加载客户优先级
    let customers = crate::models::customer_priority_config::Entity::find()
        .filter(crate::models::customer_priority_config::Column::Enabled.eq(true))
        .all(db)
        .await?;
    for c in &customers {
        ctx.customer_scores
            .insert(c.customer_code.clone(), c.priority_score);
    }

    // 加载集批优先级
    let batches = crate::models::batch_priority_config::Entity::find()
        .filter(crate::models::batch_priority_config::Column::Enabled.eq(true))
        .all(db)
        .await?;
    for b in &batches {
        ctx.batch_scores
            .insert(b.batch_code.clone(), b.priority_score);
    }

    // 加载产品大类优先级
    let products = crate::models::product_type_priority_config::Entity::find()
        .filter(crate::models::product_type_priority_config::Column::Enabled.eq(true))
        .all(db)
        .await?;
    for p in &products {
        ctx.product_type_scores
            .insert(p.product_type.clone(), p.priority_score);
    }

    Ok(ctx)
}

/// 批量计算所有材料的优先级并更新 DB
pub async fn batch_calculate_priorities(
    materials: &[material::Model],
) -> Result<Vec<(i32, PriorityDetail)>, crate::AppError> {
    use crate::db::get_db;
    use sea_orm::prelude::Expr;
    use sea_orm::*;

    let ctx = load_priority_context().await?;
    let db = get_db();
    let mut results = Vec::with_capacity(materials.len());

    for mat in materials {
        let detail = calculate_priority(mat, &ctx);

        // 更新 DB
        crate::models::material::Entity::update_many()
            .col_expr(
                material::Column::PriorityAuto,
                Expr::value(detail.final_score),
            )
            .col_expr(
                material::Column::PriorityFinal,
                Expr::value(detail.final_score),
            )
            .col_expr(
                material::Column::PriorityDetail,
                Expr::value(serde_json::to_string(&detail).unwrap_or_default()),
            )
            .col_expr(
                material::Column::PriorityReason,
                Expr::value(detail.reasons.join("; ")),
            )
            .col_expr(
                material::Column::UpdatedAt,
                Expr::current_timestamp().into(),
            )
            .filter(material::Column::Id.eq(mat.id))
            .exec(db)
            .await?;

        results.push((mat.id, detail));
    }

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::test_helpers::helpers::make_material;
    use chrono::{Duration, Utc};

    fn default_ctx() -> PriorityContext {
        PriorityContext::default()
    }

    #[test]
    fn test_default_dimension_weights() {
        let w = DimensionWeights::default();
        assert_eq!(w.assessment, 1.0);
        assert_eq!(w.delivery, 0.9);
        assert_eq!(w.contract, 0.5);
        assert_eq!(w.customer, 0.6);
        assert_eq!(w.batch, 0.4);
        assert_eq!(w.product_type, 0.5);
    }

    #[test]
    fn test_calculate_priority_no_due_date() {
        let m = make_material(1, "C001", 1000.0, 10.0);
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        // delivery_score should be 0 (no_requirement)
        assert_eq!(detail.delivery_score, 0);
    }

    #[test]
    fn test_calculate_priority_overdue_60_days() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.due_date = Some(Utc::now() - Duration::days(65));
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        // >60 days overdue = double_overdue = 700
        assert_eq!(detail.delivery_score, 700);
    }

    #[test]
    fn test_calculate_priority_overdue_30_days() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.due_date = Some(Utc::now() - Duration::days(35));
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        // >30 days overdue = super_overdue = 800
        assert_eq!(detail.delivery_score, 800);
    }

    #[test]
    fn test_calculate_priority_d7_threshold() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.due_date = Some(Utc::now() + Duration::days(5));
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        // 5 days from now, <=7 = D+7 = 900
        assert_eq!(detail.delivery_score, 900);
    }

    #[test]
    fn test_delivery_d0_same_day() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        // Due today: diff_days = 0 → overdue_days = 0 → D+0 = 1000
        m.due_date = Some(Utc::now());
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        assert_eq!(detail.delivery_score, 1000);
    }

    #[test]
    fn test_contract_score_export() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.export_flag = Some(true);
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        assert_eq!(detail.contract_score, 100); // export_contract
    }

    #[test]
    fn test_contract_score_futures() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.contract_attr = Some("期货".to_string());
        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);
        assert_eq!(detail.contract_score, 90); // futures_contract
    }

    #[test]
    fn test_priority_weighted_sum() {
        let mut m = make_material(1, "C001", 1000.0, 10.0);
        m.contract_nature = Some("订单".to_string());
        m.due_date = Some(Utc::now()); // D+0 → 1000
        m.export_flag = Some(true); // export → 100

        let ctx = default_ctx();
        let detail = calculate_priority(&m, &ctx);

        // assessment=100 (考核合同), delivery=1000 (D+0), contract=100 (export),
        // customer=50 (default), batch=0, product_type=0, manual=0
        let expected =
            (1.0_f64 * 100.0 + 0.9 * 1000.0 + 0.5 * 100.0 + 0.6 * 50.0 + 0.4 * 0.0 + 0.5 * 0.0)
                .round() as i32;
        assert_eq!(detail.final_score, expected);
    }
}

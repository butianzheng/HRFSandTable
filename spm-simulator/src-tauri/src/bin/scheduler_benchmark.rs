use app_lib::commands::schedule::analyze_schedule_idle_gaps;
use app_lib::db::get_db;
use app_lib::engine::scheduler;
use app_lib::init_database_for_cli;
use app_lib::models::{material, schedule_item, schedule_plan, strategy_template, system_config};
use chrono::{Duration, Utc};
use sea_orm::{ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, Set};
use std::error::Error;
use std::time::Instant;

#[derive(Clone)]
struct Scenario {
    name: &'static str,
    mode: &'static str,
    beam_width: usize,
    beam_lookahead: usize,
    beam_top_k: usize,
    time_budget_ms: u128,
    max_nodes: usize,
    fallback_enabled: bool,
}

#[derive(Clone)]
struct RunRecord {
    ms: f64,
    total_count: i32,
    over_gap_count: i32,
    max_gap_minutes: i32,
}

fn parse_usize_arg(args: &[String], key: &str, default_value: usize) -> usize {
    args.windows(2)
        .find(|w| w[0] == key)
        .and_then(|w| w[1].parse::<usize>().ok())
        .unwrap_or(default_value)
}

fn parse_i32_arg(args: &[String], key: &str, default_value: i32) -> i32 {
    args.windows(2)
        .find(|w| w[0] == key)
        .and_then(|w| w[1].parse::<i32>().ok())
        .unwrap_or(default_value)
}

fn parse_string_arg(args: &[String], key: &str, default_value: &str) -> String {
    args.windows(2)
        .find(|w| w[0] == key)
        .map(|w| w[1].clone())
        .unwrap_or_else(|| default_value.to_string())
}

fn summarize(values: &[f64]) -> (f64, f64, f64, f64) {
    if values.is_empty() {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let mut sorted = values.to_vec();
    sorted.sort_by(|a, b| a.total_cmp(b));
    let len = sorted.len();
    let avg = sorted.iter().sum::<f64>() / len as f64;
    let p95_idx = (((len as f64) * 0.95).ceil() as usize).saturating_sub(1);
    let p95 = sorted[p95_idx.min(len - 1)];
    let min = sorted[0];
    let max = sorted[len - 1];
    (avg, p95, min, max)
}

async fn upsert_config(
    group: &str,
    key: &str,
    value: String,
    value_type: &str,
) -> Result<(), Box<dyn Error>> {
    let db = get_db();
    use sea_orm::{ActiveModelTrait, QueryOrder};

    let existing = system_config::Entity::find()
        .filter(system_config::Column::ConfigGroup.eq(group))
        .filter(system_config::Column::ConfigKey.eq(key))
        .order_by_desc(system_config::Column::Id)
        .one(db)
        .await?;

    if let Some(model) = existing {
        let mut active: system_config::ActiveModel = model.into();
        active.config_value = Set(value);
        active.value_type = Set(value_type.to_string());
        active.updated_at = Set(Some(Utc::now()));
        active.update(db).await?;
    } else {
        let active = system_config::ActiveModel {
            config_group: Set(group.to_string()),
            config_key: Set(key.to_string()),
            config_value: Set(value),
            value_type: Set(value_type.to_string()),
            description: Set(None),
            is_editable: Set(Some(true)),
            updated_at: Set(Some(Utc::now())),
            ..Default::default()
        };
        active.insert(db).await?;
    }
    Ok(())
}

async fn apply_scheduler_scenario(cfg: &Scenario) -> Result<(), Box<dyn Error>> {
    upsert_config("scheduler", "mode", cfg.mode.to_string(), "string").await?;
    upsert_config(
        "scheduler",
        "beam_width",
        cfg.beam_width.to_string(),
        "number",
    )
    .await?;
    upsert_config(
        "scheduler",
        "beam_lookahead",
        cfg.beam_lookahead.to_string(),
        "number",
    )
    .await?;
    upsert_config(
        "scheduler",
        "beam_top_k",
        cfg.beam_top_k.to_string(),
        "number",
    )
    .await?;
    upsert_config(
        "scheduler",
        "time_budget_ms",
        cfg.time_budget_ms.to_string(),
        "number",
    )
    .await?;
    upsert_config(
        "scheduler",
        "max_nodes",
        cfg.max_nodes.to_string(),
        "number",
    )
    .await?;
    upsert_config(
        "scheduler",
        "fallback_enabled",
        cfg.fallback_enabled.to_string(),
        "boolean",
    )
    .await?;
    Ok(())
}

async fn reset_and_seed_data(
    material_count: usize,
    plan_days: usize,
) -> Result<(i32, i32), Box<dyn Error>> {
    use sea_orm::{ActiveModelTrait, QueryOrder};

    let db = get_db();

    schedule_item::Entity::delete_many().exec(db).await?;
    schedule_plan::Entity::delete_many().exec(db).await?;
    material::Entity::delete_many().exec(db).await?;

    let now = Utc::now();
    let mut batch: Vec<material::ActiveModel> = Vec::with_capacity(500);
    for i in 0..material_count {
        let width_bucket = (i % 80) as f64;
        let thickness_bucket = (i % 12) as f64;
        let weight_bucket = (i % 9) as f64;
        let steel_grade = match i % 3 {
            0 => "Q235",
            1 => "Q345",
            _ => "SPHC",
        };
        let hardness = match i % 3 {
            0 => "软",
            1 => "中",
            _ => "硬",
        };
        let surface = match i % 4 {
            0 => "FA",
            1 => "FB",
            2 => "FC",
            _ => "FD",
        };

        batch.push(material::ActiveModel {
            coil_id: Set(format!("BM{:05}", i + 1)),
            contract_no: Set(Some(format!("CT{:05}", i % 500))),
            customer_name: Set(Some(format!("客户{:03}", i % 120))),
            customer_code: Set(Some(format!("C{:03}", i % 120))),
            steel_grade: Set(steel_grade.to_string()),
            thickness: Set(1.0 + thickness_bucket * 0.1),
            width: Set(900.0 + width_bucket * 5.0),
            weight: Set(8.0 + weight_bucket),
            hardness_level: Set(Some(hardness.to_string())),
            surface_level: Set(Some(surface.to_string())),
            roughness_req: Set(None),
            elongation_req: Set(None),
            product_type: Set(Some(format!("P{}", i % 8))),
            contract_attr: Set(None),
            contract_nature: Set(Some("订单".to_string())),
            export_flag: Set(Some(i % 7 == 0)),
            weekly_delivery: Set(Some(i % 11 == 0)),
            batch_code: Set(Some(format!("B{:03}", i % 180))),
            coiling_time: Set(now - Duration::days((i % 45) as i64)),
            temp_status: Set(Some("ready".to_string())),
            temp_wait_days: Set(Some(0)),
            is_tempered: Set(Some(true)),
            tempered_at: Set(Some(now - Duration::days((i % 30) as i64))),
            storage_days: Set(Some((i % 60) as i32)),
            storage_loc: Set(Some(format!("S{}", i % 15))),
            due_date: Set(Some(now + Duration::days((i % 21 + 1) as i64))),
            status: Set(Some("pending".to_string())),
            priority_auto: Set(Some(0)),
            priority_manual_adjust: Set(Some(0)),
            priority_final: Set(Some(0)),
            priority_detail: Set(None),
            priority_reason: Set(None),
            remarks: Set(None),
            created_at: Set(Some(now)),
            updated_at: Set(Some(now)),
            import_batch_id: Set(None),
            ..Default::default()
        });

        if batch.len() >= 500 {
            material::Entity::insert_many(std::mem::take(&mut batch))
                .exec(db)
                .await?;
        }
    }
    if !batch.is_empty() {
        material::Entity::insert_many(batch).exec(db).await?;
    }

    let strategy = strategy_template::Entity::find()
        .order_by_desc(strategy_template::Column::IsDefault)
        .order_by_asc(strategy_template::Column::Id)
        .one(db)
        .await?
        .ok_or("未找到策略模板")?;
    let strategy_id = strategy.id;

    let start_date = now.date_naive();
    let end_date = start_date + Duration::days((plan_days.saturating_sub(1)) as i64);
    let plan = schedule_plan::ActiveModel {
        plan_no: Set(format!("BM-{}", now.format("%Y%m%d%H%M%S"))),
        name: Set(format!("Benchmark-{}x{}d", material_count, plan_days)),
        period_type: Set("custom".to_string()),
        start_date: Set(start_date.format("%Y-%m-%d").to_string()),
        end_date: Set(end_date.format("%Y-%m-%d").to_string()),
        strategy_id: Set(Some(strategy_id)),
        status: Set(Some("draft".to_string())),
        version: Set(Some(1)),
        parent_id: Set(None),
        remarks: Set(Some("自动压测生成".to_string())),
        ..Default::default()
    }
    .insert(db)
    .await?;

    Ok((plan.id, strategy_id))
}

async fn resolve_existing_plan_strategy(
    plan_id: i32,
    forced_strategy_id: i32,
) -> Result<(i32, i32, usize), Box<dyn Error>> {
    use sea_orm::QueryOrder;

    let db = get_db();
    let plan = schedule_plan::Entity::find_by_id(plan_id)
        .one(db)
        .await?
        .ok_or_else(|| format!("plan_id={} 不存在", plan_id))?;
    let strategy_id = if forced_strategy_id > 0 {
        forced_strategy_id
    } else if let Some(sid) = plan.strategy_id {
        sid
    } else {
        let strategy = strategy_template::Entity::find()
            .order_by_desc(strategy_template::Column::IsDefault)
            .order_by_asc(strategy_template::Column::Id)
            .one(db)
            .await?
            .ok_or("未找到策略模板")?;
        strategy.id
    };

    let materials = material::Entity::find().count(db).await? as usize;
    Ok((plan.id, strategy_id, materials))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let args: Vec<String> = std::env::args().collect();
    let db_path = parse_string_arg(&args, "--db", "/tmp/spm_scheduler_bench.db");
    let materials = parse_usize_arg(&args, "--materials", 10_000).max(100);
    let days = parse_usize_arg(&args, "--days", 7).max(1);
    let runs = parse_usize_arg(&args, "--runs", 3).max(1);
    let forced_strategy_id = parse_i32_arg(&args, "--strategy-id", 0);
    let replay_plan_id = parse_i32_arg(&args, "--plan-id", 0);
    let db_url = if db_path.starts_with("sqlite:") {
        db_path
    } else {
        format!("sqlite:{}?mode=rwc", db_path)
    };

    println!("== 调度压测开始 ==");
    println!(
        "db_url={}, materials={}, days={}, runs={}",
        db_url, materials, days, runs
    );

    init_database_for_cli(&db_url).await?;
    let (plan_id, strategy_id, effective_materials) = if replay_plan_id > 0 {
        resolve_existing_plan_strategy(replay_plan_id, forced_strategy_id).await?
    } else {
        let (pid, sid) = reset_and_seed_data(materials, days).await?;
        (pid, sid, materials)
    };
    if replay_plan_id > 0 {
        println!(
            "回放模式: plan_id={}, strategy_id={}, materials={} (使用现有库数据)",
            plan_id, strategy_id, effective_materials
        );
    } else {
        println!(
            "seed完成: plan_id={}, strategy_id={}, materials={}",
            plan_id, strategy_id, effective_materials
        );
    }

    let scenarios = vec![
        Scenario {
            name: "A_greedy",
            mode: "greedy",
            beam_width: 1,
            beam_lookahead: 1,
            beam_top_k: 1,
            time_budget_ms: 1_000,
            max_nodes: 1_000,
            fallback_enabled: true,
        },
        Scenario {
            name: "B_hybrid_default",
            mode: "hybrid",
            beam_width: 10,
            beam_lookahead: 3,
            beam_top_k: 40,
            time_budget_ms: 120_000,
            max_nodes: 200_000,
            fallback_enabled: true,
        },
        Scenario {
            name: "B_hybrid_tuned",
            mode: "hybrid",
            beam_width: 12,
            beam_lookahead: 3,
            beam_top_k: 60,
            time_budget_ms: 90_000,
            max_nodes: 300_000,
            fallback_enabled: true,
        },
        Scenario {
            name: "C_beam_only",
            mode: "beam",
            beam_width: 16,
            beam_lookahead: 4,
            beam_top_k: 80,
            time_budget_ms: 300_000,
            max_nodes: 800_000,
            fallback_enabled: false,
        },
    ];

    let mut scenario_results: Vec<(String, Vec<RunRecord>)> = Vec::new();

    for scenario in &scenarios {
        apply_scheduler_scenario(scenario).await?;
        let mut records: Vec<RunRecord> = Vec::with_capacity(runs);

        for run_idx in 0..runs {
            let t0 = Instant::now();
            let output = scheduler::auto_schedule(plan_id, strategy_id).await?;
            let elapsed_ms = t0.elapsed().as_secs_f64() * 1000.0;
            let gap = analyze_schedule_idle_gaps(plan_id, Some(30)).await?;

            println!(
                "[{}][run={}] elapsed={:.1}ms total_count={} max_gap={}m over_gap={}",
                scenario.name,
                run_idx + 1,
                elapsed_ms,
                output.total_count,
                gap.max_gap_minutes,
                gap.over_threshold_count
            );

            records.push(RunRecord {
                ms: elapsed_ms,
                total_count: output.total_count,
                over_gap_count: gap.over_threshold_count,
                max_gap_minutes: gap.max_gap_minutes,
            });
        }

        scenario_results.push((scenario.name.to_string(), records));
    }

    println!("\n== 压测汇总 ==");
    println!("scenario,avg_ms,p95_ms,min_ms,max_ms,avg_count,avg_over_gap,max_gap");
    for (name, records) in &scenario_results {
        let times: Vec<f64> = records.iter().map(|r| r.ms).collect();
        let (avg, p95, min, max) = summarize(&times);
        let avg_count =
            records.iter().map(|r| r.total_count as f64).sum::<f64>() / records.len() as f64;
        let avg_over_gap =
            records.iter().map(|r| r.over_gap_count as f64).sum::<f64>() / records.len() as f64;
        let max_gap = records.iter().map(|r| r.max_gap_minutes).max().unwrap_or(0);
        println!(
            "{},{:.1},{:.1},{:.1},{:.1},{:.1},{:.2},{}",
            name, avg, p95, min, max, avg_count, avg_over_gap, max_gap
        );
    }

    let mut hybrid_best_count = 0.0f64;
    for (name, records) in &scenario_results {
        if !name.starts_with("B_") {
            continue;
        }
        let avg_count =
            records.iter().map(|r| r.total_count as f64).sum::<f64>() / records.len() as f64;
        hybrid_best_count = hybrid_best_count.max(avg_count);
    }
    let mut recommended: Option<(String, f64)> = None;
    for (name, records) in &scenario_results {
        if !name.starts_with("B_") {
            continue;
        }
        let avg_count =
            records.iter().map(|r| r.total_count as f64).sum::<f64>() / records.len() as f64;
        if hybrid_best_count > 0.0 && avg_count < hybrid_best_count * 0.995 {
            continue;
        }
        let avg_ms = records.iter().map(|r| r.ms).sum::<f64>() / records.len() as f64;
        match &recommended {
            Some((_, best_ms)) if avg_ms >= *best_ms => {}
            _ => recommended = Some((name.clone(), avg_ms)),
        }
    }
    if let Some((name, avg_ms)) = recommended {
        println!(
            "\n建议参数: {} (在混合方案中满足排入量约束且平均耗时最短, avg_ms={:.1})",
            name, avg_ms
        );
    }

    println!("== 调度压测结束 ==");
    Ok(())
}

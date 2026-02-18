-- 材料主数据表
CREATE TABLE IF NOT EXISTS material (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    coil_id         TEXT NOT NULL UNIQUE,
    contract_no     TEXT,
    customer_name   TEXT,
    customer_code   TEXT,
    steel_grade     TEXT NOT NULL,
    thickness       REAL NOT NULL,
    width           REAL NOT NULL,
    weight          REAL NOT NULL,
    hardness_level  TEXT,
    surface_level   TEXT,
    roughness_req   TEXT,
    elongation_req  REAL,
    product_type    TEXT,
    contract_attr   TEXT,
    contract_nature TEXT,
    export_flag     BOOLEAN DEFAULT 0,
    weekly_delivery BOOLEAN DEFAULT 0,
    batch_code      TEXT,
    coiling_time    DATETIME NOT NULL,
    temp_status     TEXT DEFAULT 'waiting',
    temp_wait_days  INTEGER DEFAULT 0,
    is_tempered     BOOLEAN DEFAULT 0,
    tempered_at     DATETIME,
    storage_days    INTEGER DEFAULT 0,
    storage_loc     TEXT,
    due_date        DATETIME,
    status          TEXT DEFAULT 'pending',
    priority_auto   INTEGER DEFAULT 0,
    priority_manual_adjust INTEGER DEFAULT 0,
    priority_final  INTEGER DEFAULT 0,
    priority_detail TEXT,
    priority_reason TEXT,
    remarks         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_material_status ON material(status);
CREATE INDEX IF NOT EXISTS idx_material_temp_status ON material(temp_status);
CREATE INDEX IF NOT EXISTS idx_material_is_tempered ON material(is_tempered);
CREATE INDEX IF NOT EXISTS idx_material_width ON material(width);
CREATE INDEX IF NOT EXISTS idx_material_coiling_time ON material(coiling_time);
CREATE INDEX IF NOT EXISTS idx_material_due_date ON material(due_date);
CREATE INDEX IF NOT EXISTS idx_material_customer_code ON material(customer_code);
CREATE INDEX IF NOT EXISTS idx_material_batch_code ON material(batch_code);
CREATE INDEX IF NOT EXISTS idx_material_composite ON material(status, is_tempered, width);

-- 性能监控指标表
CREATE TABLE IF NOT EXISTS performance_metrics (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_type     TEXT NOT NULL,
    metric_name     TEXT NOT NULL,
    value           REAL NOT NULL,
    unit            TEXT NOT NULL,
    metadata        TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_perf_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_perf_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_perf_created ON performance_metrics(created_at);
CREATE INDEX IF NOT EXISTS idx_perf_composite ON performance_metrics(metric_type, metric_name, created_at);

-- 错误日志表
CREATE TABLE IF NOT EXISTS error_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    error_type      TEXT NOT NULL,
    severity        TEXT NOT NULL,
    message         TEXT NOT NULL,
    stack_trace     TEXT,
    context         TEXT,
    user_agent      TEXT,
    url             TEXT,
    fingerprint     TEXT NOT NULL,
    count           INTEGER DEFAULT 1,
    first_seen      DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen       DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved        BOOLEAN DEFAULT 0,
    resolved_at     DATETIME
);

CREATE INDEX IF NOT EXISTS idx_error_type ON error_logs(error_type);
CREATE INDEX IF NOT EXISTS idx_error_severity ON error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_error_fingerprint ON error_logs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_resolved ON error_logs(resolved);
CREATE INDEX IF NOT EXISTS idx_error_last_seen ON error_logs(last_seen);
CREATE INDEX IF NOT EXISTS idx_error_composite ON error_logs(error_type, severity, resolved, last_seen);

-- 排程方案表
CREATE TABLE IF NOT EXISTS schedule_plan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_no         TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    period_type     TEXT NOT NULL,
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    strategy_id     INTEGER,
    status          TEXT DEFAULT 'draft',
    version         INTEGER DEFAULT 1,
    parent_id       INTEGER,
    total_count     INTEGER DEFAULT 0,
    total_weight    REAL DEFAULT 0,
    roll_change_count INTEGER DEFAULT 0,
    score_overall   INTEGER,
    score_sequence  INTEGER,
    score_delivery  INTEGER,
    score_efficiency INTEGER,
    risk_count_high INTEGER DEFAULT 0,
    risk_count_medium INTEGER DEFAULT 0,
    risk_count_low  INTEGER DEFAULT 0,
    risk_summary    TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks         TEXT,
    FOREIGN KEY (strategy_id) REFERENCES strategy_template(id),
    FOREIGN KEY (parent_id) REFERENCES schedule_plan(id)
);

-- 排程明细表
CREATE TABLE IF NOT EXISTS schedule_item (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id         INTEGER NOT NULL,
    material_id     INTEGER NOT NULL,
    sequence        INTEGER NOT NULL,
    shift_date      DATE NOT NULL,
    shift_no        INTEGER NOT NULL,
    shift_type      TEXT NOT NULL,
    planned_start   DATETIME,
    planned_end     DATETIME,
    cumulative_weight REAL DEFAULT 0,
    is_roll_change  BOOLEAN DEFAULT 0,
    is_locked       BOOLEAN DEFAULT 0,
    lock_reason     TEXT,
    risk_flags      TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES schedule_plan(id) ON DELETE CASCADE,
    FOREIGN KEY (material_id) REFERENCES material(id),
    UNIQUE(plan_id, sequence)
);

CREATE INDEX IF NOT EXISTS idx_schedule_item_plan ON schedule_item(plan_id);
CREATE INDEX IF NOT EXISTS idx_schedule_item_plan_seq ON schedule_item(plan_id, sequence);
CREATE INDEX IF NOT EXISTS idx_schedule_item_shift ON schedule_item(shift_no);

-- 策略模板表
CREATE TABLE IF NOT EXISTS strategy_template (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    is_default      BOOLEAN DEFAULT 0,
    is_system       BOOLEAN DEFAULT 0,
    sort_weights    TEXT NOT NULL,
    constraints     TEXT NOT NULL,
    soft_constraints TEXT,
    eval_weights    TEXT NOT NULL,
    temper_rules    TEXT NOT NULL,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 字段映射配置表
CREATE TABLE IF NOT EXISTS field_mapping (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    template_name   TEXT NOT NULL,
    is_default      BOOLEAN DEFAULT 0,
    source_type     TEXT NOT NULL,
    mappings        TEXT NOT NULL,
    value_transforms TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 导出模板表
CREATE TABLE IF NOT EXISTS export_template (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    columns         TEXT NOT NULL,
    format_rules    TEXT,
    is_default      BOOLEAN DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    config_group    TEXT NOT NULL,
    config_key      TEXT NOT NULL,
    config_value    TEXT NOT NULL,
    value_type      TEXT NOT NULL,
    description     TEXT,
    is_editable     BOOLEAN DEFAULT 1,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(config_group, config_key)
);

-- 检修计划表
CREATE TABLE IF NOT EXISTS maintenance_plan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    start_time      DATETIME NOT NULL,
    end_time        DATETIME NOT NULL,
    maintenance_type TEXT NOT NULL,
    recurrence      TEXT,
    is_active       BOOLEAN DEFAULT 1,
    description     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 操作日志表
CREATE TABLE IF NOT EXISTS operation_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    log_type        TEXT NOT NULL,
    action          TEXT NOT NULL,
    target_type     TEXT,
    target_id       INTEGER,
    detail          TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_operation_log_time ON operation_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_log_type ON operation_log(log_type, created_at DESC);

-- 撤销栈表
CREATE TABLE IF NOT EXISTS undo_stack (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id         INTEGER NOT NULL,
    action_type     TEXT NOT NULL,
    before_state    TEXT NOT NULL,
    after_state     TEXT NOT NULL,
    is_undone       BOOLEAN DEFAULT 0,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plan_id) REFERENCES schedule_plan(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_undo_stack_plan ON undo_stack(plan_id, created_at);

-- 优先级维度配置表
CREATE TABLE IF NOT EXISTS priority_dimension_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension_type  TEXT NOT NULL,
    dimension_code  TEXT NOT NULL,
    dimension_name  TEXT NOT NULL,
    score           INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    rule_config     TEXT,
    description     TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dimension_type, dimension_code)
);

CREATE INDEX IF NOT EXISTS idx_priority_dimension_type ON priority_dimension_config(dimension_type, enabled);

-- 客户优先级配置表
CREATE TABLE IF NOT EXISTS customer_priority_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_code   TEXT NOT NULL UNIQUE,
    customer_name   TEXT NOT NULL,
    priority_level  TEXT NOT NULL DEFAULT 'normal',
    priority_score  INTEGER NOT NULL DEFAULT 50,
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    remarks         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_customer_priority_code ON customer_priority_config(customer_code, enabled);
CREATE INDEX IF NOT EXISTS idx_customer_priority_level ON customer_priority_config(priority_level);

-- 集批优先级配置表
CREATE TABLE IF NOT EXISTS batch_priority_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_code      TEXT NOT NULL UNIQUE,
    batch_name      TEXT NOT NULL,
    priority_type   TEXT NOT NULL DEFAULT 'normal',
    priority_score  INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    remarks         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_batch_priority_code ON batch_priority_config(batch_code, enabled);
CREATE INDEX IF NOT EXISTS idx_batch_priority_type ON batch_priority_config(priority_type);

-- 产品大类优先级配置表
CREATE TABLE IF NOT EXISTS product_type_priority_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    product_type    TEXT NOT NULL UNIQUE,
    product_name    TEXT NOT NULL,
    priority_level  TEXT NOT NULL DEFAULT 'normal',
    priority_score  INTEGER NOT NULL DEFAULT 0,
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    remarks         TEXT,
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_type_priority ON product_type_priority_config(product_type, enabled);
CREATE INDEX IF NOT EXISTS idx_product_type_level ON product_type_priority_config(priority_level);

-- 导入批次表
CREATE TABLE IF NOT EXISTS import_batch (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_no          TEXT    NOT NULL UNIQUE,
    file_name         TEXT    NOT NULL,
    total_count       INTEGER NOT NULL DEFAULT 0,
    success_count     INTEGER NOT NULL DEFAULT 0,
    failed_count      INTEGER NOT NULL DEFAULT 0,
    skipped_count     INTEGER NOT NULL DEFAULT 0,
    overwritten_count INTEGER NOT NULL DEFAULT 0,
    conflict_mode     TEXT    NOT NULL DEFAULT 'skip',
    status            TEXT    NOT NULL DEFAULT 'active',
    remarks           TEXT,
    created_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_import_batch_status ON import_batch(status);

-- material 表增量迁移：添加 import_batch_id 列
ALTER TABLE material ADD COLUMN import_batch_id INTEGER;

-- 优先级权重配置表
CREATE TABLE IF NOT EXISTS priority_weight_config (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    dimension_type  TEXT NOT NULL UNIQUE,
    dimension_name  TEXT NOT NULL,
    weight          REAL NOT NULL DEFAULT 1.0,
    enabled         BOOLEAN NOT NULL DEFAULT 1,
    sort_order      INTEGER DEFAULT 0,
    description     TEXT,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- schedule_plan 表增量迁移：添加 ignored_risks 列（风险忽略列表 JSON）
ALTER TABLE schedule_plan ADD COLUMN ignored_risks TEXT;

-- 数据迁移：清理遗留的 scheduled 状态（scheduled 不再是合法的材料全局状态）
UPDATE material SET status = 'pending' WHERE status = 'scheduled';

//! 引擎业务常量
//!
//! 将分散在各模块中的魔法数字集中到此处管理，
//! 便于理解业务规则和后续配置化。

// ─── 产能与节拍 ───

/// 默认班次产能上限（吨/班次）
pub const DEFAULT_SHIFT_CAPACITY: f64 = 1200.0;

/// 默认平均节拍（分钟/卷）
pub const DEFAULT_AVG_RHYTHM: f64 = 3.5;

/// 默认白班起始时间
pub const DEFAULT_DAY_START: &str = "08:00";

/// 默认白班结束时间
pub const DEFAULT_DAY_END: &str = "20:00";

/// 默认夜班起始时间
pub const DEFAULT_NIGHT_START: &str = "20:00";

// ─── 换辊参数 ───

/// 默认换辊吨位阈值（吨）
pub const DEFAULT_ROLL_TONNAGE_THRESHOLD: f64 = 800.0;

/// 默认换辊时长（分钟）
pub const DEFAULT_ROLL_CHANGE_DURATION: f64 = 30.0;

/// 默认换辊宽跳偏好阈值（mm）
pub const DEFAULT_ROLL_WIDTH_JUMP_THRESHOLD: f64 = 50.0;

/// 换辊点搜索范围（前后几个位置）
pub const ROLL_CHANGE_SEARCH_RANGE: usize = 3;

// ─── 约束阈值 ───

/// 默认宽度跳变上限（mm）
pub const DEFAULT_WIDTH_JUMP_LIMIT: f64 = 100.0;

/// 评估时宽度跳变计数阈值（mm）— 与 WIDTH_JUMP_LIMIT 保持一致
pub const EVAL_WIDTH_JUMP_THRESHOLD: f64 = 100.0;

// ─── 软约束默认值 ───

/// 钢种切换默认惩罚分
pub const DEFAULT_STEEL_GRADE_SWITCH_PENALTY: i32 = 10;

/// 厚度跳变默认阈值（mm）
pub const DEFAULT_THICKNESS_JUMP_THRESHOLD: f64 = 1.0;

/// 厚度跳变默认惩罚分
pub const DEFAULT_THICKNESS_JUMP_PENALTY: i32 = 5;

/// 换辊后表面奖励默认分数
pub const DEFAULT_SURFACE_BONUS: i32 = 20;

/// 换辊后高表面检查卷数
pub const DEFAULT_SURFACE_WITHIN_COILS: i32 = 5;

/// 合同分组默认奖励分
pub const DEFAULT_CONTRACT_GROUPING_BONUS: i32 = 10;

// ─── 优先级阈值 ───

/// 双倍逾期天数阈值
pub const OVERDUE_DOUBLE_THRESHOLD_DAYS: i64 = 60;

/// 超级逾期天数阈值
pub const OVERDUE_SUPER_THRESHOLD_DAYS: i64 = 30;

/// D+7 紧急天数阈值
pub const DELIVERY_D7_THRESHOLD_DAYS: i64 = 7;

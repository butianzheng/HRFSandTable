/**
 * 共享排程相关常量
 * - 方案状态标签/颜色
 * - 约束标签
 * - 风险等级标签/颜色
 * - 交期分段标签/颜色
 * - 分数着色工具
 * - 交期属性代码 / 合同属性代码
 */

// ─── 方案状态 (draft / saved / confirmed / archived) ───
export const planStatusLabelMap: Record<string, string> = {
  draft: '草稿',
  saved: '已保存',
  confirmed: '已确认',
  archived: '已归档',
};
export const planStatusColorMap: Record<string, string> = {
  draft: 'default',
  saved: 'processing',
  confirmed: 'success',
  archived: 'warning',
};

// ─── 约束类型标签 ───
export const constraintLabelMap: Record<string, string> = {
  // 硬约束
  temp_status_filter: '适温状态',
  width_jump: '宽度跳跃',
  shift_capacity: '班次产能',
  overdue_priority: '逾期优先',
  roll_change_tonnage: '换辊吨位',
  roll_change_duration: '换辊时长',
  // 软约束
  steel_grade_switch: '钢种切换',
  thickness_jump: '厚度跳跃',
  surface_after_roll_change: '换辊后表面',
  contract_grouping: '合同集批',
  // 信息标记
  rolling_temp: '滚动适温',
};

// ─── 风险等级 ───
export const severityColorMap: Record<string, string> = {
  high: '#ff4d4f',
  medium: '#faad14',
  low: '#1677ff',
  info: '#8c8c8c',
};
export const severityLabelMap: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
  info: '提示',
};

// ─── 交期分段 ───
export type DueBucket = 'overdue' | 'in3' | 'in7' | 'later' | 'none';

export const dueBucketLabelMap: Record<DueBucket, string> = {
  overdue: '已超期',
  in3: '3天内',
  in7: '7天内',
  later: '7天后',
  none: '无交期',
};
export const dueBucketColorMap: Record<DueBucket, string> = {
  overdue: 'error',
  in3: 'warning',
  in7: 'gold',
  later: 'success',
  none: 'default',
};

// ─── 分数着色 ───
export const scoreColor = (v: number): string =>
  v >= 80 ? '#52c41a' : v >= 60 ? '#faad14' : '#ff4d4f';

// ─── 风险建议应用结果 ───
export const riskApplyReasonLabelMap: Record<string, string> = {
  empty_schedule: '排程为空',
  locked: '锁定不可调',
  already_top: '已在首位',
  at_head: '首位不可前移',
  not_found: '未在排程中',
  no_change: '无变化',
  already_optimal: '已是最优位置',
  smart_reposition: '智能重定位',
  safe_forward: '安全前移',
  moved_to_next_shift: '移至下一班次',
};

// ─── 交期属性代码 ───
export const deliveryCodeLabelMap: Record<string, string> = {
  'D+0': '交期:D+0',
  'D+7': '交期:D+7',
  super_overdue: '交期:超前欠',
  double_overdue: '交期:双前欠',
  overdue: '交期:前欠',
  current_period: '交期:本期',
  next_period: '交期:次月本期',
  no_requirement: '交期:无要求',
};

// ─── 合同属性代码 ───
export const contractCodeLabelMap: Record<string, string> = {
  export_contract: '合同:出口',
  futures_contract: '合同:期货',
  spot_contract: '合同:现货',
  transition_contract: '合同:过渡材',
  other: '合同:其他',
};

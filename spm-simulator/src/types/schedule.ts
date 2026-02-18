export interface SchedulePlan {
  id: number;
  plan_no: string;
  name: string;
  period_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  start_date: string;
  end_date: string;
  strategy_id?: number;
  status?: 'draft' | 'saved' | 'confirmed' | 'archived';
  version?: number;
  parent_id?: number;
  total_count?: number;
  total_weight?: number;
  roll_change_count?: number;
  score_overall?: number;
  score_sequence?: number;
  score_delivery?: number;
  score_efficiency?: number;
  risk_count_high?: number;
  risk_count_medium?: number;
  risk_count_low?: number;
  risk_summary?: string;
  created_at?: string;
  updated_at?: string;
  remarks?: string;
  ignored_risks?: string;
}

export interface ScheduleItem {
  id: number;
  plan_id: number;
  material_id: number;
  sequence: number;
  shift_date: string;
  shift_no: number;
  shift_type: 'day' | 'night';
  planned_start?: string;
  planned_end?: string;
  cumulative_weight?: number;
  is_roll_change?: boolean;
  is_locked?: boolean;
  lock_reason?: string;
  risk_flags?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePlanInput {
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  strategy_id?: number;
  parent_id?: number;
  remarks?: string;
}

export interface ScheduleResult {
  plan_id: number;
  total_count: number;
  total_weight: number;
  roll_change_count: number;
  score?: number;
  /** 滚动适温材料数量（期内待温→适温的材料） */
  future_ready_count?: number;
  /** 本次排程实际使用模式（beam/hybrid/greedy/none） */
  scheduler_mode_used?: 'beam' | 'hybrid' | 'greedy' | 'none' | string;
  /** 是否触发 Beam -> 贪心兜底 */
  fallback_triggered?: boolean;
}

export interface ScheduleIdleGapItem {
  shift_date: string;
  shift_type: string;
  prev_sequence: number;
  next_sequence: number;
  prev_end: string;
  next_start: string;
  gap_minutes: number;
}

export interface ScheduleIdleGapSummary {
  plan_id: number;
  threshold_minutes: number;
  total_checked_gaps: number;
  over_threshold_count: number;
  max_gap_minutes: number;
  avg_gap_minutes: number;
  items: ScheduleIdleGapItem[];
}

export interface Pagination {
  page: number;
  page_size: number;
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface UndoRedoResult {
  action_type: string;
  remaining: number;
}

// ─── Risk Analysis ───

export interface IgnoredRiskEntry {
  constraint_type: string;
  material_id: number;
}

export interface RiskAnalysis {
  plan_id: number;
  plan_name: string;
  score_overall: number;
  score_sequence: number;
  score_delivery: number;
  score_efficiency: number;
  total_count: number;
  total_weight: number;
  roll_change_count: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  violations: RiskViolationItem[];
  width_jumps: WidthJumpItem[];
  thickness_jumps?: ThicknessJumpItem[];
  shift_summary: ShiftSummary[];
  temp_distribution: TempDistribution;
  due_risk_distribution: DueRiskDistribution;
  overdue_count: number;
  steel_grade_switches: number;
  ignored_risks: IgnoredRiskEntry[];
}

export interface RiskViolationItem {
  constraint_type: string;
  severity: string;
  message: string;
  material_id: number;
  coil_id: string;
  sequence: number;
  due_date?: string;
  due_bucket?: 'overdue' | 'in3' | 'in7' | 'later' | 'none';
  ignored?: boolean;
}

export interface ApplyRiskSuggestionResult {
  risk_id: string;
  changed: boolean;
  reason_code: string;
  constraint_type: string;
  material_id: number;
  coil_id: string;
  sequence: number;
  action_note: string;
}

export interface WidthJumpItem {
  sequence: number;
  coil_id: string;
  prev_coil_id: string;
  width_diff: number;
  width: number;
  prev_width: number;
  is_roll_change_boundary?: boolean;
}

export interface ThicknessJumpItem {
  sequence: number;
  coil_id: string;
  prev_coil_id: string;
  thickness_diff: number;
  thickness: number;
  prev_thickness: number;
  is_roll_change_boundary?: boolean;
}

export interface ShiftSummary {
  shift_date: string;
  shift_type: string;
  count: number;
  weight: number;
  roll_changes: number;
}

export interface TempDistribution {
  ready: number;
  waiting: number;
  unknown: number;
}

export interface DueRiskDistribution {
  overdue: number;
  in3: number;
  in7: number;
  later: number;
}

export interface WaitingForecastItem {
  ready_date: string;
  count: number;
  total_weight: number;
}

export interface WaitingForecastDetailItem {
  material_id: number;
  coil_id: string;
  steel_grade: string;
  weight: number;
  temp_wait_days: number;
  ready_date: string;
  due_date?: string;
}

// ─── Plan Comparison ───

export interface PlanComparisonSide {
  plan_id: number;
  plan_name: string;
  plan_no: string;
  status: string;
  score_overall: number;
  score_sequence: number;
  score_delivery: number;
  score_efficiency: number;
  total_count: number;
  total_weight: number;
  roll_change_count: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  steel_grade_switches: number;
  created_at: string;
}

export interface PlanComparisonResult {
  plan_a: PlanComparisonSide;
  plan_b: PlanComparisonSide;
  common_count: number;
  only_a_count: number;
  only_b_count: number;
  common_coils: string[];
  only_a_coils: string[];
  only_b_coils: string[];
  sequence_changes: SequenceChangeItem[];
}

export interface SequenceChangeItem {
  coil_id: string;
  sequence_a: number;
  sequence_b: number;
  delta: number;
}

export interface PlanOverlapItem {
  plan_a_id: number;
  plan_b_id: number;
  common_count: number;
  only_a_count: number;
  only_b_count: number;
}

export interface MultiPlanComparisonResult {
  plans: PlanComparisonSide[];
  overlaps: PlanOverlapItem[];
}

// ─── Plan History ───

export interface PlanVersionItem {
  plan_id: number;
  plan_no: string;
  name: string;
  version: number;
  status: string;
  score_overall: number;
  total_count: number;
  total_weight: number;
  roll_change_count: number;
  risk_high: number;
  risk_medium: number;
  risk_low: number;
  created_at: string;
  updated_at: string;
}

export interface OperationLogEntry {
  id: number;
  log_type: string;
  action: string;
  target_type: string;
  target_id: number;
  detail: string;
  created_at: string;
}

export interface OperationLogFilter {
  target_type?: string;
  target_id?: number;
  log_type?: string;
  action?: string;
  start_time?: string;
  end_time?: string;
  limit?: number;
}

export interface OperationLogEstimate {
  count: number;
  cap: number;
  capped: boolean;
}

export interface CleanupEstimate {
  older_than_days: number;
  logs: number;
  history_plans: number;
  materials: number;
}

// ─── Export ───

export interface ExportTemplate {
  id: number;
  name: string;
  description?: string;
  columns: string;
  format_rules?: string;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExportTemplateInput {
  name: string;
  description?: string;
  columns: string;
  format_rules?: string;
  is_default?: boolean;
}

export interface UpdateExportTemplateInput {
  name?: string;
  description?: string;
  columns?: string;
  format_rules?: string;
  is_default?: boolean;
}

export interface ExportResult {
  row_count: number;
  file_path: string;
}

export interface MaterialStats {
  total: number;
  pending: number;
  frozen: number;
  completed: number;
  tempered: number;
  waiting: number;
}

export interface BackupFileInfo {
  file_name: string;
  file_path: string;
  file_size: number;
  created_at: string;
}

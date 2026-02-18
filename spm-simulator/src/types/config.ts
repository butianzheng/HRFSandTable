export interface StrategyTemplate {
  id: number;
  name: string;
  description?: string;
  is_default?: boolean;
  is_system?: boolean;
  sort_weights: string;
  constraints: string;
  soft_constraints?: string;
  eval_weights: string;
  temper_rules: string;
  created_at?: string;
  updated_at?: string;
}

export interface ConfigValue {
  value: string;
  value_type: string;
  description?: string;
}

export interface SystemConfig {
  [group: string]: {
    [key: string]: ConfigValue;
  };
}

export interface ShiftConfig {
  key: string;
  value: string;
}

export interface SortPriority {
  field: string;
  order: 'asc' | 'desc';
  weight: number;
  enabled: boolean;
  group: boolean;
  description: string;
  sort_map?: Record<string, number>;
  is_prerequisite?: boolean;
}

export interface HardConstraint {
  type: string;
  name: string;
  enabled: boolean;
  max_value?: number;
  value?: number;
  unit?: string;
  max_days?: number;
  finish_last_coil?: boolean;
  description?: string;
  error_message?: string;
}

export interface SoftConstraint {
  type: string;
  name: string;
  enabled: boolean;
  penalty?: number;
  bonus?: number;
  threshold?: number;
  unit?: string;
  target_levels?: string[];
  within_coils?: number;
}

export interface TemperRules {
  enabled: boolean;
  description: string;
  seasons: {
    [key: string]: {
      months: number[];
      min_days: number;
      description: string;
    };
  };
}

export interface MaintenancePlan {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  maintenance_type: string;
  recurrence?: string;
  is_active?: boolean;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CreateMaintenancePlanInput {
  title: string;
  start_time: string;
  end_time: string;
  maintenance_type: string;
  recurrence?: string;
  is_active?: boolean;
  description?: string;
}

export interface UpdateMaintenancePlanInput {
  title?: string;
  start_time?: string;
  end_time?: string;
  maintenance_type?: string;
  recurrence?: string;
  is_active?: boolean;
  description?: string;
}

export interface PriorityWeightConfig {
  id: number;
  dimension_type: string;
  dimension_name: string;
  weight: number;
  enabled: boolean;
  sort_order?: number;
  description?: string;
  updated_at?: string;
}

export interface PriorityWeightUpsertInput {
  dimension_type: string;
  dimension_name: string;
  weight: number;
  enabled: boolean;
  sort_order?: number;
  description?: string;
}

export interface PriorityDimensionConfig {
  id: number;
  dimension_type: string;
  dimension_code: string;
  dimension_name: string;
  score: number;
  enabled: boolean;
  sort_order?: number;
  rule_config?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PriorityDimensionUpsertInput {
  id?: number;
  dimension_type: string;
  dimension_code: string;
  dimension_name: string;
  score: number;
  enabled: boolean;
  sort_order?: number;
  rule_config?: string;
  description?: string;
}

export interface CustomerPriorityConfig {
  id: number;
  customer_code: string;
  customer_name: string;
  priority_level: string;
  priority_score: number;
  enabled: boolean;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface CustomerPriorityUpsertInput {
  id?: number;
  customer_code: string;
  customer_name: string;
  priority_level: string;
  priority_score: number;
  enabled: boolean;
  remarks?: string;
}

export interface BatchPriorityConfig {
  id: number;
  batch_code: string;
  batch_name: string;
  priority_type: string;
  priority_score: number;
  enabled: boolean;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface BatchPriorityUpsertInput {
  id?: number;
  batch_code: string;
  batch_name: string;
  priority_type: string;
  priority_score: number;
  enabled: boolean;
  remarks?: string;
}

export interface ProductTypePriorityConfig {
  id: number;
  product_type: string;
  product_name: string;
  priority_level: string;
  priority_score: number;
  enabled: boolean;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ProductTypePriorityUpsertInput {
  id?: number;
  product_type: string;
  product_name: string;
  priority_level: string;
  priority_score: number;
  enabled: boolean;
  remarks?: string;
}

export interface PriorityConfigImportResult {
  dry_run: boolean;
  total_rows: number;
  imported_weight: number;
  imported_dimension: number;
  imported_customer: number;
  imported_batch: number;
  imported_product_type: number;
  skipped_rows: number;
  warnings: string[];
}

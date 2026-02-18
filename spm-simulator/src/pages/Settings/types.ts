import type {
  PriorityWeightConfig,
  PriorityWeightUpsertInput,
  PriorityDimensionConfig,
  PriorityDimensionUpsertInput,
  CustomerPriorityConfig,
  CustomerPriorityUpsertInput,
  BatchPriorityConfig,
  BatchPriorityUpsertInput,
  ProductTypePriorityConfig,
  ProductTypePriorityUpsertInput,
} from '../../types/config';
import type { Dayjs } from 'dayjs';

/** 配置项分组定义 */
export interface ConfigFieldDef {
  key: string;
  label: string;
  type: 'number' | 'boolean' | 'string';
  unit?: string;
  description?: string;
  min?: number;
  max?: number;
  options?: Array<{ label: string; value: string }>;
  readOnly?: boolean;
  readOnlyHint?: string;
}

export const configGroups: Record<string, ConfigFieldDef[]> = {
  temp: [
    {
      key: 'enabled',
      label: '启用适温筛选',
      type: 'boolean',
      description: '关闭后所有材料视为适温',
    },
    { key: 'spring_months', label: '春季月份', type: 'string', description: '逗号分隔，如 3,4,5' },
    { key: 'summer_months', label: '夏季月份', type: 'string', description: '逗号分隔，如 6,7,8' },
    {
      key: 'autumn_months',
      label: '秋季月份',
      type: 'string',
      description: '逗号分隔，如 9,10,11',
    },
    { key: 'winter_months', label: '冬季月份', type: 'string', description: '逗号分隔，如 12,1,2' },
    { key: 'spring_days', label: '春季适温天数', type: 'number', unit: '天', min: 0, max: 30 },
    { key: 'summer_days', label: '夏季适温天数', type: 'number', unit: '天', min: 0, max: 30 },
    { key: 'autumn_days', label: '秋季适温天数', type: 'number', unit: '天', min: 0, max: 30 },
    { key: 'winter_days', label: '冬季适温天数', type: 'number', unit: '天', min: 0, max: 30 },
  ],
  capacity: [
    {
      key: 'shift_capacity',
      label: '单班产能上限',
      type: 'number',
      unit: '吨',
      min: 100,
      max: 5000,
      readOnly: true,
      readOnlyHint: '已归并到策略配置 > 硬约束（shift_capacity）维护',
    },
    { key: 'daily_target', label: '日产能目标', type: 'number', unit: '吨', min: 100, max: 10000 },
    {
      key: 'avg_rhythm',
      label: '平均轧制节奏',
      type: 'number',
      unit: '分钟/卷',
      min: 0.5,
      max: 30,
    },
  ],
  shift: [
    { key: 'day_start', label: '白班开始时间', type: 'string', description: '格式 HH:MM' },
    { key: 'day_end', label: '白班结束时间', type: 'string', description: '格式 HH:MM' },
    { key: 'night_start', label: '夜班开始时间', type: 'string', description: '格式 HH:MM' },
    { key: 'night_end', label: '夜班结束时间', type: 'string', description: '格式 HH:MM' },
  ],
  roll: [
    {
      key: 'tonnage_threshold',
      label: '换辊吨位阈值',
      type: 'number',
      unit: '吨',
      min: 100,
      max: 3000,
      readOnly: true,
      readOnlyHint: '已归并到策略配置 > 硬约束（roll_change_tonnage）维护',
    },
    {
      key: 'change_duration',
      label: '换辊作业时长',
      type: 'number',
      unit: '分钟',
      min: 5,
      max: 120,
      readOnly: true,
      readOnlyHint: '已归并到策略配置 > 硬约束（roll_change_duration）维护',
    },
    {
      key: 'finish_last_coil',
      label: '整卷收尾',
      type: 'boolean',
      description: '达到阈值后当前卷完成再换辊',
      readOnly: true,
      readOnlyHint: '已归并到策略配置 > 硬约束（roll_change_tonnage.finish_last_coil）维护',
    },
  ],
  scheduler: [
    {
      key: 'mode',
      label: '排程模式',
      type: 'string',
      description: 'hybrid=Beam主+贪心兜底，beam=仅Beam，greedy=仅贪心',
      options: [
        { label: '混合(hybrid)', value: 'hybrid' },
        { label: '仅Beam(beam)', value: 'beam' },
        { label: '仅贪心(greedy)', value: 'greedy' },
      ],
    },
    {
      key: 'beam_width',
      label: 'Beam宽度',
      type: 'number',
      unit: '条',
      min: 1,
      max: 64,
      description: '每轮保留路径数',
    },
    {
      key: 'beam_lookahead',
      label: '前瞻步数',
      type: 'number',
      unit: '步',
      min: 1,
      max: 8,
      description: '单次选点向前搜索深度',
    },
    {
      key: 'beam_top_k',
      label: '候选截断',
      type: 'number',
      unit: '条',
      min: 1,
      max: 500,
      description: '每步参与Beam扩展的候选上限',
    },
    {
      key: 'time_budget_ms',
      label: '求解预算',
      type: 'number',
      unit: 'ms',
      min: 1000,
      max: 900000,
      description: '超过预算将触发兜底',
    },
    {
      key: 'max_nodes',
      label: '节点上限',
      type: 'number',
      unit: '个',
      min: 1000,
      max: 5000000,
      description: 'Beam扩展节点总数上限',
    },
    {
      key: 'fallback_enabled',
      label: '启用兜底',
      type: 'boolean',
      description: 'Beam超时/超节点后切换贪心A',
    },
  ],
  constraint: [
    {
      key: 'max_width_jump',
      label: '最大宽度跳跃',
      type: 'number',
      unit: 'mm',
      min: 10,
      max: 500,
      readOnly: true,
      readOnlyHint: '已归并到策略配置 > 硬约束（width_jump）维护',
    },
    {
      key: 'max_thickness_jump',
      label: '最大厚度跳跃',
      type: 'number',
      unit: 'mm',
      min: 0.1,
      max: 10,
      readOnly: true,
      readOnlyHint: '已归并到策略配置 > 软约束（thickness_jump.threshold）维护',
    },
  ],
  warning: [
    { key: 'capacity_yellow', label: '产能黄灯阈值', type: 'number', unit: '%', min: 50, max: 100 },
    { key: 'capacity_red', label: '产能红灯阈值', type: 'number', unit: '%', min: 30, max: 100 },
    { key: 'due_warn_days', label: '交期预警天数', type: 'number', unit: '天', min: 1, max: 30 },
    {
      key: 'storage_warn_days',
      label: '库龄预警天数',
      type: 'number',
      unit: '天',
      min: 1,
      max: 60,
    },
    {
      key: 'storage_critical_days',
      label: '库龄严重预警',
      type: 'number',
      unit: '天',
      min: 1,
      max: 90,
    },
  ],
  undo: [{ key: 'max_steps', label: '最大撤销步数', type: 'number', unit: '步', min: 1, max: 500 }],
  backup: [
    {
      key: 'enabled',
      label: '启用自动备份',
      type: 'boolean',
      description: '应用启动时按周期自动创建备份',
    },
    {
      key: 'period',
      label: '自动备份周期',
      type: 'string',
      description: 'daily 或 weekly',
      options: [
        { label: '每日(daily)', value: 'daily' },
        { label: '每周(weekly)', value: 'weekly' },
      ],
    },
    { key: 'path', label: '备份路径', type: 'string', description: '留空则使用应用默认路径' },
    { key: 'keep_days', label: '保留天数', type: 'number', unit: '天', min: 0, max: 3650 },
  ],
};

export interface MaintenanceFormValues {
  title: string;
  time_range: [Dayjs, Dayjs];
  maintenance_type: string;
  recurrence?: string;
  is_active?: boolean;
  description?: string;
}

export interface PerfSummaryFile {
  generatedAt: string;
  budget: {
    maxTotalJsKB: number;
    maxLargestJsKB: number;
    maxChunksOver350KB: number;
  };
  stats: {
    totalJsKB: number;
    largestJsKB: number;
    chunkCount: number;
    chunksOver350KB: Array<{ name: string; kb: number }>;
    topChunks: Array<{ name: string; kb: number; bytes: number }>;
  };
  violations: string[];
}

export interface RouteRenderMetric {
  type: 'route-render';
  path: string;
  costMs: number;
  ts: number;
}

export interface RouteMetricRow {
  key: string;
  path: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  lastAt: string;
}

export interface RiskChipBenchmarkCase {
  key: string;
  label: string;
  size: number;
  sampleCount: number;
  avgMs: number;
  p95Ms: number;
  minMs: number;
  maxMs: number;
  entryCount: number;
}

export interface RiskChipBenchmarkFile {
  generatedAt: string;
  baseline: {
    source: string;
    generatedAt: string | null;
  } | null;
  cases: RiskChipBenchmarkCase[];
  regressions: string[];
  notes: string[];
}

export function calcP95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index];
}

export const maintenanceTypeLabelMap: Record<string, string> = {
  planned: '计划检修',
  routine: '例行保养',
  emergency: '紧急抢修',
};

export interface EditablePriorityWeightRow extends PriorityWeightUpsertInput {
  key: string;
}

export interface EditablePriorityDimensionRow extends PriorityDimensionUpsertInput {
  key: string;
}

export interface EditableCustomerPriorityRow extends CustomerPriorityUpsertInput {
  key: string;
}

export interface EditableBatchPriorityRow extends BatchPriorityUpsertInput {
  key: string;
}

export interface EditableProductTypePriorityRow extends ProductTypePriorityUpsertInput {
  key: string;
}

export const priorityDimensionTypeOptions = [
  { label: '交期属性', value: 'delivery' },
  { label: '合同属性', value: 'contract' },
];

export const customerPriorityLevelOptions = [
  { label: 'VIP', value: 'vip' },
  { label: '重点', value: 'key' },
  { label: '普通', value: 'normal' },
  { label: '黑名单', value: 'blacklist' },
];

export const batchPriorityTypeOptions = [
  { label: '紧急', value: 'urgent' },
  { label: '计划', value: 'planned' },
  { label: '普通', value: 'normal' },
];

export const productPriorityLevelOptions = [
  { label: '优先', value: 'priority' },
  { label: '常规', value: 'regular' },
  { label: '普通', value: 'normal' },
];

export const trimOptionalText = (value?: string): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const nextSortOrder = (rows: Array<{ sort_order?: number }>): number => {
  return rows.reduce((max, row) => Math.max(max, row.sort_order ?? 0), 0) + 1;
};

export const requireText = (value: string | undefined, label: string): string => {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) {
    throw new Error(`${label}不能为空`);
  }
  return trimmed;
};

export const mapPriorityWeightRows = (
  rows: PriorityWeightConfig[]
): EditablePriorityWeightRow[] => {
  return rows.map((item, index) => ({
    key: `weight-${item.id}`,
    dimension_type: item.dimension_type,
    dimension_name: item.dimension_name,
    weight: item.weight,
    enabled: item.enabled,
    sort_order: item.sort_order ?? index + 1,
    description: item.description,
  }));
};

export const mapPriorityDimensionRows = (
  rows: PriorityDimensionConfig[]
): EditablePriorityDimensionRow[] => {
  return rows.map((item, index) => ({
    key: `dimension-${item.id}`,
    id: item.id,
    dimension_type: item.dimension_type,
    dimension_code: item.dimension_code,
    dimension_name: item.dimension_name,
    score: item.score,
    enabled: item.enabled,
    sort_order: item.sort_order ?? index + 1,
    rule_config: item.rule_config,
    description: item.description,
  }));
};

export const mapCustomerPriorityRows = (
  rows: CustomerPriorityConfig[]
): EditableCustomerPriorityRow[] => {
  return rows.map((item) => ({
    key: `customer-${item.id}`,
    id: item.id,
    customer_code: item.customer_code,
    customer_name: item.customer_name,
    priority_level: item.priority_level,
    priority_score: item.priority_score,
    enabled: item.enabled,
    remarks: item.remarks,
  }));
};

export const mapBatchPriorityRows = (rows: BatchPriorityConfig[]): EditableBatchPriorityRow[] => {
  return rows.map((item) => ({
    key: `batch-${item.id}`,
    id: item.id,
    batch_code: item.batch_code,
    batch_name: item.batch_name,
    priority_type: item.priority_type,
    priority_score: item.priority_score,
    enabled: item.enabled,
    remarks: item.remarks,
  }));
};

export const mapProductPriorityRows = (
  rows: ProductTypePriorityConfig[]
): EditableProductTypePriorityRow[] => {
  return rows.map((item) => ({
    key: `product-${item.id}`,
    id: item.id,
    product_type: item.product_type,
    product_name: item.product_name,
    priority_level: item.priority_level,
    priority_score: item.priority_score,
    enabled: item.enabled,
    remarks: item.remarks,
  }));
};

export const weightDimensionLabelMap: Record<string, string> = {
  assessment: '合同考核',
  delivery: '交期属性',
  contract: '合同属性',
  customer: '客户优先级',
  batch: '集批优先级',
  product_type: '产品大类',
};

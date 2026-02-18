export interface FieldMapping {
  id: number;
  template_name: string;
  is_default?: boolean;
  source_type: string;
  mappings: string;
  value_transforms?: string;
  created_at?: string;
  updated_at?: string;
}

export interface FieldMappingItem {
  source_field: string;
  target_field: string;
  mapping_type: 'direct' | 'calculate' | 'transform' | 'date' | 'default' | 'combine';
  default_value?: string;
  transform_rule?: string;
  source_format?: string;
}

export interface ValueTransformRule {
  field: string;
  value_map?: Record<string, string>;
  data_type?: 'string' | 'number' | 'boolean' | 'date';
}

export interface CreateFieldMappingInput {
  template_name: string;
  source_type: string;
  mappings: string;
  value_transforms?: string;
  is_default?: boolean;
}

export interface UpdateFieldMappingInput {
  template_name?: string;
  source_type?: string;
  mappings?: string;
  value_transforms?: string;
  is_default?: boolean;
}

export interface FilePreviewResult {
  headers: string[];
  sample_rows: string[][];
  total_rows: number;
}

/** 系统内置的目标字段列表 */
export const TARGET_FIELDS = [
  { field: 'coil_id', label: '钢卷号', required: true },
  { field: 'contract_no', label: '合同号', required: false },
  { field: 'customer_name', label: '客户名称', required: false },
  { field: 'customer_code', label: '客户代码', required: false },
  { field: 'steel_grade', label: '钢种', required: true },
  { field: 'thickness', label: '厚度', required: true },
  { field: 'width', label: '宽度', required: true },
  { field: 'weight', label: '重量', required: true },
  { field: 'hardness_level', label: '硬度等级', required: false },
  { field: 'surface_level', label: '表面等级', required: false },
  { field: 'roughness_req', label: '粗糙度要求', required: false },
  { field: 'elongation_req', label: '延伸率要求', required: false },
  { field: 'product_type', label: '产品大类', required: false },
  { field: 'contract_attr', label: '合同属性', required: false },
  { field: 'contract_nature', label: '合同性质', required: false },
  { field: 'export_flag', label: '出口标志', required: false },
  { field: 'weekly_delivery', label: '周交期', required: false },
  { field: 'batch_code', label: '集批代码', required: false },
  { field: 'coiling_time', label: '卷取时间', required: true },
  { field: 'storage_days', label: '库龄', required: false },
  { field: 'storage_loc', label: '库位', required: false },
  { field: 'due_date', label: '交期', required: false },
  { field: 'remarks', label: '备注', required: false },
] as const;

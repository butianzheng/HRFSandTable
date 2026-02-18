export interface Material {
  id: number;
  coil_id: string;
  contract_no?: string;
  customer_name?: string;
  customer_code?: string;
  steel_grade: string;
  thickness: number;
  width: number;
  weight: number;
  hardness_level?: string;
  surface_level?: string;
  roughness_req?: string;
  elongation_req?: number;
  product_type?: string;
  contract_attr?: string;
  contract_nature?: string;
  export_flag?: boolean;
  weekly_delivery?: boolean;
  batch_code?: string;
  coiling_time: string;
  temp_status?: 'ready' | 'waiting';
  temp_wait_days?: number;
  is_tempered?: boolean;
  tempered_at?: string;
  storage_days?: number;
  storage_loc?: string;
  due_date?: string;
  status?: 'pending' | 'frozen';
  priority_auto?: number;
  priority_manual_adjust?: number;
  priority_final?: number;
  priority_detail?: string;
  priority_reason?: string;
  remarks?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MaterialFilter {
  status?: string;
  temp_status?: string;
  steel_grade?: string;
  width_min?: number;
  width_max?: number;
  thickness_min?: number;
  thickness_max?: number;
  keyword?: string;
}

export type ConflictMode = 'skip' | 'overwrite' | 'replace_all';

export interface ImportResult {
  batch_id: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  overwritten: number;
  errors: string[];
}

export interface ImportBatch {
  id: number;
  batch_no: string;
  file_name: string;
  total_count: number;
  success_count: number;
  failed_count: number;
  skipped_count: number;
  overwritten_count: number;
  conflict_mode: string;
  status: string | null;
  remarks: string | null;
  created_at: string | null;
}

export interface DeleteBatchResult {
  batch_id: number;
  deleted_materials: number;
  kept_materials: number;
}

export interface ReplaceResult {
  cleared_material_count: number;
  cleared_schedule_item_count: number;
  import: ImportResult;
}

export interface ImportTestRow {
  line_no: number;
  status: 'ok' | 'error';
  message: string;
}

export interface ImportTestResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
  rows: ImportTestRow[];
}

export interface RefreshResult {
  total: number;
  tempered: number;
  waiting: number;
}

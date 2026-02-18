import { invoke } from '@tauri-apps/api/core';
import type {
  Material,
  MaterialFilter,
  ImportResult,
  ImportTestResult,
  ImportBatch,
  DeleteBatchResult,
  ReplaceResult,
  RefreshResult,
} from '../types/material';
import type { PagedResult, Pagination } from '../types/schedule';

export const materialApi = {
  importMaterials: (filePath: string, mappingId?: number, conflictMode?: string) =>
    invoke<ImportResult>('import_materials', {
      filePath,
      mappingId: mappingId ?? null,
      conflictMode: conflictMode ?? null,
    }),

  testImportMaterials: (
    filePath: string,
    mappingId?: number,
    mappingsJson?: string,
    valueTransforms?: string,
    sampleLimit?: number
  ) =>
    invoke<ImportTestResult>('test_import_materials', {
      filePath,
      mappingId: mappingId ?? null,
      mappingsJson: mappingsJson ?? null,
      valueTransforms: valueTransforms ?? null,
      sampleLimit: sampleLimit ?? null,
    }),

  getMaterials: (filter?: MaterialFilter, pagination?: Pagination) =>
    invoke<PagedResult<Material>>('get_materials', {
      filter: filter ?? null,
      pagination: pagination ?? null,
    }),

  updateMaterialStatus: (ids: number[], status: string) =>
    invoke<number>('update_material_status', { ids, status }),

  updateMaterialPriority: (ids: number[], priority: number) =>
    invoke<number>('update_material_priority', { ids, priority }),

  refreshTemperStatus: () => invoke<RefreshResult>('refresh_temper_status'),

  deleteMaterials: (ids: number[]) => invoke<number>('delete_materials', { ids }),

  getImportBatches: () => invoke<ImportBatch[]>('get_import_batches'),

  deleteImportBatch: (batchId: number) =>
    invoke<DeleteBatchResult>('delete_import_batch', { batchId }),

  replaceAllMaterials: (filePath: string, mappingId?: number) =>
    invoke<ReplaceResult>('replace_all_materials', {
      filePath,
      mappingId: mappingId ?? null,
    }),
};

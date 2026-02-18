import { describe, it, expect, vi, beforeEach } from 'vitest';
import { materialApi } from './materialApi';
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
import type { PagedResult } from '../types/schedule';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('materialApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('importMaterials', () => {
    it('应该调用 import_materials 命令并传递 conflictMode', async () => {
      const mockResult: ImportResult = {
        batch_id: 1,
        total: 10,
        success: 10,
        failed: 0,
        skipped: 0,
        overwritten: 0,
        errors: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await materialApi.importMaterials('/path/to/file.xlsx', 1, 'overwrite');

      expect(invoke).toHaveBeenCalledWith('import_materials', {
        filePath: '/path/to/file.xlsx',
        mappingId: 1,
        conflictMode: 'overwrite',
      });
      expect(result).toEqual(mockResult);
    });

    it('应该在没有可选参数时传递 null', async () => {
      const mockResult: ImportResult = {
        batch_id: 1,
        total: 10,
        success: 10,
        failed: 0,
        skipped: 0,
        overwritten: 0,
        errors: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      await materialApi.importMaterials('/path/to/file.xlsx');

      expect(invoke).toHaveBeenCalledWith('import_materials', {
        filePath: '/path/to/file.xlsx',
        mappingId: null,
        conflictMode: null,
      });
    });
  });

  describe('testImportMaterials', () => {
    it('应该调用 test_import_materials 命令', async () => {
      const mockResult: ImportTestResult = {
        success: true,
        sample_count: 5,
        headers: ['col1', 'col2'],
        samples: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await materialApi.testImportMaterials('/path/to/file.xlsx', 1, '{}', '{}', 10);

      expect(invoke).toHaveBeenCalledWith('test_import_materials', {
        filePath: '/path/to/file.xlsx',
        mappingId: 1,
        mappingsJson: '{}',
        valueTransforms: '{}',
        sampleLimit: 10,
      });
      expect(result).toEqual(mockResult);
    });

    it('应该在没有可选参数时传递 null', async () => {
      const mockResult: ImportTestResult = {
        success: true,
        sample_count: 5,
        headers: [],
        samples: [],
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      await materialApi.testImportMaterials('/path/to/file.xlsx');

      expect(invoke).toHaveBeenCalledWith('test_import_materials', {
        filePath: '/path/to/file.xlsx',
        mappingId: null,
        mappingsJson: null,
        valueTransforms: null,
        sampleLimit: null,
      });
    });
  });

  describe('getMaterials', () => {
    it('应该调用 get_materials 命令', async () => {
      const mockResult: PagedResult<Material> = {
        items: [{ id: 1, material_no: 'M001' } as Material],
        total: 1,
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const filter: MaterialFilter = { status: 'pending' };
      const pagination = { page: 1, page_size: 50 };
      const result = await materialApi.getMaterials(filter, pagination);

      expect(invoke).toHaveBeenCalledWith('get_materials', {
        filter,
        pagination,
      });
      expect(result).toEqual(mockResult);
    });

    it('应该在没有参数时传递 null', async () => {
      const mockResult: PagedResult<Material> = { items: [], total: 0 };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      await materialApi.getMaterials();

      expect(invoke).toHaveBeenCalledWith('get_materials', {
        filter: null,
        pagination: null,
      });
    });
  });

  describe('updateMaterialStatus', () => {
    it('应该调用 update_material_status 命令', async () => {
      vi.mocked(invoke).mockResolvedValue(3);

      const result = await materialApi.updateMaterialStatus([1, 2, 3], 'frozen');

      expect(invoke).toHaveBeenCalledWith('update_material_status', {
        ids: [1, 2, 3],
        status: 'frozen',
      });
      expect(result).toBe(3);
    });
  });

  describe('updateMaterialPriority', () => {
    it('应该调用 update_material_priority 命令', async () => {
      vi.mocked(invoke).mockResolvedValue(2);

      const result = await materialApi.updateMaterialPriority([1, 2], 5);

      expect(invoke).toHaveBeenCalledWith('update_material_priority', {
        ids: [1, 2],
        priority: 5,
      });
      expect(result).toBe(2);
    });
  });

  describe('refreshTemperStatus', () => {
    it('应该调用 refresh_temper_status 命令', async () => {
      const mockResult: RefreshResult = { updated: 10 };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await materialApi.refreshTemperStatus();

      expect(invoke).toHaveBeenCalledWith('refresh_temper_status');
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteMaterials', () => {
    it('应该调用 delete_materials 命令', async () => {
      vi.mocked(invoke).mockResolvedValue(5);

      const result = await materialApi.deleteMaterials([1, 2, 3, 4, 5]);

      expect(invoke).toHaveBeenCalledWith('delete_materials', {
        ids: [1, 2, 3, 4, 5],
      });
      expect(result).toBe(5);
    });
  });

  describe('getImportBatches', () => {
    it('应该调用 get_import_batches 命令', async () => {
      const mockBatches: ImportBatch[] = [
        {
          id: 1,
          batch_no: 'IMP-20260216-001',
          file_name: 'test.xlsx',
          total_count: 10,
          success_count: 8,
          failed_count: 1,
          skipped_count: 1,
          overwritten_count: 0,
          conflict_mode: 'skip',
          status: 'active',
          remarks: null,
          created_at: '2026-02-16 10:00:00',
        },
      ];
      vi.mocked(invoke).mockResolvedValue(mockBatches);

      const result = await materialApi.getImportBatches();

      expect(invoke).toHaveBeenCalledWith('get_import_batches');
      expect(result).toEqual(mockBatches);
    });
  });

  describe('deleteImportBatch', () => {
    it('应该调用 delete_import_batch 命令', async () => {
      const mockResult: DeleteBatchResult = {
        batch_id: 1,
        deleted_materials: 8,
        kept_materials: 2,
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await materialApi.deleteImportBatch(1);

      expect(invoke).toHaveBeenCalledWith('delete_import_batch', { batchId: 1 });
      expect(result).toEqual(mockResult);
    });
  });

  describe('replaceAllMaterials', () => {
    it('应该调用 replace_all_materials 命令', async () => {
      const mockResult: ReplaceResult = {
        cleared_count: 50,
        import: {
          batch_id: 2,
          total: 30,
          success: 28,
          failed: 2,
          skipped: 0,
          overwritten: 0,
          errors: [],
        },
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await materialApi.replaceAllMaterials('/path/to/new.xlsx', 1);

      expect(invoke).toHaveBeenCalledWith('replace_all_materials', {
        filePath: '/path/to/new.xlsx',
        mappingId: 1,
      });
      expect(result).toEqual(mockResult);
    });

    it('应该在没有 mappingId 时传递 null', async () => {
      const mockResult: ReplaceResult = {
        cleared_count: 0,
        import: {
          batch_id: 3,
          total: 10,
          success: 10,
          failed: 0,
          skipped: 0,
          overwritten: 0,
          errors: [],
        },
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      await materialApi.replaceAllMaterials('/path/to/file.xlsx');

      expect(invoke).toHaveBeenCalledWith('replace_all_materials', {
        filePath: '/path/to/file.xlsx',
        mappingId: null,
      });
    });
  });
});

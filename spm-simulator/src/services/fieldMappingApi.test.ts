import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fieldMappingApi } from './fieldMappingApi';
import { invoke } from '@tauri-apps/api/core';
import type {
  FieldMapping,
  CreateFieldMappingInput,
  UpdateFieldMappingInput,
  FilePreviewResult,
} from '../types/fieldMapping';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('fieldMappingApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getFieldMappings', () => {
    it('应该调用 get_field_mappings 命令', async () => {
      const mockMappings: FieldMapping[] = [
        { id: 1, name: 'Mapping 1' } as FieldMapping,
        { id: 2, name: 'Mapping 2' } as FieldMapping,
      ];
      vi.mocked(invoke).mockResolvedValue(mockMappings);

      const result = await fieldMappingApi.getFieldMappings();

      expect(invoke).toHaveBeenCalledWith('get_field_mappings');
      expect(result).toEqual(mockMappings);
    });
  });

  describe('getFieldMapping', () => {
    it('应该调用 get_field_mapping 命令', async () => {
      const mockMapping: FieldMapping = { id: 1, name: 'Test Mapping' } as FieldMapping;
      vi.mocked(invoke).mockResolvedValue(mockMapping);

      const result = await fieldMappingApi.getFieldMapping(1);

      expect(invoke).toHaveBeenCalledWith('get_field_mapping', { id: 1 });
      expect(result).toEqual(mockMapping);
    });
  });

  describe('createFieldMapping', () => {
    it('应该调用 create_field_mapping 命令', async () => {
      const mockMapping: FieldMapping = { id: 1, name: 'New Mapping' } as FieldMapping;
      const input: CreateFieldMappingInput = {
        name: 'New Mapping',
        mappings: '{}',
      } as CreateFieldMappingInput;
      vi.mocked(invoke).mockResolvedValue(mockMapping);

      const result = await fieldMappingApi.createFieldMapping(input);

      expect(invoke).toHaveBeenCalledWith('create_field_mapping', { input });
      expect(result).toEqual(mockMapping);
    });
  });

  describe('updateFieldMapping', () => {
    it('应该调用 update_field_mapping 命令', async () => {
      const mockMapping: FieldMapping = { id: 1, name: 'Updated Mapping' } as FieldMapping;
      const input: UpdateFieldMappingInput = {
        name: 'Updated Mapping',
      } as UpdateFieldMappingInput;
      vi.mocked(invoke).mockResolvedValue(mockMapping);

      const result = await fieldMappingApi.updateFieldMapping(1, input);

      expect(invoke).toHaveBeenCalledWith('update_field_mapping', { id: 1, input });
      expect(result).toEqual(mockMapping);
    });
  });

  describe('deleteFieldMapping', () => {
    it('应该调用 delete_field_mapping 命令', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      await fieldMappingApi.deleteFieldMapping(1);

      expect(invoke).toHaveBeenCalledWith('delete_field_mapping', { id: 1 });
    });
  });

  describe('previewFileHeaders', () => {
    it('应该调用 preview_file_headers 命令', async () => {
      const mockResult: FilePreviewResult = {
        headers: ['col1', 'col2', 'col3'],
        sample_rows: [['val1', 'val2', 'val3']],
      };
      vi.mocked(invoke).mockResolvedValue(mockResult);

      const result = await fieldMappingApi.previewFileHeaders('/path/to/file.xlsx');

      expect(invoke).toHaveBeenCalledWith('preview_file_headers', {
        filePath: '/path/to/file.xlsx',
      });
      expect(result).toEqual(mockResult);
    });
  });
});

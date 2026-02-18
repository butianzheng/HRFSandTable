import { invoke } from '@tauri-apps/api/core';
import type {
  FieldMapping,
  CreateFieldMappingInput,
  UpdateFieldMappingInput,
  FilePreviewResult,
} from '../types/fieldMapping';

export const fieldMappingApi = {
  getFieldMappings: () => invoke<FieldMapping[]>('get_field_mappings'),

  getFieldMapping: (id: number) => invoke<FieldMapping>('get_field_mapping', { id }),

  createFieldMapping: (input: CreateFieldMappingInput) =>
    invoke<FieldMapping>('create_field_mapping', { input }),

  updateFieldMapping: (id: number, input: UpdateFieldMappingInput) =>
    invoke<FieldMapping>('update_field_mapping', { id, input }),

  deleteFieldMapping: (id: number) => invoke<void>('delete_field_mapping', { id }),

  previewFileHeaders: (filePath: string) =>
    invoke<FilePreviewResult>('preview_file_headers', { filePath }),
};

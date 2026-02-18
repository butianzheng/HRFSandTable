import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { open, save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { fieldMappingApi } from '../../services/fieldMappingApi';
import { materialApi } from '../../services/materialApi';
import FieldMapping from './index';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-fs', () => ({
  writeTextFile: vi.fn(),
}));

vi.mock('../../services/materialApi', () => ({
  materialApi: {
    testImportMaterials: vi.fn(),
  },
}));

vi.mock('../../services/fieldMappingApi', () => ({
  fieldMappingApi: {
    getFieldMappings: vi.fn(),
    getFieldMapping: vi.fn(),
    createFieldMapping: vi.fn(),
    updateFieldMapping: vi.fn(),
    deleteFieldMapping: vi.fn(),
    previewFileHeaders: vi.fn(),
  },
}));

const mockedFieldMappingApi = fieldMappingApi as unknown as Record<
  string,
  ReturnType<typeof vi.fn>
>;
const mockedOpen = open as unknown as ReturnType<typeof vi.fn>;
const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedWriteTextFile = writeTextFile as unknown as ReturnType<typeof vi.fn>;
const mockedMaterialApi = materialApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const TEST_TIMEOUT = 15000;
const itSlow = (name: string, fn: () => Promise<void>) => it(name, fn, TEST_TIMEOUT);

const mappings = [
  {
    id: 1,
    template_name: 'MES模板',
    source_type: 'excel',
    mappings: JSON.stringify([
      {
        source_field: '卷号',
        target_field: 'coil_id',
        mapping_type: 'direct',
      },
    ]),
    is_default: false,
    updated_at: '2026-02-13T10:00:00',
  },
];

describe('FieldMapping 模板管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFieldMappingApi.getFieldMappings.mockResolvedValue(mappings);
    mockedFieldMappingApi.createFieldMapping.mockResolvedValue({ id: 2 });
    mockedFieldMappingApi.updateFieldMapping.mockResolvedValue({});
    mockedFieldMappingApi.deleteFieldMapping.mockResolvedValue(undefined);
    mockedFieldMappingApi.previewFileHeaders.mockResolvedValue({
      headers: ['钢卷号', '钢种', '厚度', '宽度', '重量', '卷取时间'],
      sample_rows: [['C001', 'Q235', '2.5', '1250', '22.1', '2026-02-12 12:00:00']],
      total_rows: 1,
    });
    mockedOpen.mockResolvedValue('/tmp/material-import.xlsx');
    mockedSave.mockResolvedValue('/tmp/import-test.csv');
    mockedWriteTextFile.mockResolvedValue(undefined);
  });

  itSlow('happy path: 点击复制会创建副本模板', async () => {
    const user = userEvent.setup();
    render(<FieldMapping />);

    await user.click(await screen.findByText('复制'));

    await waitFor(() => {
      expect(mockedFieldMappingApi.createFieldMapping).toHaveBeenCalledWith({
        template_name: 'MES模板_副本',
        source_type: 'excel',
        mappings: mappings[0].mappings,
        value_transforms: undefined,
        is_default: false,
      });
    });
  });

  itSlow('fail path: 设为默认失败时会调用更新接口', async () => {
    const user = userEvent.setup();
    mockedFieldMappingApi.updateFieldMapping.mockRejectedValue(new Error('update failed'));
    render(<FieldMapping />);

    await user.click(await screen.findByText('设为默认'));

    await waitFor(() => {
      expect(mockedFieldMappingApi.updateFieldMapping).toHaveBeenCalledWith(1, {
        is_default: true,
      });
    });
  });

  itSlow('happy path: 测试导入（沙盒）会调用后端测试接口', async () => {
    const user = userEvent.setup();
    mockedMaterialApi.testImportMaterials.mockResolvedValue({
      total: 1,
      success: 1,
      failed: 0,
      errors: [],
      rows: [{ line_no: 2, status: 'ok', message: 'ok' }],
    });
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    await user.click(await screen.findByText('选择源文件并预览'));
    await waitFor(() => {
      expect(mockedFieldMappingApi.previewFileHeaders).toHaveBeenCalledWith(
        '/tmp/material-import.xlsx'
      );
    });
    await user.click(await screen.findByText('测试导入（沙盒）'));

    await waitFor(() => {
      expect(mockedMaterialApi.testImportMaterials).toHaveBeenCalledWith(
        '/tmp/material-import.xlsx',
        undefined,
        expect.any(String),
        expect.any(String),
        30
      );
    });
  });

  itSlow('fail path: 测试导入（沙盒）失败时页面仍可继续使用', async () => {
    const user = userEvent.setup();
    mockedMaterialApi.testImportMaterials.mockRejectedValue(new Error('sandbox failed'));
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    await user.click(await screen.findByText('选择源文件并预览'));
    await waitFor(() => {
      expect(mockedFieldMappingApi.previewFileHeaders).toHaveBeenCalledWith(
        '/tmp/material-import.xlsx'
      );
    });
    await user.click(await screen.findByText('测试导入（沙盒）'));

    await waitFor(() => {
      expect(mockedMaterialApi.testImportMaterials).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('数据映射配置')).toBeInTheDocument();
  });

  itSlow('happy path: 删除模板会调用删除接口', async () => {
    const user = userEvent.setup();
    render(<FieldMapping />);

    await user.click(await screen.findByText('删除'));
    await user.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedFieldMappingApi.deleteFieldMapping).toHaveBeenCalledWith(1);
    });
  });

  itSlow('happy path: 查看详情会展示映射字段信息', async () => {
    const user = userEvent.setup();
    render(<FieldMapping />);

    await user.click(await screen.findByText('详情'));

    expect(await screen.findByText('映射模板详情')).toBeInTheDocument();
    expect(screen.getByText('钢卷号 (coil_id)')).toBeInTheDocument();
  });

  itSlow('happy path: 新建保存会调用创建接口', async () => {
    const user = userEvent.setup();
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    const dialog = await screen.findByRole('dialog', { name: '新建映射模板' });
    await user.type(within(dialog).getByPlaceholderText('如：MES导出格式'), '新建模板A');
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedFieldMappingApi.createFieldMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          template_name: '新建模板A',
          source_type: 'excel',
          is_default: false,
        })
      );
    });
  });

  itSlow('happy path: 新建模板编辑默认值并删除映射行后仍可保存', async () => {
    const user = userEvent.setup();
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    const dialog = await screen.findByRole('dialog', { name: '新建映射模板' });
    await user.type(within(dialog).getByPlaceholderText('如：MES导出格式'), '默认值映射模板');

    const editableDashInputs = within(dialog)
      .getAllByPlaceholderText('-')
      .filter((input) => !(input as HTMLInputElement).disabled);
    if (editableDashInputs.length === 0) {
      throw new Error('默认值输入框未找到');
    }
    await user.type(editableDashInputs[0], 'N/A');

    await user.click(within(dialog).getByText('添加映射行'));
    const deleteButtons = within(dialog).getAllByRole('button', { name: '删除' });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedFieldMappingApi.createFieldMapping).toHaveBeenCalledWith(
        expect.objectContaining({
          template_name: '默认值映射模板',
          mappings: expect.stringContaining('"default_value":"N/A"'),
        })
      );
    });
  });

  itSlow('fail path: 未预览文件时自动匹配不会触发后端预览', async () => {
    const user = userEvent.setup();
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    const autoMatchButtonText = await screen.findByText('按表头自动匹配');
    const autoMatchButton = autoMatchButtonText.closest('button');

    expect(autoMatchButton).not.toBeNull();
    expect(autoMatchButton).toBeDisabled();
    expect(mockedFieldMappingApi.previewFileHeaders).not.toHaveBeenCalled();
    expect(screen.getByText('字段映射配置')).toBeInTheDocument();
  });

  itSlow('happy path: 测试结果导出CSV会写入文件', async () => {
    const user = userEvent.setup();
    mockedMaterialApi.testImportMaterials.mockResolvedValue({
      total: 2,
      success: 1,
      failed: 1,
      errors: ['第2行格式错误'],
      rows: [
        { line_no: 2, status: 'ok', message: 'ok' },
        { line_no: 3, status: 'failed', message: 'bad row' },
      ],
    });
    mockedSave.mockResolvedValueOnce('/tmp/import-result.csv');
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    await user.click(await screen.findByText('选择源文件并预览'));
    await user.click(await screen.findByText('测试导入（沙盒）'));
    await user.click(await screen.findByText('导出CSV'));

    await waitFor(() => {
      expect(mockedWriteTextFile).toHaveBeenCalledWith(
        '/tmp/import-result.csv',
        expect.stringContaining('总计')
      );
    });
  });

  itSlow('fail path: 导出测试结果取消时不会写入文件', async () => {
    const user = userEvent.setup();
    mockedMaterialApi.testImportMaterials.mockResolvedValue({
      total: 1,
      success: 1,
      failed: 0,
      errors: [],
      rows: [{ line_no: 2, status: 'ok', message: 'ok' }],
    });
    mockedSave.mockResolvedValueOnce(null);
    render(<FieldMapping />);

    await user.click(await screen.findByText('新建映射模板'));
    await user.click(await screen.findByText('选择源文件并预览'));
    await user.click(await screen.findByText('测试导入（沙盒）'));
    await user.click(await screen.findByText('导出CSV'));

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalled();
    });
    expect(mockedWriteTextFile).not.toHaveBeenCalled();
  });

  itSlow('fail path: 详情映射JSON异常时展示空数据且可关闭弹窗', async () => {
    const user = userEvent.setup();
    mockedFieldMappingApi.getFieldMappings.mockResolvedValueOnce([
      {
        ...mappings[0],
        mappings: 'invalid-json',
      },
    ]);
    render(<FieldMapping />);

    await user.click(await screen.findByText('详情'));
    const detailDialog = await screen.findByRole('dialog', { name: '映射模板详情' });
    expect(within(detailDialog).getAllByText(/No data|暂无数据/i).length).toBeGreaterThan(0);

    await user.click(within(detailDialog).getByRole('button', { name: 'Close' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '映射模板详情' })).not.toBeInTheDocument();
    });
  });
});

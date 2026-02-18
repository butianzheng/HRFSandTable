import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { open, save } from '@tauri-apps/plugin-dialog';
import { configApi } from '../../services/configApi';
import Settings from './index';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../services/configApi', () => ({
  configApi: {
    getSystemConfig: vi.fn(),
    getShiftConfig: vi.fn(),
    getMaintenancePlans: vi.fn(),
    updateShiftConfig: vi.fn(),
    updateSystemConfig: vi.fn(),
    updateMaintenancePlan: vi.fn(),
    createMaintenancePlan: vi.fn(),
    deleteMaintenancePlan: vi.fn(),
    getPriorityWeightConfigs: vi.fn(),
    getPriorityDimensionConfigs: vi.fn(),
    getCustomerPriorityConfigs: vi.fn(),
    getBatchPriorityConfigs: vi.fn(),
    getProductTypePriorityConfigs: vi.fn(),
    importPriorityConfigs: vi.fn(),
    exportPriorityConfigTemplateExcel: vi.fn(),
    exportPriorityConfigTemplateCsv: vi.fn(),
    exportPriorityConfigsExcel: vi.fn(),
    exportPriorityConfigsCsv: vi.fn(),
    upsertPriorityWeightConfigs: vi.fn(),
    upsertPriorityDimensionConfig: vi.fn(),
    upsertCustomerPriorityConfig: vi.fn(),
    upsertBatchPriorityConfig: vi.fn(),
    upsertProductTypePriorityConfig: vi.fn(),
    deletePriorityDimensionConfig: vi.fn(),
    deleteCustomerPriorityConfig: vi.fn(),
    deleteBatchPriorityConfig: vi.fn(),
    deleteProductTypePriorityConfig: vi.fn(),
  },
}));

const mockedOpen = open as unknown as ReturnType<typeof vi.fn>;
const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedConfigApi = configApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const TEST_TIMEOUT = 15000;
const itSlow = (name: string, fn: () => Promise<void>) => it(name, fn, TEST_TIMEOUT);

function renderSettings(initialUrl = '/settings?tab=priority') {
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </MemoryRouter>
  );
}

function getTabPanelBySuffix(suffix: string): HTMLElement {
  const panel = document.querySelector(`[id$="-panel-${suffix}"]`);
  if (!panel) {
    throw new Error(`未找到子面板: ${suffix}`);
  }
  return panel as HTMLElement;
}

function setupCommonMocks() {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', {
    getItem: vi.fn().mockReturnValue(null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    key: vi.fn().mockReturnValue(null),
    length: 0,
  });
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    })
  );
  mockedConfigApi.getSystemConfig.mockResolvedValue({});
  mockedConfigApi.getShiftConfig.mockResolvedValue([]);
  mockedConfigApi.getMaintenancePlans.mockResolvedValue([]);
  mockedConfigApi.getPriorityWeightConfigs.mockResolvedValue([]);
  mockedConfigApi.getPriorityDimensionConfigs.mockResolvedValue([]);
  mockedConfigApi.getCustomerPriorityConfigs.mockResolvedValue([]);
  mockedConfigApi.getBatchPriorityConfigs.mockResolvedValue([]);
  mockedConfigApi.getProductTypePriorityConfigs.mockResolvedValue([]);
  mockedOpen.mockResolvedValue('/tmp/priority-import.xlsx');
  mockedSave.mockResolvedValue('/tmp/priority-export.xlsx');
  mockedConfigApi.updateMaintenancePlan.mockResolvedValue({});
  mockedConfigApi.createMaintenancePlan.mockResolvedValue({});
  mockedConfigApi.deleteMaintenancePlan.mockResolvedValue({});
  mockedConfigApi.exportPriorityConfigTemplateExcel.mockResolvedValue(1);
  mockedConfigApi.exportPriorityConfigTemplateCsv.mockResolvedValue(1);
  mockedConfigApi.exportPriorityConfigsExcel.mockResolvedValue(1);
  mockedConfigApi.exportPriorityConfigsCsv.mockResolvedValue(1);
}

async function fillCreateMaintenanceDialog(
  dialog: HTMLElement,
  user: ReturnType<typeof userEvent.setup>
) {
  await user.type(within(dialog).getByPlaceholderText('如：2号机组月度检修'), '2号机组临时检修');
  const pickerInputs = Array.from(dialog.querySelectorAll('.ant-picker-input input'));
  if (pickerInputs.length < 2) {
    throw new Error('检修时间输入框未找到');
  }
  fireEvent.change(pickerInputs[0], { target: { value: '2026-02-14 01:00:00' } });
  fireEvent.keyDown(pickerInputs[0], { key: 'Enter', code: 'Enter' });
  fireEvent.blur(pickerInputs[0]);
  fireEvent.change(pickerInputs[1], { target: { value: '2026-02-14 03:00:00' } });
  fireEvent.keyDown(pickerInputs[1], { key: 'Enter', code: 'Enter' });
  fireEvent.blur(pickerInputs[1]);
  const typeInput = within(dialog).getByPlaceholderText('planned / routine / emergency');
  await user.clear(typeInput);
  await user.type(typeInput, 'routine');
}

describe('Settings 优先级配置导入', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  itSlow('happy path: 预检导入会调用导入接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.importPriorityConfigs.mockResolvedValue({
      dry_run: true,
      total_rows: 1,
      imported_weight: 1,
      imported_dimension: 0,
      imported_customer: 0,
      imported_batch: 0,
      imported_product_type: 0,
      skipped_rows: 0,
      warnings: [],
    });

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));

    await user.click(await screen.findByText('预检导入'));

    await waitFor(() => {
      expect(mockedConfigApi.importPriorityConfigs).toHaveBeenCalledWith(
        '/tmp/priority-import.xlsx',
        true
      );
    });
  });

  itSlow('fail path: 导入失败时不会中断页面交互', async () => {
    const user = userEvent.setup();
    mockedConfigApi.importPriorityConfigs.mockRejectedValue(new Error('import failed'));

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));
    await user.click(await screen.findByText('预检导入'));

    await waitFor(() => {
      expect(mockedConfigApi.importPriorityConfigs).toHaveBeenCalledWith(
        '/tmp/priority-import.xlsx',
        true
      );
    });
    expect(screen.getByText('优先级配置')).toBeInTheDocument();
  });

  itSlow('happy path: 执行导入会调用导入接口并刷新配置', async () => {
    const user = userEvent.setup();
    mockedConfigApi.importPriorityConfigs.mockResolvedValue({
      dry_run: false,
      total_rows: 1,
      imported_weight: 1,
      imported_dimension: 0,
      imported_customer: 0,
      imported_batch: 0,
      imported_product_type: 0,
      skipped_rows: 0,
      warnings: [],
    });

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));
    await user.click(await screen.findByText('执行导入'));

    await waitFor(() => {
      expect(mockedConfigApi.importPriorityConfigs).toHaveBeenCalledWith(
        '/tmp/priority-import.xlsx',
        false
      );
    });
    await waitFor(() => {
      expect(mockedConfigApi.getPriorityWeightConfigs.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  itSlow('fail path: 预检导入选择取消时不会调用导入接口', async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce(null);

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));
    await user.click(await screen.findByText('预检导入'));

    await waitFor(() => {
      expect(mockedConfigApi.importPriorityConfigs).not.toHaveBeenCalled();
    });
    expect(screen.getByText('优先级配置')).toBeInTheDocument();
  });

  itSlow('happy path: 模板与配置导出会调用对应接口', async () => {
    const user = userEvent.setup();
    mockedSave
      .mockResolvedValueOnce('/tmp/priority-template.xlsx')
      .mockResolvedValueOnce('/tmp/priority-template.csv')
      .mockResolvedValueOnce('/tmp/priority-config.xlsx')
      .mockResolvedValueOnce('/tmp/priority-config.csv');

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));
    await user.click(await screen.findByText('模板 Excel'));
    await user.click(await screen.findByText('模板 CSV'));
    await user.click(await screen.findByText('导出 Excel'));
    await user.click(await screen.findByText('导出 CSV'));

    await waitFor(() => {
      expect(mockedConfigApi.exportPriorityConfigTemplateExcel).toHaveBeenCalledWith(
        '/tmp/priority-template.xlsx'
      );
      expect(mockedConfigApi.exportPriorityConfigTemplateCsv).toHaveBeenCalledWith(
        '/tmp/priority-template.csv'
      );
      expect(mockedConfigApi.exportPriorityConfigsExcel).toHaveBeenCalledWith(
        '/tmp/priority-config.xlsx'
      );
      expect(mockedConfigApi.exportPriorityConfigsCsv).toHaveBeenCalledWith(
        '/tmp/priority-config.csv'
      );
    });
  });

  itSlow('fail path: 模板导出失败时会走失败分支', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce('/tmp/priority-template-fail.xlsx');
    mockedConfigApi.exportPriorityConfigTemplateExcel.mockRejectedValueOnce(
      new Error('template export failed')
    );

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));
    await user.click(await screen.findByText('模板 Excel'));

    await waitFor(() => {
      expect(mockedConfigApi.exportPriorityConfigTemplateExcel).toHaveBeenCalledWith(
        '/tmp/priority-template-fail.xlsx'
      );
    });
    expect(screen.getByText('优先级配置')).toBeInTheDocument();
  });

  itSlow('fail path: 配置导出失败时会走失败分支', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce('/tmp/priority-config-fail.csv');
    mockedConfigApi.exportPriorityConfigsCsv.mockRejectedValueOnce(
      new Error('config export failed')
    );

    renderSettings();
    await user.click(await screen.findByRole('tab', { name: '优先级配置' }));
    await user.click(await screen.findByText('导出 CSV'));

    await waitFor(() => {
      expect(mockedConfigApi.exportPriorityConfigsCsv).toHaveBeenCalledWith(
        '/tmp/priority-config-fail.csv'
      );
    });
    expect(screen.getByText('优先级配置')).toBeInTheDocument();
  });
});

describe('Settings 检修计划状态切换', () => {
  beforeEach(() => {
    setupCommonMocks();
    mockedConfigApi.getMaintenancePlans.mockResolvedValue([
      {
        id: 1,
        title: '1号机组例行检修',
        start_time: '2026-02-13T01:00:00.000Z',
        end_time: '2026-02-13T03:00:00.000Z',
        maintenance_type: 'planned',
        recurrence: '每周一',
        is_active: true,
        description: '原计划',
      },
    ]);
  });

  itSlow('happy path: 点击停用会调用更新接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.updateMaintenancePlan.mockResolvedValue({});

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('停用'));

    await waitFor(() => {
      expect(mockedConfigApi.updateMaintenancePlan).toHaveBeenCalledWith(1, { is_active: false });
    });
  });

  itSlow('happy path: 已停用计划点击启用会调用更新接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getMaintenancePlans.mockResolvedValueOnce([
      {
        id: 2,
        title: '2号机组检修',
        start_time: '2026-02-13T01:00:00.000Z',
        end_time: '2026-02-13T03:00:00.000Z',
        maintenance_type: 'planned',
        recurrence: '每周二',
        is_active: false,
        description: '停用计划',
      },
    ]);

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('启用'));

    await waitFor(() => {
      expect(mockedConfigApi.updateMaintenancePlan).toHaveBeenCalledWith(2, { is_active: true });
    });
  });

  itSlow('fail path: 切换状态失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedConfigApi.updateMaintenancePlan.mockRejectedValue(new Error('update failed'));

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('停用'));

    await waitFor(() => {
      expect(mockedConfigApi.updateMaintenancePlan).toHaveBeenCalledWith(1, { is_active: false });
    });
    expect(screen.getByText('新建检修计划')).toBeInTheDocument();
  });

  itSlow('happy path: 编辑检修计划后保存会调用更新接口', async () => {
    const user = userEvent.setup();

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('编辑'));

    const dialog = await screen.findByRole('dialog', { name: '编辑检修计划' });
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.updateMaintenancePlan).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          title: '1号机组例行检修',
          maintenance_type: 'planned',
        })
      );
    });
  });

  itSlow('happy path: 新建检修计划后保存会调用创建接口', async () => {
    const user = userEvent.setup();

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('新建检修计划'));

    const dialog = await screen.findByRole('dialog', { name: '新建检修计划' });
    await fillCreateMaintenanceDialog(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createMaintenancePlan).toHaveBeenCalledWith(
        expect.objectContaining({
          title: '2号机组临时检修',
          maintenance_type: 'routine',
          is_active: true,
        })
      );
    });
  });

  itSlow('fail path: 新建检修计划保存失败时页面保持可用', async () => {
    const user = userEvent.setup();
    mockedConfigApi.createMaintenancePlan.mockRejectedValueOnce(new Error('create failed'));

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('新建检修计划'));

    const dialog = await screen.findByRole('dialog', { name: '新建检修计划' });
    await fillCreateMaintenanceDialog(dialog, user);
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createMaintenancePlan).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('button', { name: '新建检修计划' })).toBeInTheDocument();
  });

  itSlow('happy path: 删除检修计划会调用删除接口', async () => {
    renderSettings('/settings?tab=maintenance');
    fireEvent.click(await screen.findByRole('tab', { name: '检修计划' }));
    const titleCell = await screen.findByText('1号机组例行检修');
    const row = titleCell.closest('tr');
    if (!row) {
      throw new Error('检修计划行未找到');
    }
    fireEvent.click(within(row).getByRole('button', { name: '删除' }));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteMaintenancePlan).toHaveBeenCalledWith(1);
    });
  });

  itSlow('fail path: 新建检修计划必填未填时不会调用创建接口', async () => {
    const user = userEvent.setup();

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('新建检修计划'));

    const dialog = await screen.findByRole('dialog', { name: '新建检修计划' });
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createMaintenancePlan).not.toHaveBeenCalled();
    });
    expect(screen.getByRole('dialog', { name: '新建检修计划' })).toBeInTheDocument();
  });

  itSlow('happy path: 新建检修计划点击取消会关闭并重置表单', async () => {
    const user = userEvent.setup();

    renderSettings('/settings?tab=maintenance');
    await user.click(await screen.findByRole('tab', { name: '检修计划' }));
    await user.click(await screen.findByText('新建检修计划'));

    const dialog = await screen.findByRole('dialog', { name: '新建检修计划' });
    await user.type(within(dialog).getByPlaceholderText('如：2号机组月度检修'), '待取消计划');
    await user.click(within(dialog).getByRole('button', { name: /取消|cancel/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '新建检修计划' })).not.toBeInTheDocument();
    });

    await user.click(await screen.findByText('新建检修计划'));
    const reopened = await screen.findByRole('dialog', { name: '新建检修计划' });
    const titleInput = within(reopened).getByPlaceholderText(
      '如：2号机组月度检修'
    ) as HTMLInputElement;
    expect(titleInput.value).toBe('');
    expect(mockedConfigApi.createMaintenancePlan).not.toHaveBeenCalled();
  });

  itSlow('fail path: 删除检修计划失败时页面仍可继续交互', async () => {
    mockedConfigApi.deleteMaintenancePlan.mockRejectedValueOnce(new Error('delete failed'));

    renderSettings('/settings?tab=maintenance');
    fireEvent.click(await screen.findByRole('tab', { name: '检修计划' }));
    const titleCell = await screen.findByText('1号机组例行检修');
    const row = titleCell.closest('tr');
    if (!row) {
      throw new Error('检修计划行未找到');
    }
    fireEvent.click(within(row).getByRole('button', { name: '删除' }));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteMaintenancePlan).toHaveBeenCalledWith(1);
    });
    expect(screen.getByRole('button', { name: '新建检修计划' })).toBeInTheDocument();
  });
});

describe('Settings 参数保存分支', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  itSlow('happy path: 适温参数保存会调用系统配置更新接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getSystemConfig.mockResolvedValue({
      temp: {
        enabled: { value: 'true', value_type: 'boolean' },
      },
    });

    renderSettings('/settings?tab=temp');
    await user.click(await screen.findByText('适温参数'));
    await user.click(await screen.findByText('保存配置'));

    await waitFor(() => {
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith('temp', 'enabled', 'true');
    });
  });

  itSlow('happy path: 调度算法应用B默认会一键持久化预设参数', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getSystemConfig.mockResolvedValue({
      scheduler: {
        mode: { value: 'hybrid', value_type: 'string' },
        beam_width: { value: '8', value_type: 'number' },
        beam_lookahead: { value: '2', value_type: 'number' },
        beam_top_k: { value: '30', value_type: 'number' },
        time_budget_ms: { value: '60000', value_type: 'number' },
        max_nodes: { value: '100000', value_type: 'number' },
        fallback_enabled: { value: 'true', value_type: 'boolean' },
      },
    });

    renderSettings('/settings?tab=scheduler');
    await user.click(await screen.findByText('调度算法'));
    const schedulerPanel = document.querySelector('[id$="-panel-scheduler"]');
    if (!schedulerPanel) {
      throw new Error('调度算法面板未找到');
    }
    await user.click(within(schedulerPanel as HTMLElement).getByRole('button', { name: '应用B默认' }));

    await waitFor(() => {
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledTimes(7);
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith('scheduler', 'mode', 'hybrid');
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'beam_width',
        '10'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'beam_lookahead',
        '3'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'beam_top_k',
        '40'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'time_budget_ms',
        '120000'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'max_nodes',
        '200000'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'fallback_enabled',
        'true'
      );
    });
  });

  itSlow('happy path: 调度算法应用B调优会一键持久化预设参数', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getSystemConfig.mockResolvedValue({
      scheduler: {
        mode: { value: 'hybrid', value_type: 'string' },
      },
    });

    renderSettings('/settings?tab=scheduler');
    await user.click(await screen.findByText('调度算法'));
    const schedulerPanel = document.querySelector('[id$="-panel-scheduler"]');
    if (!schedulerPanel) {
      throw new Error('调度算法面板未找到');
    }
    await user.click(within(schedulerPanel as HTMLElement).getByRole('button', { name: '应用B调优' }));

    await waitFor(() => {
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledTimes(7);
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith('scheduler', 'mode', 'hybrid');
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'beam_width',
        '12'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'beam_top_k',
        '60'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'time_budget_ms',
        '90000'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'max_nodes',
        '300000'
      );
      expect(mockedConfigApi.updateSystemConfig).toHaveBeenCalledWith(
        'scheduler',
        'fallback_enabled',
        'true'
      );
    });
  });

  itSlow('happy path: 班次设置保存会调用班次更新接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getSystemConfig.mockResolvedValue({ shift: {} });
    mockedConfigApi.getShiftConfig.mockResolvedValue([{ key: 'day_start', value: '08:00' }]);

    renderSettings('/settings?tab=shift');
    await user.click(await screen.findByText('班次设置'));
    const shiftPanel = document.querySelector('[id$="-panel-shift"]');
    if (!shiftPanel) {
      throw new Error('班次设置面板未找到');
    }
    await user.click(within(shiftPanel as HTMLElement).getByText('保存配置'));

    await waitFor(() => {
      expect(mockedConfigApi.updateShiftConfig).toHaveBeenCalledWith([
        { key: 'day_start', value: '08:00' },
      ]);
    });
  });

  itSlow('happy path: 设置中心刷新会重拉配置与检修计划', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=performance');

    await waitFor(() => {
      expect(mockedConfigApi.getSystemConfig).toHaveBeenCalledTimes(1);
      expect(mockedConfigApi.getMaintenancePlans).toHaveBeenCalledTimes(1);
    });

    const refreshButtons = await screen.findAllByRole('button', { name: /刷新/ });
    await user.click(refreshButtons[0]);

    await waitFor(() => {
      expect(mockedConfigApi.getSystemConfig.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockedConfigApi.getMaintenancePlans.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  itSlow('happy path: 性能验收成功渲染并支持清空路由指标', async () => {
    const user = userEvent.setup();
    const routeMetricsJson = JSON.stringify([
      { type: 'route-render', path: '/strategy', costMs: 15, ts: 1739494800000 },
      { type: 'route-render', path: '/strategy', costMs: 25, ts: 1739494801000 },
      { type: 'route-render', path: '/mapping', costMs: 35, ts: 1739494802000 },
      { type: 'other', path: '/invalid', costMs: 1, ts: 1 },
    ]);
    const localStorageGetItem = globalThis.localStorage.getItem as unknown as ReturnType<
      typeof vi.fn
    >;
    const localStorageRemoveItem = globalThis.localStorage.removeItem as unknown as ReturnType<
      typeof vi.fn
    >;
    localStorageGetItem.mockReturnValue(routeMetricsJson);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          generatedAt: '2026-02-14T00:00:00.000Z',
          violations: ['chunk 体积超预算'],
          stats: {
            totalJsKB: 100.12,
            largestJsKB: 20.12,
            chunkCount: 5,
            topChunks: [{ name: 'main.js', kb: 20.12, bytes: 20604 }],
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          generatedAt: '2026-02-14T00:00:00.000Z',
          regressions: ['S1 命中回归'],
          baseline: { source: 'baseline-v1' },
          cases: [
            {
              key: 'S1',
              label: '小样本',
              sampleCount: 10,
              avgMs: 1.123,
              p95Ms: 2.345,
              maxMs: 3.567,
              entryCount: 2,
            },
          ],
        }),
      })
      .mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    vi.stubGlobal('fetch', fetchMock);

    renderSettings('/settings?tab=performance');

    expect(await screen.findByText('预算告警 1')).toBeInTheDocument();
    expect(await screen.findByText('风险命中回归 1')).toBeInTheDocument();
    expect(await screen.findByText('/strategy')).toBeInTheDocument();
    expect(screen.getByText('路由渲染样本 3')).toBeInTheDocument();

    await user.click(screen.getByText('清空路由指标'));
    await waitFor(() => {
      expect(localStorageRemoveItem).toHaveBeenCalledWith('spm_perf_metrics');
      expect(screen.getByText('路由渲染样本 0')).toBeInTheDocument();
    });
  });
});

describe('Settings 优先级子面板保存删除', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  itSlow('happy path: 权重保存会调用批量保存接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getPriorityWeightConfigs.mockResolvedValue([
      {
        id: 1,
        dimension_type: 'assessment',
        dimension_name: '合同考核',
        weight: 0.6,
        enabled: true,
        sort_order: 1,
      },
    ]);
    mockedConfigApi.upsertPriorityWeightConfigs.mockResolvedValue([
      {
        id: 1,
        dimension_type: 'assessment',
        dimension_name: '合同考核',
        weight: 0.6,
        enabled: true,
        sort_order: 1,
      },
    ]);

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('保存权重'));

    await waitFor(() => {
      expect(mockedConfigApi.upsertPriorityWeightConfigs).toHaveBeenCalledWith([
        expect.objectContaining({
          dimension_type: 'assessment',
          dimension_name: '合同考核',
          weight: 0.6,
          enabled: true,
        }),
      ]);
    });
  });

  itSlow('happy path: 交期/合同维度保存会逐条调用保存接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getPriorityDimensionConfigs.mockResolvedValue([
      {
        id: 21,
        dimension_type: 'delivery',
        dimension_code: 'due_days',
        dimension_name: '交期偏差',
        score: 30,
        enabled: true,
        sort_order: 1,
        rule_config: '{"max_days":3}',
      },
    ]);
    mockedConfigApi.upsertPriorityDimensionConfig.mockResolvedValue({});

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('交期/合同维度'));
    await user.click(await screen.findByText('保存'));

    await waitFor(() => {
      expect(mockedConfigApi.upsertPriorityDimensionConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 21,
          dimension_type: 'delivery',
          dimension_code: 'due_days',
          dimension_name: '交期偏差',
        })
      );
    });
  });

  itSlow('happy path: 客户优先级保存会调用客户保存接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getCustomerPriorityConfigs.mockResolvedValue([
      {
        id: 31,
        customer_code: 'C001',
        customer_name: '测试客户',
        priority_level: 'vip',
        priority_score: 95,
        enabled: true,
      },
    ]);
    mockedConfigApi.upsertCustomerPriorityConfig.mockResolvedValue({});

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('客户优先级'));
    await user.click(await screen.findByText('保存'));

    await waitFor(() => {
      expect(mockedConfigApi.upsertCustomerPriorityConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 31,
          customer_code: 'C001',
          customer_name: '测试客户',
        })
      );
    });
  });

  itSlow('happy path: 集批优先级保存会调用集批保存接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getBatchPriorityConfigs.mockResolvedValue([
      {
        id: 41,
        batch_code: 'B001',
        batch_name: '测试集批',
        priority_type: 'urgent',
        priority_score: 90,
        enabled: true,
      },
    ]);
    mockedConfigApi.upsertBatchPriorityConfig.mockResolvedValue({});

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('集批优先级'));
    await user.click(await screen.findByText('保存'));

    await waitFor(() => {
      expect(mockedConfigApi.upsertBatchPriorityConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 41,
          batch_code: 'B001',
          batch_name: '测试集批',
        })
      );
    });
  });

  itSlow('happy path: 产品大类优先级保存会调用产品保存接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getProductTypePriorityConfigs.mockResolvedValue([
      {
        id: 51,
        product_type: 'P001',
        product_name: '测试产品',
        priority_level: 'priority',
        priority_score: 88,
        enabled: true,
      },
    ]);
    mockedConfigApi.upsertProductTypePriorityConfig.mockResolvedValue({});

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('产品大类优先级'));
    await user.click(await screen.findByText('保存'));

    await waitFor(() => {
      expect(mockedConfigApi.upsertProductTypePriorityConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 51,
          product_type: 'P001',
          product_name: '测试产品',
        })
      );
    });
  });

  it('happy path: 权重与维度编辑后保存会提交最新值', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getPriorityWeightConfigs.mockResolvedValue([
      {
        id: 11,
        dimension_type: 'assessment',
        dimension_name: '合同考核',
        weight: 0.6,
        enabled: true,
        sort_order: 1,
        description: '说明A',
      },
    ]);
    mockedConfigApi.getPriorityDimensionConfigs.mockResolvedValue([
      {
        id: 21,
        dimension_type: 'delivery',
        dimension_code: 'due_days',
        dimension_name: '交期偏差',
        score: 30,
        enabled: true,
        sort_order: 1,
        rule_config: '{"max_days":3}',
        description: '说明B',
      },
    ]);
    mockedConfigApi.upsertPriorityWeightConfigs.mockResolvedValue([]);
    mockedConfigApi.upsertPriorityDimensionConfig.mockResolvedValue({});

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));

    const weightPanel = getTabPanelBySuffix('weights');
    const weightNameInput = within(weightPanel).getByDisplayValue('合同考核');
    fireEvent.change(weightNameInput, { target: { value: '合同考核-新' } });
    const weightNumberInputs = within(weightPanel).getAllByRole('spinbutton');
    fireEvent.change(weightNumberInputs[0], { target: { value: '0.8' } });
    fireEvent.blur(weightNumberInputs[0]);
    fireEvent.change(weightNumberInputs[1], { target: { value: '2' } });
    fireEvent.blur(weightNumberInputs[1]);
    await user.click(within(weightPanel).getByRole('switch'));
    const weightDescInput = within(weightPanel).getByDisplayValue('说明A');
    fireEvent.change(weightDescInput, { target: { value: '说明A-新' } });
    await user.click(await screen.findByText('保存权重'));

    await waitFor(() => {
      expect(mockedConfigApi.upsertPriorityWeightConfigs).toHaveBeenCalledWith([
        expect.objectContaining({
          dimension_type: 'assessment',
          dimension_name: '合同考核-新',
          weight: 0.8,
          enabled: false,
          sort_order: 2,
          description: '说明A-新',
        }),
      ]);
    });

    await user.click(await screen.findByText('交期/合同维度'));
    const dimensionPanel = getTabPanelBySuffix('dimensions');
    const dimCodeInput = within(dimensionPanel).getByDisplayValue('due_days');
    fireEvent.change(dimCodeInput, { target: { value: 'due_days_v2' } });
    const dimNameInput = within(dimensionPanel).getByDisplayValue('交期偏差');
    fireEvent.change(dimNameInput, { target: { value: '交期偏差-新' } });
    const dimNumberInputs = within(dimensionPanel).getAllByRole('spinbutton');
    fireEvent.change(dimNumberInputs[0], { target: { value: '35' } });
    fireEvent.blur(dimNumberInputs[0]);
    fireEvent.change(dimNumberInputs[1], { target: { value: '2' } });
    fireEvent.blur(dimNumberInputs[1]);
    await user.click(within(dimensionPanel).getByRole('switch'));
    const dimRuleInput = within(dimensionPanel).getByDisplayValue('{"max_days":3}');
    fireEvent.change(dimRuleInput, { target: { value: '{"max_days":5}' } });
    const dimDescInput = within(dimensionPanel).getByDisplayValue('说明B');
    fireEvent.change(dimDescInput, { target: { value: '说明B-新' } });
    await user.click(within(dimensionPanel).getByRole('button', { name: /保存/ }));

    await waitFor(() => {
      expect(mockedConfigApi.upsertPriorityDimensionConfig).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 21,
          dimension_code: 'due_days_v2',
          dimension_name: '交期偏差-新',
          score: 35,
          enabled: false,
          sort_order: 2,
          rule_config: '{"max_days":5}',
          description: '说明B-新',
        })
      );
    });
  }, 30000);

  it('happy path: 客户优先级新增后删除未落库行', async () => {
    const user = userEvent.setup();

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));

    await user.click(await screen.findByText('客户优先级'));
    const customerPanel = getTabPanelBySuffix('customers');
    await user.click(within(customerPanel).getByRole('button', { name: /新增/ }));
    fireEvent.change(within(customerPanel).getAllByRole('textbox')[0], {
      target: { value: 'C_TMP' },
    });
    const customerDeleteButtons = within(customerPanel).getAllByRole('button', { name: '删除' });
    await user.click(customerDeleteButtons[customerDeleteButtons.length - 1]);
    await user.click(await screen.findByRole('button', { name: /确定|ok/i }));
    expect(mockedConfigApi.deleteCustomerPriorityConfig).not.toHaveBeenCalled();
  }, 30000);

  it('happy path: 删除已落库客户优先级行会调用后端删除接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getCustomerPriorityConfigs.mockResolvedValue([
      {
        id: 61,
        customer_code: 'K001',
        customer_name: '客户A',
        priority_level: 'vip',
        priority_score: 92,
        enabled: true,
      },
    ]);

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('客户优先级'));
    const customerPanel = document.querySelector('[id$="-panel-customers"]');
    if (!customerPanel) {
      throw new Error('客户优先级面板未找到');
    }
    await user.click(within(customerPanel as HTMLElement).getByText('删除'));
    await user.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteCustomerPriorityConfig).toHaveBeenCalledWith(61);
    });
  }, 30000);

  it('happy path: 删除已落库集批优先级行会调用后端删除接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getBatchPriorityConfigs.mockResolvedValue([
      {
        id: 71,
        batch_code: 'B001',
        batch_name: '集批A',
        priority_type: 'urgent',
        priority_score: 90,
        enabled: true,
      },
    ]);

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('集批优先级'));
    const batchPanel = document.querySelector('[id$="-panel-batches"]');
    if (!batchPanel) {
      throw new Error('集批优先级面板未找到');
    }
    await user.click(within(batchPanel as HTMLElement).getByText('删除'));
    await user.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteBatchPriorityConfig).toHaveBeenCalledWith(71);
    });
  }, 30000);

  it('happy path: 删除已落库产品大类优先级行会调用后端删除接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getProductTypePriorityConfigs.mockResolvedValue([
      {
        id: 81,
        product_type: 'P001',
        product_name: '产品A',
        priority_level: 'priority',
        priority_score: 88,
        enabled: true,
      },
    ]);

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('产品大类优先级'));
    const productPanel = document.querySelector('[id$="-panel-products"]');
    if (!productPanel) {
      throw new Error('产品大类优先级面板未找到');
    }
    await user.click(within(productPanel as HTMLElement).getByText('删除'));
    await user.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteProductTypePriorityConfig).toHaveBeenCalledWith(81);
    });
  }, 30000);

  it('happy path: 删除未落库维度行不会调用后端删除接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getPriorityDimensionConfigs.mockResolvedValue([]);

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('交期/合同维度'));
    await user.click(await screen.findByText('新增'));
    await user.click(await screen.findByText('删除'));
    await user.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deletePriorityDimensionConfig).not.toHaveBeenCalled();
    });
  }, 30000);

  it('happy path: 删除已落库维度行会调用后端删除接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getPriorityDimensionConfigs.mockResolvedValue([
      {
        id: 21,
        dimension_type: 'delivery',
        dimension_code: 'due_days',
        dimension_name: '交期偏差',
        score: 30,
        enabled: true,
        sort_order: 1,
      },
    ]);

    renderSettings('/settings?tab=priority');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('交期/合同维度'));
    await user.click(await screen.findByText('删除'));
    await user.click(await screen.findByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deletePriorityDimensionConfig).toHaveBeenCalledWith(21);
    });
  }, 30000);
});

describe('Settings 导航与定位', () => {
  beforeEach(() => {
    setupCommonMocks();
  });

  itSlow('happy path: 主标签切换会更新当前面板内容', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?tab=temp');

    await user.click(await screen.findByRole('tab', { name: '检修计划' }));

    expect(await screen.findByText('新建检修计划')).toBeInTheDocument();
  });

  itSlow('happy path: 清除优先级定位后提示消失且保持优先级标签', async () => {
    const user = userEvent.setup();
    renderSettings('/settings?priorityKey=delivery:due_days');

    expect(await screen.findByText('已定位配置项：delivery:due_days')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清除定位' }));

    await waitFor(() => {
      expect(screen.queryByText('已定位配置项：delivery:due_days')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('tab', { name: '优先级配置' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  itSlow('happy path: customer default 定位会隐藏客户列表', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getCustomerPriorityConfigs.mockResolvedValue([
      {
        id: 31,
        customer_code: 'C001',
        customer_name: '客户A',
        priority_level: 'vip',
        priority_score: 95,
        enabled: true,
      },
    ]);

    renderSettings('/settings?priorityKey=customer:default');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('客户优先级'));
    expect(screen.queryByDisplayValue('C001')).not.toBeInTheDocument();
  });

  itSlow('happy path: batch default 定位会隐藏集批列表', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getBatchPriorityConfigs.mockResolvedValue([
      {
        id: 41,
        batch_code: 'B001',
        batch_name: '集批A',
        priority_type: 'urgent',
        priority_score: 90,
        enabled: true,
      },
    ]);

    renderSettings('/settings?priorityKey=batch:default');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('集批优先级'));
    expect(screen.queryByDisplayValue('B001')).not.toBeInTheDocument();
  });

  itSlow('happy path: product_type default 定位会隐藏产品列表', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getProductTypePriorityConfigs.mockResolvedValue([
      {
        id: 51,
        product_type: 'P001',
        product_name: '产品A',
        priority_level: 'priority',
        priority_score: 88,
        enabled: true,
      },
    ]);

    renderSettings('/settings?priorityKey=product_type:default');
    await user.click(await screen.findByText('优先级配置'));
    await user.click(await screen.findByText('产品大类优先级'));
    expect(screen.queryByDisplayValue('P001')).not.toBeInTheDocument();
  });
});

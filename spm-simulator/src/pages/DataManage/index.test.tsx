import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { open, save } from '@tauri-apps/plugin-dialog';
import { materialApi } from '../../services/materialApi';
import { scheduleApi } from '../../services/scheduleApi';
import DataManage from './index';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
  open: vi.fn(),
}));

vi.mock('../../services/materialApi', () => ({
  materialApi: {
    getMaterials: vi.fn(),
    refreshTemperStatus: vi.fn(),
    deleteMaterials: vi.fn(),
  },
}));

vi.mock('../../services/scheduleApi', () => ({
  scheduleApi: {
    getMaterialStats: vi.fn(),
    getPlans: vi.fn(),
    deletePlan: vi.fn(),
    getBackups: vi.fn(),
    getCleanupEstimate: vi.fn(),
    exportMaterialsExcel: vi.fn(),
    exportPlanExcel: vi.fn(),
    exportPlanCsv: vi.fn(),
    backupDatabase: vi.fn(),
    restoreDatabase: vi.fn(),
    deleteBackup: vi.fn(),
    clearLogs: vi.fn(),
    cleanHistoryPlans: vi.fn(),
    cleanMaterials: vi.fn(),
    clearUndoStack: vi.fn(),
    getExportTemplates: vi.fn(),
    updateExportTemplate: vi.fn(),
    createExportTemplate: vi.fn(),
    deleteExportTemplate: vi.fn(),
  },
}));

const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedOpen = open as unknown as ReturnType<typeof vi.fn>;
const mockedMaterialApi = materialApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const mockedScheduleApi = scheduleApi as unknown as Record<string, ReturnType<typeof vi.fn>>;
const TEST_TIMEOUT = 20000;
const itSlow = (name: string, fn: () => Promise<void>) => it(name, fn, TEST_TIMEOUT);

async function selectPlanInExportModal(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('导出排程'));
  const planLabels = await screen.findAllByText('选择方案:');
  let comboBox: Element | null = null;
  for (let i = planLabels.length - 1; i >= 0; i -= 1) {
    const current = planLabels[i].parentElement?.querySelector('[role="combobox"]') ?? null;
    if (current) {
      comboBox = current;
      break;
    }
  }
  if (!comboBox) {
    throw new Error('导出排程方案选择器未找到');
  }
  fireEvent.mouseDown(comboBox);
  await user.click(await screen.findByText('方案A (PLAN-001)'));
}

async function openCreateTemplateDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByText('导出模板'));
  await user.click(await screen.findByText('新建模板'));
  const nameInput = await screen.findByLabelText('模板名称');
  const container = nameInput.closest('.ant-modal');
  if (!container) {
    throw new Error('新建导出模板弹窗未找到');
  }
  return container as HTMLElement;
}

describe('DataManage 数据操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 50,
    });
    mockedMaterialApi.refreshTemperStatus.mockResolvedValue({
      total: 0,
      tempered: 3,
      waiting: 2,
    });
    mockedScheduleApi.getMaterialStats.mockResolvedValue({
      total: 0,
      pending: 0,
      frozen: 0,
      completed: 0,
      tempered: 0,
      waiting: 0,
    });
    mockedScheduleApi.getPlans.mockResolvedValue([]);
    mockedScheduleApi.deletePlan.mockResolvedValue(undefined);
    mockedScheduleApi.getBackups.mockResolvedValue([]);
    mockedScheduleApi.getCleanupEstimate.mockResolvedValue({
      older_than_days: 30,
      logs: 0,
      history_plans: 0,
      materials: 0,
    });
    mockedScheduleApi.exportMaterialsExcel.mockResolvedValue({
      row_count: 0,
      file_path: '/tmp/out.xlsx',
    });
    mockedScheduleApi.backupDatabase.mockResolvedValue({
      file_name: 'backup_20260213.db',
      file_path: '/tmp/backup_20260213.db',
      file_size: 1024,
      created_at: '2026-02-13T10:00:00Z',
    });
    mockedScheduleApi.getExportTemplates.mockResolvedValue([
      {
        id: 11,
        name: '标准模板',
        description: '默认导出列',
        columns: '["coil_id","steel_grade"]',
        is_default: false,
        updated_at: '2026-02-13T10:00:00Z',
      },
    ]);
    mockedScheduleApi.updateExportTemplate.mockResolvedValue({});
    mockedScheduleApi.exportPlanExcel.mockResolvedValue({
      row_count: 10,
      file_path: '/tmp/plan.xlsx',
    });
    mockedScheduleApi.exportPlanCsv.mockResolvedValue({
      row_count: 10,
      file_path: '/tmp/plan.csv',
    });
    mockedScheduleApi.clearLogs.mockResolvedValue(0);
    mockedScheduleApi.cleanHistoryPlans.mockResolvedValue(0);
    mockedScheduleApi.cleanMaterials.mockResolvedValue(0);
    mockedScheduleApi.clearUndoStack.mockResolvedValue(0);
    mockedScheduleApi.restoreDatabase.mockResolvedValue({});
    mockedScheduleApi.deleteBackup.mockResolvedValue({});
    mockedScheduleApi.deleteExportTemplate.mockResolvedValue({});
    mockedSave.mockResolvedValue('/tmp/out.xlsx');
    mockedOpen.mockResolvedValue('/tmp/backup_20260213.db');
  });

  itSlow('happy path: 刷新适温会调用后端刷新接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('刷新适温'));

    await waitFor(() => {
      expect(mockedMaterialApi.refreshTemperStatus).toHaveBeenCalledTimes(1);
    });
  });

  itSlow('happy path: 刷新按钮会同时刷新材料/统计/清理估算', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await screen.findByText('刷新');
    mockedMaterialApi.getMaterials.mockClear();
    mockedScheduleApi.getMaterialStats.mockClear();
    mockedScheduleApi.getCleanupEstimate.mockClear();

    await user.click(screen.getByText('刷新'));

    await waitFor(() => {
      expect(mockedMaterialApi.getMaterials).toHaveBeenCalledTimes(1);
      expect(mockedScheduleApi.getMaterialStats).toHaveBeenCalledTimes(1);
      expect(mockedScheduleApi.getCleanupEstimate).toHaveBeenCalledWith(30);
    });
  });

  itSlow('fail path: 导出材料失败时也能保持页面可用', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.exportMaterialsExcel.mockRejectedValue(new Error('export failed'));
    render(<DataManage />);

    await user.click(await screen.findByText('导出材料'));

    await waitFor(() => {
      expect(mockedScheduleApi.exportMaterialsExcel).toHaveBeenCalledWith(
        '/tmp/out.xlsx',
        undefined
      );
    });
    expect(screen.getByText('刷新适温')).toBeInTheDocument();
  });

  itSlow('fail path: 导出材料取消选择路径时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce(null);
    render(<DataManage />);

    await user.click(await screen.findByText('导出材料'));

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportMaterialsExcel).not.toHaveBeenCalled();
  });

  itSlow('happy path: 立即备份会调用备份接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('立即备份'));

    await waitFor(() => {
      expect(mockedScheduleApi.backupDatabase).toHaveBeenCalledTimes(1);
    });
  });

  itSlow('fail path: 备份失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.backupDatabase.mockRejectedValue(new Error('backup failed'));
    render(<DataManage />);

    await user.click(await screen.findByText('立即备份'));

    await waitFor(() => {
      expect(mockedScheduleApi.backupDatabase).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('导出模板')).toBeInTheDocument();
  });

  itSlow('happy path: 设默认模板会调用更新接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    await user.click(await screen.findByText('设默认'));

    await waitFor(() => {
      expect(mockedScheduleApi.updateExportTemplate).toHaveBeenCalledWith(11, { is_default: true });
    });
  });

  itSlow('fail path: 设默认失败时页面保持可用', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.updateExportTemplate.mockRejectedValue(new Error('set default failed'));
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    await user.click(await screen.findByText('设默认'));

    await waitFor(() => {
      expect(mockedScheduleApi.updateExportTemplate).toHaveBeenCalledWith(11, { is_default: true });
    });
    expect(screen.getByText('导出模板管理')).toBeInTheDocument();
  });

  itSlow('happy path: 导出排程 Excel 会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([{ id: 101, name: '方案A', plan_no: 'PLAN-001' }]);
    mockedSave.mockResolvedValueOnce('/tmp/plan-export.xlsx');
    render(<DataManage />);

    await selectPlanInExportModal(user);
    await user.click(await screen.findByText('导出 Excel'));

    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanExcel).toHaveBeenCalledWith(
        101,
        '/tmp/plan-export.xlsx',
        undefined
      );
    });
  });

  itSlow('happy path: 导出排程 CSV 会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([{ id: 101, name: '方案A', plan_no: 'PLAN-001' }]);
    mockedSave.mockResolvedValueOnce('/tmp/plan-export.csv');
    render(<DataManage />);

    await selectPlanInExportModal(user);
    await user.click(await screen.findByText('导出 CSV'));

    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanCsv).toHaveBeenCalledWith(
        101,
        '/tmp/plan-export.csv',
        undefined
      );
    });
  });

  itSlow('happy path: 导出排程弹窗可关闭', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([{ id: 101, name: '方案A', plan_no: 'PLAN-001' }]);
    render(<DataManage />);

    await user.click(await screen.findByText('导出排程'));
    const title = await screen.findByText('导出排程方案');
    const modal = title.closest('.ant-modal') as HTMLElement;
    const closeBtn = modal.querySelector('.ant-modal-close') as HTMLElement;
    await user.click(closeBtn);

    await waitFor(() => {
      expect(modal).not.toBeVisible();
    });
  });

  itSlow('fail path: 导出排程 CSV 失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([{ id: 101, name: '方案A', plan_no: 'PLAN-001' }]);
    mockedSave.mockResolvedValueOnce('/tmp/plan-export-fail.csv');
    mockedScheduleApi.exportPlanCsv.mockRejectedValueOnce(new Error('plan csv export failed'));
    render(<DataManage />);

    await selectPlanInExportModal(user);
    await user.click(await screen.findByText('导出 CSV'));

    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanCsv).toHaveBeenCalledWith(
        101,
        '/tmp/plan-export-fail.csv',
        undefined
      );
    });
    expect(screen.getByText('导出排程方案')).toBeInTheDocument();
  });

  itSlow('happy path: 方案管理单条删除会调用删除方案接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([
      {
        id: 101,
        name: '方案A',
        plan_no: 'PLAN-001',
        status: 'draft',
        version: 1,
        total_count: 12,
        total_weight: 120.5,
        created_at: '2026-02-13T09:00:00Z',
        updated_at: '2026-02-13T09:30:00Z',
      },
    ]);
    render(<DataManage />);

    const planCell = await screen.findByText('PLAN-001');
    const row = planCell.closest('tr');
    if (!row) {
      throw new Error('方案行未找到');
    }
    fireEvent.click(within(row).getByRole('button', { name: '删除方案' }));
    fireEvent.click(await screen.findByRole('button', { name: /确认删除|确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.deletePlan).toHaveBeenCalledWith(101);
    });
  });

  itSlow('happy path: 方案管理批量删除会逐条调用删除方案接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([
      {
        id: 101,
        name: '方案A',
        plan_no: 'PLAN-001',
        status: 'draft',
        version: 1,
        total_count: 10,
        total_weight: 100,
        created_at: '2026-02-13T09:00:00Z',
        updated_at: '2026-02-13T09:30:00Z',
      },
      {
        id: 102,
        name: '方案B',
        plan_no: 'PLAN-002',
        status: 'saved',
        version: 2,
        total_count: 11,
        total_weight: 110,
        created_at: '2026-02-13T10:00:00Z',
        updated_at: '2026-02-13T10:30:00Z',
      },
    ]);
    render(<DataManage />);

    const rowA = (await screen.findByText('PLAN-001')).closest('tr');
    const rowB = (await screen.findByText('PLAN-002')).closest('tr');
    if (!rowA || !rowB) {
      throw new Error('方案行未找到');
    }
    fireEvent.click(within(rowA).getByRole('checkbox'));
    fireEvent.click(within(rowB).getByRole('checkbox'));

    await user.click(await screen.findByText('删除选中方案 (2)'));
    fireEvent.click(await screen.findByRole('button', { name: /确认删除|确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.deletePlan).toHaveBeenCalledTimes(2);
      const ids = mockedScheduleApi.deletePlan.mock.calls.map((call) => call[0]).sort();
      expect(ids).toEqual([101, 102]);
    });
  });

  itSlow('happy path: 导出排程模板选择后清空仍按默认模板导出', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([{ id: 101, name: '方案A', plan_no: 'PLAN-001' }]);
    mockedSave.mockResolvedValueOnce('/tmp/plan-export-clear.xlsx');
    render(<DataManage />);

    await selectPlanInExportModal(user);
    const templateLabels = await screen.findAllByText('导出模板:');
    const templateCombo =
      templateLabels[templateLabels.length - 1].parentElement?.querySelector('[role="combobox"]');
    if (!templateCombo) {
      throw new Error('导出模板选择器未找到');
    }

    fireEvent.mouseDown(templateCombo);
    await user.click(await screen.findByText('标准模板'));
    const clearIcons = Array.from(document.querySelectorAll('.ant-select-clear')) as HTMLElement[];
    if (clearIcons.length === 0) {
      throw new Error('导出模板清空按钮未找到');
    }
    fireEvent.mouseDown(clearIcons[clearIcons.length - 1]);
    fireEvent.click(clearIcons[clearIcons.length - 1]);

    await user.click(await screen.findByText('导出 Excel'));
    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanExcel).toHaveBeenCalledWith(
        101,
        '/tmp/plan-export-clear.xlsx',
        undefined
      );
    });
  });

  itSlow('happy path: 清理日志会调用清理接口', async () => {
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理日志'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.clearLogs).toHaveBeenCalledWith(30);
    });
  });

  itSlow('happy path: 清理历史方案会调用清理接口', async () => {
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理历史方案'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.cleanHistoryPlans).toHaveBeenCalledWith(30);
    });
  });

  itSlow('happy path: 清理材料会调用清理接口', async () => {
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理材料'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.cleanMaterials).toHaveBeenCalledWith(30);
    });
  });

  itSlow('happy path: 清理撤销栈会调用清理接口', async () => {
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理撤销栈'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.clearUndoStack).toHaveBeenCalledTimes(1);
    });
  });

  itSlow('happy path: 清理天数输入清空后回退到30天', async () => {
    render(<DataManage />);

    const dayInput = (await screen.findByRole('spinbutton')) as HTMLInputElement;
    fireEvent.change(dayInput, { target: { value: '45' } });
    fireEvent.blur(dayInput);

    fireEvent.click(await screen.findByText('清理日志'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));
    await waitFor(() => {
      expect(mockedScheduleApi.clearLogs).toHaveBeenCalledWith(45);
    });

    fireEvent.change(dayInput, { target: { value: '' } });
    fireEvent.blur(dayInput);

    fireEvent.click(await screen.findByText('清理日志'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));
    await waitFor(() => {
      expect(mockedScheduleApi.clearLogs).toHaveBeenLastCalledWith(30);
    });
  });

  itSlow('happy path: 材料分页切换与导出方案搜索可用', async () => {
    const user = userEvent.setup();
    mockedMaterialApi.getMaterials.mockImplementation(async (_filter, pagination) => {
      const page = pagination?.page ?? 1;
      const pageSize = pagination?.page_size ?? 50;
      const start = (page - 1) * pageSize + 1;
      const end = Math.min(120, start + pageSize - 1);
      const items = Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => {
        const id = start + index;
        return {
          id,
          coil_id: `C${String(id).padStart(3, '0')}`,
          steel_grade: 'Q235',
          thickness: 1.2,
          width: 1200,
          weight: 10,
          coiling_time: '2026-02-01T00:00:00Z',
          contract_nature: '订单',
          due_date: '2030-01-01',
          status: 'pending',
          temp_status: 'ready',
        };
      });
      return {
        items,
        total: 120,
        page,
        page_size: pageSize,
      };
    });
    mockedScheduleApi.getPlans.mockResolvedValue([
      { id: 101, name: '方案A', plan_no: 'PLAN-001' },
      { id: 102, name: '方案B', plan_no: 'PLAN-002' },
    ]);
    render(<DataManage />);

    expect(await screen.findByText('C001')).toBeInTheDocument();
    const pageTwo = document.querySelector('.ant-pagination-item-2 a') as HTMLElement | null;
    if (!pageTwo) {
      throw new Error('分页按钮2未找到');
    }
    fireEvent.click(pageTwo);

    await waitFor(() => {
      const hitPageTwo = mockedMaterialApi.getMaterials.mock.calls.some(
        (_call) => _call[1]?.page === 2 && _call[1]?.page_size === 50
      );
      expect(hitPageTwo).toBe(true);
    });

    await user.click(await screen.findByText('导出排程'));
    const exportDialogs = await screen.findAllByRole('dialog');
    const exportDialog = exportDialogs[exportDialogs.length - 1];
    const combos = within(exportDialog).getAllByRole('combobox');
    const planCombo = combos.find((item) => !item.hasAttribute('readonly')) ?? null;
    if (!planCombo) {
      throw new Error('导出排程方案选择器未找到');
    }

    fireEvent.mouseDown(planCombo);
    await user.type(planCombo, 'plan-001');
    const planOptions = await screen.findAllByText('方案A (PLAN-001)');
    await user.click(planOptions[planOptions.length - 1]);
    expect(exportDialog.querySelector('[title="方案A (PLAN-001)"]')).toBeTruthy();
  });

  itSlow('happy path: 勾选材料行后会显示删除选中按钮', async () => {
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: [
        {
          id: 101,
          coil_id: 'C101',
          steel_grade: 'Q235',
          thickness: 1.2,
          width: 1200,
          weight: 10,
          coiling_time: '2026-02-01T00:00:00Z',
          contract_nature: '订单',
          due_date: '2030-01-01',
          status: 'pending',
          temp_status: 'ready',
        },
      ],
      total: 1,
      page: 1,
      page_size: 50,
    });
    render(<DataManage />);

    const materialCell = await screen.findByText('C101');
    const materialRow = materialCell.closest('tr');
    if (!materialRow) {
      throw new Error('材料行未找到');
    }
    fireEvent.click(within(materialRow).getByRole('checkbox'));

    expect(await screen.findByText('删除选中 (1)')).toBeInTheDocument();
  });

  itSlow('happy path: 状态/适温筛选与回车搜索会带条件刷新材料列表', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await screen.findByText('刷新');
    mockedMaterialApi.getMaterials.mockClear();

    const comboBoxes = screen.getAllByRole('combobox');
    // comboBoxes[0] = 方案筛选, [1] = 状态筛选, [2] = 适温筛选
    fireEvent.mouseDown(comboBoxes[1]);
    const pendingOptions = await screen.findAllByText('待排');
    await user.click(pendingOptions[pendingOptions.length - 1]);

    fireEvent.mouseDown(comboBoxes[2]);
    const waitingOptions = await screen.findAllByText('等待中');
    await user.click(waitingOptions[waitingOptions.length - 1]);

    const searchInput = screen.getByPlaceholderText('搜索...') as HTMLInputElement;
    await user.clear(searchInput);
    await user.type(searchInput, 'C001{enter}');

    await waitFor(() => {
      expect(mockedMaterialApi.getMaterials).toHaveBeenCalled();
      const lastCall = mockedMaterialApi.getMaterials.mock.calls.at(-1);
      expect(lastCall?.[0]).toMatchObject({
        status: 'pending',
        temp_status: 'waiting',
        keyword: 'C001',
      });
      expect(lastCall?.[1]).toMatchObject({ page: 1 });
    });
  });

  itSlow('fail path: 清理日志失败时页面仍可继续交互', async () => {
    mockedScheduleApi.clearLogs.mockRejectedValue(new Error('clear logs failed'));
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理日志'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.clearLogs).toHaveBeenCalledWith(30);
    });
    expect(screen.getByText('清理材料')).toBeInTheDocument();
  });

  itSlow('happy path: 恢复备份会调用恢复接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('恢复备份'));

    await waitFor(() => {
      expect(mockedOpen).toHaveBeenCalledTimes(1);
      expect(mockedScheduleApi.restoreDatabase).toHaveBeenCalledWith('/tmp/backup_20260213.db');
    });
  });

  itSlow('happy path: 备份列表删除会调用删除接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getBackups.mockResolvedValue([
      {
        file_name: 'backup_old.db',
        file_path: '/tmp/backup_old.db',
        file_size: 2048,
        created_at: '2026-02-13T09:00:00Z',
      },
    ]);
    render(<DataManage />);

    await user.click(await screen.findByText('备份列表'));
    const backupCell = await screen.findByText('backup_old.db');
    const row = backupCell.closest('tr');
    if (!row) {
      throw new Error('备份行未找到');
    }
    fireEvent.click(within(row).getByRole('button', { name: '删除' }));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.deleteBackup).toHaveBeenCalledWith('/tmp/backup_old.db');
    });
  });

  itSlow('happy path: 备份列表恢复会调用恢复接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getBackups.mockResolvedValue([
      {
        file_name: 'backup_restore.db',
        file_path: '/tmp/backup_restore.db',
        file_size: 3072,
        created_at: '2026-02-13T11:00:00Z',
      },
    ]);
    render(<DataManage />);

    await user.click(await screen.findByText('备份列表'));
    const backupCell = await screen.findByText('backup_restore.db');
    const row = backupCell.closest('tr');
    if (!row) {
      throw new Error('备份行未找到');
    }
    fireEvent.click(within(row).getByRole('button', { name: '恢复' }));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.restoreDatabase).toHaveBeenCalledWith('/tmp/backup_restore.db');
    });
  });

  itSlow('happy path: 备份列表弹窗可关闭', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('备份列表'));
    const title = await screen.findByText('数据库备份列表');
    const modal = title.closest('.ant-modal') as HTMLElement;
    const closeBtn = modal.querySelector('.ant-modal-close') as HTMLElement;
    await user.click(closeBtn);

    await waitFor(() => {
      expect(modal).not.toBeVisible();
    });
  });

  itSlow('happy path: 导出模板删除会调用删除模板接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    const templateCell = await screen.findByText('标准模板');
    const row = templateCell.closest('tr');
    if (!row) {
      throw new Error('模板行未找到');
    }
    fireEvent.click(within(row).getByRole('button', { name: '删除' }));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.deleteExportTemplate).toHaveBeenCalledWith(11);
    });
  });

  itSlow('happy path: 导出模板管理弹窗可关闭', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    const title = await screen.findByText('导出模板管理');
    const modal = title.closest('.ant-modal') as HTMLElement;
    const closeBtn = modal.querySelector('.ant-modal-close') as HTMLElement;
    await user.click(closeBtn);

    await waitFor(() => {
      expect(modal).not.toBeVisible();
    });
  });

  itSlow('happy path: 新建导出模板会调用创建接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);
    await user.type(within(dialog).getByLabelText('模板名称'), '新模板A');
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.createExportTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '新模板A',
          columns: expect.stringContaining('coil_id'),
        })
      );
    });
  });

  itSlow('happy path: 编辑导出模板会调用更新接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    await user.click(await screen.findByText('编辑'));
    const nameInput = await screen.findByLabelText('模板名称');
    const dialog = nameInput.closest('.ant-modal');
    if (!dialog) {
      throw new Error('编辑导出模板弹窗未找到');
    }
    const descInput = within(dialog as HTMLElement).getByLabelText('描述');
    await user.clear(descInput);
    await user.type(descInput, '更新后的描述');
    await user.click(within(dialog as HTMLElement).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.updateExportTemplate).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          name: '标准模板',
          description: '更新后的描述',
        })
      );
    });
  });

  itSlow('happy path: 新建模板新增规则后删除规则仍可保存', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);
    await user.type(within(dialog).getByLabelText('模板名称'), '规则增删模板');
    await user.click(within(dialog).getByText('新增规则'));
    const deleteButtons = within(dialog).getAllByRole('button', { name: /删\s*除/ });
    await user.click(deleteButtons[deleteButtons.length - 1]);
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.createExportTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '规则增删模板',
          columns: expect.stringContaining('coil_id'),
        })
      );
    });
  });

  itSlow('happy path: 新建模板列删除与规则拖拽后仍可保存', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);
    await user.type(within(dialog).getByLabelText('模板名称'), '列与规则拖拽模板');

    const deleteButtonsBefore = within(dialog).getAllByRole('button', { name: /删\s*除/ });
    await user.click(deleteButtonsBefore[0]);

    const addRuleButton = within(dialog).getByText('新增规则');
    await user.click(addRuleButton);

    const draggableCards = Array.from(
      dialog.querySelectorAll('div[draggable="true"]')
    ) as HTMLElement[];
    if (draggableCards.length < 1) {
      throw new Error('拖拽卡片数量不足');
    }
    const dragFrom = draggableCards[draggableCards.length - 1];
    const dragTo = draggableCards[draggableCards.length - 1];
    fireEvent.dragStart(dragFrom);
    fireEvent.dragEnter(dragTo);
    fireEvent.dragOver(dragTo);
    fireEvent.drop(dragTo);
    fireEvent.dragEnd(dragFrom);

    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.createExportTemplate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: '列与规则拖拽模板',
          columns: expect.any(String),
        })
      );
    });
  });

  itSlow('happy path: 新建模板规则跨位置拖拽后仍可保存', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);
    await user.type(within(dialog).getByLabelText('模板名称'), '规则跨位拖拽模板');
    await user.click(within(dialog).getByText('新增规则'));
    await user.click(within(dialog).getByText('新增规则'));

    const draggableCards = Array.from(
      dialog.querySelectorAll('div[draggable="true"]')
    ) as HTMLElement[];
    if (draggableCards.length < 2) {
      throw new Error('规则拖拽卡片数量不足');
    }
    const dragFrom = draggableCards[draggableCards.length - 1];
    const dragTo = draggableCards[draggableCards.length - 2];
    fireEvent.dragStart(dragFrom);
    fireEvent.dragEnter(dragTo);
    fireEvent.dragOver(dragTo);
    fireEvent.drop(dragTo);
    fireEvent.dragEnd(dragFrom);
    expect(within(dialog).getByText('新增规则')).toBeInTheDocument();
  });

  it('happy path: 新建模板删除全部列后可通过新增列恢复', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);

    for (let i = 0; i < 8; i += 1) {
      const deleteButtons = within(dialog).queryAllByRole('button', { name: /删\s*除/ });
      if (deleteButtons.length === 0) break;
      await user.click(deleteButtons[0]);
    }

    expect(within(dialog).getByText('未配置导出列，请新增后再保存。')).toBeInTheDocument();
    await user.click(within(dialog).getByText('新增列'));
    expect(within(dialog).queryByText('未配置导出列，请新增后再保存。')).not.toBeInTheDocument();
    expect(within(dialog).getByText('提示: 可直接拖拽列卡片调整导出顺序')).toBeInTheDocument();
  }, 35000);

  itSlow('happy path: 新建模板列支持拖拽与上下移动按钮', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);
    const draggableCards = Array.from(
      dialog.querySelectorAll('div[draggable="true"]')
    ) as HTMLElement[];
    if (draggableCards.length < 2) {
      throw new Error('列拖拽卡片数量不足');
    }

    const firstCard = draggableCards[0];
    const secondCard = draggableCards[1];
    fireEvent.dragStart(firstCard);
    fireEvent.dragEnter(secondCard);
    fireEvent.dragOver(secondCard);
    fireEvent.drop(secondCard);
    fireEvent.dragEnd(firstCard);

    const firstButtons = within(firstCard).getAllByRole('button');
    await user.click(firstButtons[1]);

    const refreshedCards = Array.from(
      dialog.querySelectorAll('div[draggable="true"]')
    ) as HTMLElement[];
    const movedCard = refreshedCards[1];
    const movedButtons = within(movedCard).getAllByRole('button');
    await user.click(movedButtons[0]);

    expect(within(dialog).getByText('提示: 可直接拖拽列卡片调整导出顺序')).toBeInTheDocument();
  });

  itSlow('fail path: 高级规则JSON无效时不会调用创建接口', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    const dialog = await openCreateTemplateDialog(user);
    await user.type(within(dialog).getByLabelText('模板名称'), '规则非法模板');
    const advancedRuleInput = within(dialog).getByPlaceholderText('例如: {"weight":{"digits":2}}');
    await user.clear(advancedRuleInput);
    fireEvent.change(advancedRuleInput, { target: { value: '{' } });
    await user.click(within(dialog).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.createExportTemplate).not.toHaveBeenCalled();
    });
    expect(screen.getByText('新建导出模板')).toBeInTheDocument();
  });

  itSlow('fail path: 模板列配置JSON无效时展示错误标签', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue([
      {
        id: 21,
        name: '异常模板',
        description: '无效列配置',
        columns: '{',
        is_default: false,
        updated_at: '2026-02-13T10:00:00Z',
      },
    ]);
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    expect(await screen.findByText('无效JSON')).toBeInTheDocument();
  });

  itSlow('happy path: 模板列配置为对象JSON时展示 JSON 文本', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue([
      {
        id: 22,
        name: '对象模板',
        description: '对象列配置',
        columns: '{"coil_id":{"label":"卷号"}}',
        is_default: false,
        updated_at: '2026-02-13T10:00:00Z',
      },
    ]);
    render(<DataManage />);

    await user.click(await screen.findByText('导出模板'));
    const templateCell = await screen.findByText('对象模板');
    const row = templateCell.closest('tr');
    if (!row) {
      throw new Error('模板行未找到');
    }
    expect(within(row).getByText('JSON')).toBeInTheDocument();
  });

  itSlow('fail path: 导出排程未选择方案时导出按钮保持禁用', async () => {
    const user = userEvent.setup();
    render(<DataManage />);

    await user.click(await screen.findByText('导出排程'));
    await screen.findByText('选择方案:');
    const exportExcelTexts = await screen.findAllByText('导出 Excel');
    const exportExcelButton = exportExcelTexts[exportExcelTexts.length - 1].closest('button');
    if (!exportExcelButton) {
      throw new Error('导出 Excel 按钮未找到');
    }

    expect(exportExcelButton).toBeDisabled();
    expect(mockedScheduleApi.exportPlanExcel).not.toHaveBeenCalled();
  });

  itSlow('fail path: 已选择方案但导出路径取消时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getPlans.mockResolvedValue([{ id: 101, name: '方案A', plan_no: 'PLAN-001' }]);
    mockedSave.mockResolvedValueOnce(null);
    render(<DataManage />);

    await selectPlanInExportModal(user);
    await user.click(await screen.findByText('导出 Excel'));

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalled();
    });
    expect(mockedScheduleApi.exportPlanExcel).not.toHaveBeenCalled();
  });

  itSlow('fail path: 恢复备份时取消选择文件不会触发恢复接口', async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce(null);
    render(<DataManage />);

    await user.click(await screen.findByText('恢复备份'));

    await waitFor(() => {
      expect(mockedOpen).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.restoreDatabase).not.toHaveBeenCalled();
  });

  itSlow('fail path: 恢复备份选择文件异常时不会触发恢复接口', async () => {
    const user = userEvent.setup();
    mockedOpen.mockRejectedValueOnce(new Error('open failed'));
    render(<DataManage />);

    await user.click(await screen.findByText('恢复备份'));

    await waitFor(() => {
      expect(mockedOpen).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.restoreDatabase).not.toHaveBeenCalled();
    expect(screen.getByText('备份列表')).toBeInTheDocument();
  });

  itSlow('fail path: 清理历史方案失败时页面仍可继续交互', async () => {
    mockedScheduleApi.cleanHistoryPlans.mockRejectedValueOnce(new Error('clean history failed'));
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理历史方案'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.cleanHistoryPlans).toHaveBeenCalledWith(30);
    });
    expect(screen.getByText('清理材料')).toBeInTheDocument();
  });

  itSlow('fail path: 清理材料失败时页面仍可继续交互', async () => {
    mockedScheduleApi.cleanMaterials.mockRejectedValueOnce(new Error('clean materials failed'));
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理材料'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.cleanMaterials).toHaveBeenCalledWith(30);
    });
    expect(screen.getByText('清理日志')).toBeInTheDocument();
  });

  itSlow('fail path: 清理撤销栈失败时页面仍可继续交互', async () => {
    mockedScheduleApi.clearUndoStack.mockRejectedValueOnce(new Error('clear undo failed'));
    render(<DataManage />);

    fireEvent.click(await screen.findByText('清理撤销栈'));
    fireEvent.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.clearUndoStack).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('导出模板')).toBeInTheDocument();
  });

  itSlow('happy path: 清理估算数据在页面加载后正确展示', async () => {
    mockedScheduleApi.getCleanupEstimate.mockResolvedValue({
      older_than_days: 30,
      logs: 15,
      history_plans: 3,
      materials: 42,
    });
    render(<DataManage />);

    await waitFor(() => {
      expect(mockedScheduleApi.getCleanupEstimate).toHaveBeenCalledWith(30);
    });
    expect(await screen.findByText('清理日志')).toBeInTheDocument();
    expect(screen.getByText('清理历史方案')).toBeInTheDocument();
    expect(screen.getByText('清理材料')).toBeInTheDocument();
  });
});

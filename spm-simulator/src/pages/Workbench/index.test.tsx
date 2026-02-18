import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { save as dialogSave } from '@tauri-apps/plugin-dialog';

import type { Material } from '../../types/material';
import type { ScheduleItem, SchedulePlan } from '../../types/schedule';
import { scheduleApi } from '../../services/scheduleApi';
import { materialApi } from '../../services/materialApi';
import { configApi } from '../../services/configApi';
import { fieldMappingApi } from '../../services/fieldMappingApi';
import Workbench from './index';

vi.mock('../../components/DeferredEChart', () => ({
  default: () => <div data-testid="deferred-echart" />,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../services/scheduleApi', () => ({
  scheduleApi: {
    getPlans: vi.fn(),
    getPlan: vi.fn(),
    getScheduleItems: vi.fn(),
    getUndoRedoCount: vi.fn(),
    getWaitingForecastDetails: vi.fn(),
    autoSchedule: vi.fn(),
    analyzeScheduleIdleGaps: vi.fn(),
    getExportTemplates: vi.fn(),
    exportPlanExcel: vi.fn(),
    exportPlanCsv: vi.fn(),
    addToSchedule: vi.fn(),
    moveScheduleItem: vi.fn(),
    savePlan: vi.fn(),
    lockScheduleItems: vi.fn(),
    removeFromSchedule: vi.fn(),
    pushUndo: vi.fn(),
    undoAction: vi.fn(),
    redoAction: vi.fn(),
  },
}));

vi.mock('../../services/materialApi', () => ({
  materialApi: {
    getMaterials: vi.fn(),
    refreshTemperStatus: vi.fn(),
    importMaterials: vi.fn(),
    getImportBatches: vi.fn(),
    deleteImportBatch: vi.fn(),
    replaceAllMaterials: vi.fn(),
  },
}));

vi.mock('../../services/configApi', () => ({
  configApi: {
    getStrategyTemplates: vi.fn(),
    getSystemConfig: vi.fn(),
    getPriorityDimensionConfigs: vi.fn(),
    getCustomerPriorityConfigs: vi.fn(),
    getBatchPriorityConfigs: vi.fn(),
    getProductTypePriorityConfigs: vi.fn(),
  },
}));

vi.mock('../../services/fieldMappingApi', () => ({
  fieldMappingApi: {
    getFieldMappings: vi.fn(),
  },
}));

const mockedScheduleApi = scheduleApi as unknown as {
  getPlans: ReturnType<typeof vi.fn>;
  getPlan: ReturnType<typeof vi.fn>;
  getScheduleItems: ReturnType<typeof vi.fn>;
  getUndoRedoCount: ReturnType<typeof vi.fn>;
  getWaitingForecastDetails: ReturnType<typeof vi.fn>;
  autoSchedule: ReturnType<typeof vi.fn>;
  analyzeScheduleIdleGaps: ReturnType<typeof vi.fn>;
  getExportTemplates: ReturnType<typeof vi.fn>;
  exportPlanExcel: ReturnType<typeof vi.fn>;
  exportPlanCsv: ReturnType<typeof vi.fn>;
  addToSchedule: ReturnType<typeof vi.fn>;
  moveScheduleItem: ReturnType<typeof vi.fn>;
  savePlan: ReturnType<typeof vi.fn>;
  lockScheduleItems: ReturnType<typeof vi.fn>;
  removeFromSchedule: ReturnType<typeof vi.fn>;
  pushUndo: ReturnType<typeof vi.fn>;
  undoAction: ReturnType<typeof vi.fn>;
  redoAction: ReturnType<typeof vi.fn>;
};

const mockedMaterialApi = materialApi as unknown as {
  getMaterials: ReturnType<typeof vi.fn>;
  refreshTemperStatus: ReturnType<typeof vi.fn>;
  importMaterials: ReturnType<typeof vi.fn>;
  getImportBatches: ReturnType<typeof vi.fn>;
  deleteImportBatch: ReturnType<typeof vi.fn>;
  replaceAllMaterials: ReturnType<typeof vi.fn>;
};

const mockedConfigApi = configApi as unknown as {
  getStrategyTemplates: ReturnType<typeof vi.fn>;
  getSystemConfig: ReturnType<typeof vi.fn>;
  getPriorityDimensionConfigs: ReturnType<typeof vi.fn>;
  getCustomerPriorityConfigs: ReturnType<typeof vi.fn>;
  getBatchPriorityConfigs: ReturnType<typeof vi.fn>;
  getProductTypePriorityConfigs: ReturnType<typeof vi.fn>;
};
const mockedFieldMappingApi = fieldMappingApi as unknown as {
  getFieldMappings: ReturnType<typeof vi.fn>;
};

const mockedDialogSave = vi.mocked(dialogSave);

const plans: SchedulePlan[] = [
  {
    id: 1,
    plan_no: 'P-001',
    name: '测试方案',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    status: 'draft',
    score_overall: 88,
  },
];

const materials: Material[] = [
  {
    id: 101,
    coil_id: 'C101',
    steel_grade: 'Q235',
    thickness: 1.2,
    width: 1200,
    weight: 10,
    coiling_time: '2026-01-01T00:00:00Z',
    contract_nature: '订单',
    due_date: '2030-01-01',
    status: 'pending',
    temp_status: 'ready',
  },
];

const mixedMaterials: Material[] = [
  {
    id: 101,
    coil_id: 'C101',
    steel_grade: 'Q235',
    thickness: 1.2,
    width: 1200,
    weight: 10,
    coiling_time: '2026-01-01T00:00:00Z',
    contract_nature: '订单',
    due_date: '2030-01-01',
    status: 'pending',
    temp_status: 'ready',
  },
  {
    id: 102,
    coil_id: 'C102',
    steel_grade: 'Q235',
    thickness: 1.4,
    width: 1220,
    weight: 11,
    coiling_time: '2026-01-01T01:00:00Z',
    contract_nature: '订单',
    due_date: '2030-01-02',
    status: 'pending',
    temp_status: 'waiting',
  },
  {
    id: 103,
    coil_id: 'C103',
    steel_grade: 'Q345',
    thickness: 1.5,
    width: 1250,
    weight: 12,
    coiling_time: '2026-01-01T02:00:00Z',
    contract_nature: '订单',
    due_date: '2030-01-03',
    status: 'frozen',
    temp_status: 'ready',
  },
];

const scheduleItems: ScheduleItem[] = [];
const scheduleItemsWithRows: ScheduleItem[] = [
  {
    id: 201,
    plan_id: 1,
    material_id: 101,
    sequence: 1,
    shift_date: '2026-02-01',
    shift_no: 1,
    shift_type: 'day',
    planned_start: '08:00',
    planned_end: '09:00',
    is_locked: false,
  },
  {
    id: 202,
    plan_id: 1,
    material_id: 999,
    sequence: 2,
    shift_date: '2026-02-01',
    shift_no: 2,
    shift_type: 'night',
    planned_start: '20:00',
    planned_end: '21:00',
    is_locked: false,
  },
];

const strategyTemplates = [
  {
    id: 7,
    name: '默认策略',
    is_default: true,
    sort_weights: '[]',
    constraints: '[]',
    eval_weights: '{}',
    temper_rules: '{}',
  },
];

const exportTemplates = [
  {
    id: 9,
    name: '默认导出',
    columns: '[]',
    is_default: true,
  },
];

function renderWorkbench(initialUrl = '/?planId=1') {
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/" element={<Workbench />} />
        <Route path="/settings" element={<div>设置页</div>} />
        <Route path="/risk" element={<div>风险页</div>} />
        <Route path="/compare" element={<div>对比页</div>} />
        <Route path="/history" element={<div>历史页</div>} />
      </Routes>
    </MemoryRouter>
  );
}

/** 等待初始加载完成（方案号出现 + Spin 停止旋转） */
async function waitForLoaded() {
  await screen.findByText('(P-001)');
  // (P-001) 出现时，currentPlan 刚被设置，但 currentPlan change effect
  // （调用 loadScheduleItems → setLoading(true)）可能尚未触发。
  // 用 act() 显式刷新所有待处理的 React effects，确保 Spin 已启动后再等待其停止。
  await act(async () => {});
  await waitFor(
    () => {
      expect(document.querySelector('.ant-spin-spinning')).toBeNull();
      expect(document.querySelector('.ant-spin-blur')).toBeNull();
    },
    { timeout: 10000 },
  );
}

describe('Workbench 配置命中联动', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedScheduleApi.getPlans.mockResolvedValue(plans);
    mockedScheduleApi.getPlan.mockResolvedValue(plans[0]);
    mockedScheduleApi.getScheduleItems.mockResolvedValue([]);
    mockedScheduleApi.getUndoRedoCount.mockResolvedValue([0, 0]);
    mockedScheduleApi.getWaitingForecastDetails.mockResolvedValue([]);
    mockedScheduleApi.autoSchedule.mockResolvedValue({
      plan_id: 1,
      total_count: 1,
      total_weight: 10,
      roll_change_count: 0,
      score: 88,
    });
    mockedScheduleApi.analyzeScheduleIdleGaps.mockResolvedValue({
      plan_id: 1,
      threshold_minutes: 30,
      total_checked_gaps: 0,
      over_threshold_count: 0,
      max_gap_minutes: 0,
      avg_gap_minutes: 0,
      items: [],
    });
    mockedScheduleApi.getExportTemplates.mockResolvedValue([]);
    mockedScheduleApi.exportPlanExcel.mockResolvedValue({ row_count: 1 });
    mockedScheduleApi.exportPlanCsv.mockResolvedValue({ row_count: 1 });
    mockedScheduleApi.addToSchedule.mockResolvedValue(undefined);
    mockedScheduleApi.moveScheduleItem.mockResolvedValue(undefined);
    mockedScheduleApi.savePlan.mockResolvedValue(plans[0]);
    mockedScheduleApi.lockScheduleItems.mockResolvedValue(undefined);
    mockedScheduleApi.removeFromSchedule.mockResolvedValue(undefined);
    mockedScheduleApi.pushUndo.mockResolvedValue(undefined);
    mockedScheduleApi.undoAction.mockResolvedValue({ action_type: 'undo', remaining: 0 });
    mockedScheduleApi.redoAction.mockResolvedValue({ action_type: 'redo', remaining: 0 });
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: materials,
      total: 1,
      page: 1,
      page_size: 5000,
    });
    mockedMaterialApi.refreshTemperStatus.mockResolvedValue({ tempered: 1, waiting: 0 });
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([]);
    mockedConfigApi.getSystemConfig.mockResolvedValue({});
    mockedConfigApi.getPriorityDimensionConfigs.mockResolvedValue([]);
    mockedConfigApi.getCustomerPriorityConfigs.mockResolvedValue([]);
    mockedConfigApi.getBatchPriorityConfigs.mockResolvedValue([]);
    mockedConfigApi.getProductTypePriorityConfigs.mockResolvedValue([]);
    mockedFieldMappingApi.getFieldMappings.mockResolvedValue([
      {
        id: 31,
        template_name: '标准映射模板',
        is_default: true,
        source_type: 'excel',
        mappings: '[]',
      },
    ]);
  });

  it('点击命中标签可切换筛选状态', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await waitForLoaded();
    const chip = await screen.findByText(/考核合同\s+1/);
    await user.click(chip);

    expect(await screen.findByRole('button', { name: '清除命中筛选' })).toBeInTheDocument();
  }, 12000);

  it('双击命中标签会跳转到设置页', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await waitForLoaded();
    const chip = await screen.findByText(/考核合同\s+1/);
    await user.dblClick(chip);

    expect(await screen.findByText('设置页')).toBeInTheDocument();
  }, 12000);

  it('URL 带 forecastReadyDate 时会应用并可清除预测筛选', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getWaitingForecastDetails.mockResolvedValue([{ material_id: 101 }]);
    renderWorkbench('/?planId=1&forecastReadyDate=2026-02-20');

    expect(await screen.findByText('预测适温 2026-02-20')).toBeInTheDocument();
    expect(
      await screen.findByText('当前预测日期无待排待温材料，可清除预测筛选后继续操作。')
    ).toBeInTheDocument();
    expect(mockedScheduleApi.getWaitingForecastDetails).toHaveBeenCalledWith('2026-02-20');

    await user.click(screen.getByRole('button', { name: '清除预测筛选' }));
    await waitFor(() => {
      expect(screen.queryByText('预测适温 2026-02-20')).not.toBeInTheDocument();
    });
  }, 12000);

  it('无待排材料时显示暂无命中项', async () => {
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      page_size: 5000,
    });
    renderWorkbench();

    expect(await screen.findByText('暂无命中项')).toBeInTheDocument();
  }, 12000);

  it('Ctrl+A 在材料面板仅选择可入排材料', async () => {
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: mixedMaterials,
      total: mixedMaterials.length,
      page: 1,
      page_size: 5000,
    });
    renderWorkbench();

    expect(await screen.findByText('待排材料 (2)')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

    expect(await screen.findByRole('button', { name: '添加选中 (1/1)' })).toBeInTheDocument();
  }, 20000);

  it('添加材料弹窗插入位置清空后回退并可关闭', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await screen.findByText('待排材料 (1)');
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    await user.click(await screen.findByRole('button', { name: '添加选中 (1/1)' }));

    const title = await screen.findByText('批量添加到排程');
    const addDialog = title.closest('.ant-modal') as HTMLElement;
    const input = within(addDialog).getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '2' } });
    fireEvent.blur(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    await user.click(within(addDialog).getByRole('button', { name: /Cancel|取消/i }));
    await waitFor(() => {
      expect(addDialog).not.toBeVisible();
    });
  }, 20000);

  it('添加材料弹窗点击确认添加会走 onOk 分支并按追加模式调用接口', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await screen.findByText('待排材料 (1)');
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    await user.click(await screen.findByRole('button', { name: '添加选中 (1/1)' }));

    const addDialog = await screen.findByRole('dialog');
    await user.click(within(addDialog).getByRole('button', { name: /确认添加/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.addToSchedule).toHaveBeenCalledWith(1, [101], undefined);
    });
    await waitFor(() => {
      expect(mockedScheduleApi.pushUndo).toHaveBeenCalledWith(
        1,
        'add_materials',
        expect.any(String),
        expect.any(String)
      );
    });
  }, 20000);

  it('Esc 会清空材料面板选择', async () => {
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: mixedMaterials,
      total: mixedMaterials.length,
      page: 1,
      page_size: 5000,
    });
    renderWorkbench();

    await screen.findByText('待排材料 (2)');
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    expect(await screen.findByRole('button', { name: '添加选中 (1/1)' })).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '添加选中 (1/1)' })).not.toBeInTheDocument();
    });
  }, 20000);

  it('Ctrl+S / F5 / Ctrl+Z / Ctrl+Y 会调用对应接口', async () => {
    mockedScheduleApi.getUndoRedoCount.mockResolvedValue([1, 1]);
    renderWorkbench();

    await screen.findByText('撤销栈: 1步 / 重做栈: 1步');

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(
      () => {
        expect(mockedScheduleApi.savePlan).toHaveBeenCalledWith(1);
      },
      { timeout: 5000 }
    );

    fireEvent.keyDown(window, { key: 'F5' });
    await waitFor(
      () => {
        expect(mockedMaterialApi.refreshTemperStatus).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 }
    );

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(
      () => {
        expect(mockedScheduleApi.undoAction).toHaveBeenCalledWith(1);
      },
      { timeout: 5000 }
    );

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    await waitFor(
      () => {
        expect(mockedScheduleApi.redoAction).toHaveBeenCalledWith(1);
      },
      { timeout: 5000 }
    );
  }, 20000);

  it('Ctrl+S / F5 / Ctrl+Z / Ctrl+Y 失败分支可触发', async () => {
    mockedScheduleApi.getUndoRedoCount.mockResolvedValue([1, 1]);
    mockedScheduleApi.savePlan.mockRejectedValue(new Error('save failed'));
    mockedMaterialApi.refreshTemperStatus.mockRejectedValue(new Error('refresh failed'));
    mockedScheduleApi.undoAction.mockRejectedValue(new Error('undo failed'));
    mockedScheduleApi.redoAction.mockRejectedValue(new Error('redo failed'));
    renderWorkbench();

    await screen.findByText('撤销栈: 1步 / 重做栈: 1步');

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await waitFor(
      () => {
        expect(mockedScheduleApi.savePlan).toHaveBeenCalledWith(1);
      },
      { timeout: 5000 }
    );

    fireEvent.keyDown(window, { key: 'F5' });
    await waitFor(
      () => {
        expect(mockedMaterialApi.refreshTemperStatus).toHaveBeenCalledTimes(1);
      },
      { timeout: 5000 }
    );

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    await waitFor(
      () => {
        expect(mockedScheduleApi.undoAction).toHaveBeenCalledWith(1);
      },
      { timeout: 5000 }
    );

    fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
    await waitFor(
      () => {
        expect(mockedScheduleApi.redoAction).toHaveBeenCalledWith(1);
      },
      { timeout: 5000 }
    );
  }, 20000);

  it('已确认方案按 Ctrl+S 不会触发保存', async () => {
    mockedScheduleApi.getPlans.mockResolvedValue([{ ...plans[0], status: 'confirmed' as const }]);
    renderWorkbench();

    await waitForLoaded();
    fireEvent.keyDown(window, { key: 's', ctrlKey: true });

    expect(mockedScheduleApi.savePlan).not.toHaveBeenCalled();
  }, 12000);

  it('Ctrl+A 在无可入排材料时不会选中任何材料', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItems);
    mockedMaterialApi.getMaterials.mockResolvedValue({
      items: [mixedMaterials[1]],
      total: 1,
      page: 1,
      page_size: 5000,
    });
    renderWorkbench();

    await screen.findByText('待排材料 (1)');
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /添加选中/ })).not.toBeInTheDocument();
    });
  }, 12000);

  it('批量优先级弹窗输入清空后可回退并取消关闭', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    await screen.findByText('待排材料 (1)');
    fireEvent.keyDown(window, { key: 'a', ctrlKey: true });
    await user.click(await screen.findByRole('button', { name: '优先级' }));

    const title = await screen.findByText('批量设置材料优先级');
    const priorityDialog = title.closest('.ant-modal') as HTMLElement;
    const input = within(priorityDialog).getByRole('spinbutton');
    await user.clear(input);
    fireEvent.change(input, { target: { value: '' } });

    await user.click(within(priorityDialog).getByRole('button', { name: /Cancel|取消/i }));
    await waitFor(() => {
      expect(priorityDialog).not.toBeVisible();
    });
  }, 20000);

  it('排程选中后点击锁定/解锁会调用对应接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    const firstRow = within(scheduleCard).getByText('Q235').closest('tr') as HTMLElement;
    await user.click(within(firstRow).getByRole('checkbox'));

    await user.click(await within(scheduleCard).findByRole('button', { name: /锁定/ }));
    await waitFor(() => {
      expect(mockedScheduleApi.lockScheduleItems).toHaveBeenCalledWith(1, [201], true);
    });

    await user.click(await within(scheduleCard).findByRole('button', { name: /解锁/ }));
    await waitFor(() => {
      expect(mockedScheduleApi.lockScheduleItems).toHaveBeenCalledWith(1, [201], false);
    });
  }, 20000);

  it('排程选中后点击移除会调用移除与撤销快照接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    const firstRow = within(scheduleCard).getByText('Q235').closest('tr') as HTMLElement;
    await user.click(within(firstRow).getByRole('checkbox'));

    await user.click(await within(scheduleCard).findByRole('button', { name: /移除 \(1\)/ }));
    const popconfirm = await screen.findByRole('tooltip');
    await user.click(within(popconfirm).getByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedScheduleApi.removeFromSchedule).toHaveBeenCalledWith(1, [201]);
    });
    await waitFor(() => {
      expect(mockedScheduleApi.pushUndo).toHaveBeenCalledWith(
        1,
        'remove_items',
        expect.any(String),
        expect.any(String)
      );
    });
  }, 20000);

  it('排程锁定失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    mockedScheduleApi.lockScheduleItems.mockRejectedValueOnce(new Error('lock failed'));
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    const firstRow = within(scheduleCard).getByText('Q235').closest('tr') as HTMLElement;
    await user.click(within(firstRow).getByRole('checkbox'));
    await user.click(await within(scheduleCard).findByRole('button', { name: /锁定/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.lockScheduleItems).toHaveBeenCalledWith(1, [201], true);
    });
    expect(screen.getByRole('button', { name: /导出/ })).toBeInTheDocument();
  }, 20000);

  it('另存为弹窗取消后会重置为新建模式', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue(strategyTemplates);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /另存为/ }));

    const saveAsDialog = await screen.findByRole('dialog');
    expect(within(saveAsDialog).getByText('方案另存为')).toBeInTheDocument();
    expect(screen.getByDisplayValue('测试方案_副本')).toBeInTheDocument();

    await user.click(within(saveAsDialog).getByRole('button', { name: /Cancel|取消/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /新建方案/ }));
    const createDialog = await screen.findByRole('dialog');
    expect(within(createDialog).getByText('新建排程方案')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如: 2024-W01 日计划')).toHaveValue('');
  }, 20000);

  it('导出弹窗支持取消关闭', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    const exportDialog = await screen.findByRole('dialog');
    expect(within(exportDialog).getByText('导出排程')).toBeInTheDocument();
    expect(mockedScheduleApi.getExportTemplates).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 12000);

  it('导出模板选择后清空仍可关闭弹窗', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));
    const title = await screen.findByText('导出排程');
    const exportDialog = title.closest('.ant-modal') as HTMLElement;
    const templateSelect = within(exportDialog).getByRole('combobox');
    fireEvent.mouseDown(templateSelect);
    const templateOptions = await screen.findAllByText(/默认导出/);
    await user.click(templateOptions[templateOptions.length - 1]);

    const clearIcons = Array.from(
      exportDialog.querySelectorAll('.ant-select-clear')
    ) as HTMLElement[];
    if (clearIcons.length > 0) {
      fireEvent.mouseDown(clearIcons[0]);
      fireEvent.click(clearIcons[0]);
    }

    const closeBtn = exportDialog.querySelector('.ant-modal-close') as HTMLElement;
    await user.click(closeBtn);
    await waitFor(() => {
      expect(exportDialog).not.toBeVisible();
    });
  }, 20000);

  it('导出 Excel 选择路径取消时不调用导出接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    mockedDialogSave.mockResolvedValue(null);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    const exportDialog = await screen.findByRole('dialog');
    await user.click(within(exportDialog).getByRole('button', { name: /导出 Excel/ }));

    await waitFor(() => {
      expect(mockedDialogSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportPlanExcel).not.toHaveBeenCalled();
  }, 12000);

  it('导出 Excel 失败时走错误分支并保持弹窗打开', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    mockedDialogSave.mockResolvedValue('/tmp/workbench-export.xlsx');
    mockedScheduleApi.exportPlanExcel.mockRejectedValue(new Error('export failed'));
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    const exportDialog = await screen.findByRole('dialog');
    await user.click(within(exportDialog).getByRole('button', { name: /导出 Excel/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanExcel).toHaveBeenCalledTimes(1);
    });
    const [planId, filePath] = mockedScheduleApi.exportPlanExcel.mock.calls[0];
    expect(planId).toBe(1);
    expect(filePath).toBe('/tmp/workbench-export.xlsx');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  }, 12000);

  it('导出 CSV 成功后关闭弹窗', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    mockedDialogSave.mockResolvedValue('/tmp/workbench-export.csv');
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    const exportDialog = await screen.findByRole('dialog');
    await user.click(within(exportDialog).getByRole('button', { name: /导出 CSV/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanCsv).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportPlanCsv).toHaveBeenCalledWith(1, '/tmp/workbench-export.csv', 9);
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 12000);

  it('导出 CSV 失败时保持弹窗打开', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    mockedDialogSave.mockResolvedValue('/tmp/workbench-export.csv');
    mockedScheduleApi.exportPlanCsv.mockRejectedValue(new Error('export csv failed'));
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    const exportDialog = await screen.findByRole('dialog');
    await user.click(within(exportDialog).getByRole('button', { name: /导出 CSV/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanCsv).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  }, 12000);

  it('Ctrl+F 会切回材料面板并聚焦搜索框', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    await user.click(within(scheduleCard).getByText('Q235'));

    fireEvent.keyDown(window, { key: 'f', ctrlKey: true });

    expect(screen.getByPlaceholderText('搜索卷号/钢种/客户/合同...')).toHaveFocus();
  }, 12000);

  it('状态栏在配置日目标后显示日目标达成', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    mockedConfigApi.getSystemConfig.mockResolvedValue({
      capacity: {
        daily_target: { value: 10 },
      },
    });
    renderWorkbench();

    expect(await screen.findByText('日目标达成: 100.0% (1天×10t)')).toBeInTheDocument();
  }, 12000);

  it('状态栏在配置班次产能后显示按班次口径', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    mockedConfigApi.getSystemConfig.mockResolvedValue({
      capacity: {
        shift_capacity: { value: 20 },
      },
    });
    renderWorkbench();

    expect(await screen.findByText(/\(按班次2×20t\)/)).toBeInTheDocument();
  }, 12000);

  it('甘特图支持缩放重置与多选', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    await user.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rangeText = await screen.findByText(/08:00\s*~\s*08:00\(\+1\)/);
    const scheduleCard = rangeText.closest('.ant-card') as HTMLElement;
    await user.click(within(scheduleCard).getByRole('button', { name: 'zoom-in' }));
    expect(within(scheduleCard).getByText('x1.2')).toBeInTheDocument();

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.click(rows[0]);
    expect(
      await within(scheduleCard).findByRole('button', { name: /移除 \(1\)/ })
    ).toBeInTheDocument();
    fireEvent.click(rows[1], { ctrlKey: true });
    expect(
      await within(scheduleCard).findByRole('button', { name: /移除 \(2\)/ })
    ).toBeInTheDocument();
  }, 20000);

  it('甘特图 Ctrl 点击已选行可取消选中', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rangeText = await screen.findByText(/08:00\s*~\s*08:00\(\+1\)/);
    const scheduleCard = rangeText.closest('.ant-card') as HTMLElement;
    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(rows[0], { ctrlKey: true });
    expect(
      await within(scheduleCard).findByRole('button', { name: /移除 \(1\)/ })
    ).toBeInTheDocument();

    fireEvent.click(rows[0], { ctrlKey: true });
    await waitFor(() => {
      expect(
        within(scheduleCard).queryByRole('button', { name: /移除 \(/ })
      ).not.toBeInTheDocument();
    });
  }, 20000);

  it('甘特图锁定行拖拽会阻止默认行为', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue([
      { ...scheduleItemsWithRows[0], is_locked: true },
      scheduleItemsWithRows[1],
    ]);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(1);
    const dragEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragEvent, 'dataTransfer', {
      value: {
        effectAllowed: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
      },
    });
    fireEvent(rows[0], dragEvent);

    expect(dragEvent.defaultPrevented).toBe(true);
  }, 20000);

  it('甘特图非法 drop source 会走兜底分支并保持可交互', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.drop(rows[1], {
      dataTransfer: {
        getData: () => 'not-a-number',
      },
    });

    expect(screen.getByText(/08:00\s*~\s*08:00\(\+1\)/)).toBeInTheDocument();
  }, 20000);

  it('甘特图合法 drop source 会触发移动与撤销快照', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.drop(rows[1], {
      dataTransfer: {
        getData: () => '201',
      },
    });

    await waitFor(() => {
      expect(mockedScheduleApi.moveScheduleItem).toHaveBeenCalledWith(1, 201, 2);
    });
    await waitFor(() => {
      expect(mockedScheduleApi.pushUndo).toHaveBeenCalledWith(
        1,
        'move_item',
        expect.any(String),
        expect.any(String)
      );
    });
  }, 20000);

  it('甘特图拖拽经过目标行时会设置 dropEffect 并可触发 dragLeave 分支', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const dragData = {
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => '201'),
      dropEffect: 'none',
    };
    fireEvent.dragStart(rows[0], { dataTransfer: dragData });
    fireEvent.dragOver(rows[1], { clientY: 1, dataTransfer: dragData });
    expect(dragData.dropEffect).toBe('move');

    fireEvent.dragLeave(rows[1]);
    expect(screen.getByText(/08:00\s*~\s*08:00\(\+1\)/)).toBeInTheDocument();
  }, 20000);

  it('甘特图 dragEnd 会清空拖拽状态样式', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const dragData = {
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => '201'),
      dropEffect: 'none',
    };

    fireEvent.dragStart(rows[0], { dataTransfer: dragData });
    fireEvent.dragOver(rows[1], { clientY: 1, dataTransfer: dragData });
    expect(rows[1].className).toMatch(/gantt-swimlane-bar-drag-over-(before|after)/);

    fireEvent.dragEnd(rows[0]);
    await waitFor(() => {
      expect(rows[1].className).not.toMatch(/gantt-swimlane-bar-drag-over-(before|after)/);
    });
  }, 20000);

  it('甘特图 drop source 不存在时不会触发移动接口', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.drop(rows[1], {
      dataTransfer: {
        getData: () => '999',
      },
    });

    expect(mockedScheduleApi.moveScheduleItem).not.toHaveBeenCalled();
  }, 20000);

  it('甘特图 source 锁定时 drop 不会触发移动接口', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue([
      { ...scheduleItemsWithRows[0], is_locked: true },
      { ...scheduleItemsWithRows[1], is_locked: false },
    ]);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.drop(rows[1], {
      dataTransfer: {
        getData: () => '201',
      },
    });

    expect(mockedScheduleApi.moveScheduleItem).not.toHaveBeenCalled();
  }, 20000);

  it('甘特图 target 锁定时 drop 不会触发移动接口', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue([
      { ...scheduleItemsWithRows[0], is_locked: false },
      { ...scheduleItemsWithRows[1], is_locked: true },
    ]);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const initialCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(initialCard).getByRole('button', { name: '甘特图视图' }));

    const rows = Array.from(document.querySelectorAll('.gantt-swimlane-bar')) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    fireEvent.drop(rows[1], {
      dataTransfer: {
        getData: () => '201',
      },
    });

    expect(mockedScheduleApi.moveScheduleItem).not.toHaveBeenCalled();
  }, 20000);

  it('列表视图锁定行 dragStart 会阻止拖拽', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue([
      { ...scheduleItemsWithRows[0], is_locked: true },
      { ...scheduleItemsWithRows[1], is_locked: false },
    ]);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    const rows = Array.from(
      scheduleCard.querySelectorAll('.ant-table-tbody > tr[data-row-key]')
    ) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const dragEvent = new Event('dragstart', { bubbles: true, cancelable: true });
    Object.defineProperty(dragEvent, 'dataTransfer', {
      value: {
        effectAllowed: 'none',
        setData: vi.fn(),
        getData: vi.fn(() => ''),
      },
    });
    fireEvent(rows[0], dragEvent);

    expect(dragEvent.defaultPrevented).toBe(true);
  }, 20000);

  it('列表视图拖拽经过行会切换 top/bottom 样式并在 dragLeave/dragEnd 后清理', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    const rows = Array.from(
      scheduleCard.querySelectorAll('.ant-table-tbody > tr[data-row-key]')
    ) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    vi.spyOn(rows[1], 'getBoundingClientRect').mockReturnValue({
      top: 0,
      left: 0,
      bottom: 100,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);

    const dragData = {
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => ''),
      dropEffect: 'none',
    };

    fireEvent.dragStart(rows[0], { dataTransfer: dragData });
    expect(dragData.setData).toHaveBeenCalledWith('text/plain', '201');
    expect(dragData.effectAllowed).toBe('move');

    fireEvent.dragOver(rows[1], { clientY: -1, dataTransfer: dragData });
    expect(dragData.dropEffect).toBe('move');
    expect(rows[1].className).toMatch(/drag-over-(top|bottom)-row/);

    fireEvent.dragLeave(rows[1]);
    await waitFor(() => {
      expect(rows[1].className).not.toMatch(/drag-over-(top|bottom)-row/);
    });

    fireEvent.dragOver(rows[1], { clientY: 90, dataTransfer: dragData });
    expect(rows[1].className).toContain('drag-over-bottom-row');

    fireEvent.dragEnd(rows[0]);
    await waitFor(() => {
      expect(rows[1].className).not.toContain('drag-over-bottom-row');
    });
  }, 20000);

  it('列表视图 drop 有效 source 会触发移动，非法 source 不触发移动', async () => {
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    const rows = Array.from(
      scheduleCard.querySelectorAll('.ant-table-tbody > tr[data-row-key]')
    ) as HTMLElement[];
    expect(rows.length).toBeGreaterThanOrEqual(2);

    const dragData = {
      effectAllowed: 'none',
      setData: vi.fn(),
      getData: vi.fn(() => '201'),
      dropEffect: 'none',
    };
    fireEvent.dragStart(rows[0], { dataTransfer: dragData });
    fireEvent.dragOver(rows[1], { clientY: 90, dataTransfer: dragData });
    fireEvent.drop(rows[1], { dataTransfer: dragData });

    await waitFor(() => {
      expect(mockedScheduleApi.moveScheduleItem).toHaveBeenCalledWith(1, 201, 2);
    });

    mockedScheduleApi.moveScheduleItem.mockClear();
    fireEvent.dragStart(rows[0], { dataTransfer: dragData });
    fireEvent.drop(rows[1], {
      dataTransfer: {
        getData: () => 'not-a-number',
      },
    });
    expect(mockedScheduleApi.moveScheduleItem).not.toHaveBeenCalled();
  }, 20000);

  it('导入材料映射模板支持选择后清空', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    const importButtons = await screen.findAllByRole('button', { name: /导入材料/ });
    await user.click(importButtons[0]);
    await waitFor(() => {
      expect(mockedFieldMappingApi.getFieldMappings).toHaveBeenCalledTimes(1);
    });

    const importDialog = await screen.findByRole('dialog');
    expect(within(importDialog).getByText('导入材料')).toBeInTheDocument();
    const mappingSelect = within(importDialog).getByRole('combobox');
    fireEvent.mouseDown(mappingSelect);
    const mappingOptions = await screen.findAllByText('标准映射模板 (默认)');
    await user.click(mappingOptions[mappingOptions.length - 1]);
    expect(within(importDialog).getByTitle('标准映射模板 (默认)')).toBeInTheDocument();

    const clearIcon = importDialog.querySelector('.ant-select-clear') as HTMLElement | null;
    if (!clearIcon) {
      throw new Error('映射模板清空按钮未找到');
    }
    fireEvent.mouseDown(clearIcon);
    fireEvent.click(clearIcon);

    expect(within(importDialog).getByText('选择字段映射模板')).toBeInTheDocument();
  }, 20000);

  it('导入材料弹窗支持取消关闭', async () => {
    const user = userEvent.setup();
    renderWorkbench();

    const importButtons = await screen.findAllByRole('button', { name: /导入材料/ });
    await user.click(importButtons[0]);
    const importDialog = await screen.findByRole('dialog');

    await user.click(within(importDialog).getByRole('button', { name: /Cancel|取消/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 12000);

  it('点击排程卷号可打开并关闭材料详情弹窗', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    const scheduleTitle = await screen.findByText('排程序列 (2 块)');
    const scheduleCard = scheduleTitle.closest('.ant-card') as HTMLElement;
    fireEvent.click(within(scheduleCard).getByRole('button', { name: 'C101' }));

    const detailDialog = await screen.findByRole('dialog');
    expect(within(detailDialog).getByText('材料详情 - C101')).toBeInTheDocument();
    const closeButtons = Array.from(document.querySelectorAll('.ant-modal-close')) as HTMLElement[];
    await user.click(closeButtons[closeButtons.length - 1]);
    await waitFor(
      () => {
        expect(screen.queryByRole('dialog', { name: /材料详情 - C101/ })).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  }, 20000);

  it('导出 CSV 选择路径取消时不调用导出接口', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getExportTemplates.mockResolvedValue(exportTemplates);
    mockedDialogSave.mockResolvedValue(null);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /导出/ }));

    const exportDialog = await screen.findByRole('dialog');
    await user.click(within(exportDialog).getByRole('button', { name: /导出 CSV/ }));

    await waitFor(() => {
      expect(mockedDialogSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportPlanCsv).not.toHaveBeenCalled();
  }, 12000);

  it('自动排程弹窗支持取消关闭', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue(strategyTemplates);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /自动排程/ }));

    const scheduleDialog = await screen.findByRole('dialog');
    expect(within(scheduleDialog).getByText('自动排程')).toBeInTheDocument();
    expect(screen.getByText('默认策略 (默认)')).toBeInTheDocument();

    await user.click(within(scheduleDialog).getByRole('button', { name: /Cancel|取消/i }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  }, 12000);

  it('自动排程选择策略后会调用排程与刷新接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue(strategyTemplates);
    mockedScheduleApi.getScheduleItems.mockResolvedValue(scheduleItemsWithRows);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /自动排程/ }));

    const scheduleDialog = await screen.findByRole('dialog');
    const strategySelect = within(scheduleDialog).getByRole('combobox');
    fireEvent.mouseDown(strategySelect);
    const strategyOptions = await screen.findAllByText('默认策略 (默认)');
    await user.click(strategyOptions[strategyOptions.length - 1]);
    await user.click(within(scheduleDialog).getByRole('button', { name: /开始排程/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.autoSchedule).toHaveBeenCalledWith(1, 7);
    });
    await waitFor(() => {
      expect(mockedScheduleApi.pushUndo).toHaveBeenCalledWith(
        1,
        'auto_schedule',
        expect.any(String),
        expect.any(String)
      );
    });
    await waitFor(() => {
      expect(mockedScheduleApi.getPlan).toHaveBeenCalledWith(1);
    });
  }, 20000);

  it('自动排程失败时页面仍可继续操作', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue(strategyTemplates);
    mockedScheduleApi.autoSchedule.mockRejectedValueOnce(new Error('auto failed'));
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /自动排程/ }));

    const scheduleDialog = await screen.findByRole('dialog');
    const strategySelect = within(scheduleDialog).getByRole('combobox');
    fireEvent.mouseDown(strategySelect);
    const strategyOptions = await screen.findAllByText('默认策略 (默认)');
    await user.click(strategyOptions[strategyOptions.length - 1]);
    await user.click(within(scheduleDialog).getByRole('button', { name: /开始排程/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.autoSchedule).toHaveBeenCalledWith(1, 7);
    });
    expect(await screen.findByRole('button', { name: /导出/ })).toBeInTheDocument();
  }, 20000);

  it('自动排程切换非默认策略后会按新策略执行', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([
      ...strategyTemplates,
      {
        id: 8,
        name: '次选策略',
        is_default: false,
        sort_weights: '[]',
        constraints: '[]',
        eval_weights: '{}',
        temper_rules: '{}',
      },
    ]);
    renderWorkbench();

    await waitForLoaded();
    await user.click(screen.getByRole('button', { name: /自动排程/ }));

    const scheduleDialog = await screen.findByRole('dialog');
    const strategySelect = within(scheduleDialog).getByRole('combobox');
    fireEvent.mouseDown(strategySelect);
    await user.click(await screen.findByText('次选策略'));
    await user.click(within(scheduleDialog).getByRole('button', { name: /开始排程/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.autoSchedule).toHaveBeenCalledWith(1, 8);
    });
  }, 20000);
});

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { save } from '@tauri-apps/plugin-dialog';
import type {
  OperationLogEntry,
  PlanComparisonResult,
  PlanVersionItem,
  RiskAnalysis,
  SchedulePlan,
} from '../../types/schedule';
import { scheduleApi } from '../../services/scheduleApi';
import History from './index';

vi.mock('../../components/DeferredEChart', () => ({
  default: () => <div data-testid="deferred-echart" />,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('../../services/scheduleApi', () => ({
  scheduleApi: {
    getPlans: vi.fn(),
    getPlanVersions: vi.fn(),
    getOperationLogs: vi.fn(),
    rollbackPlanVersion: vi.fn(),
    comparePlans: vi.fn(),
    getRiskAnalysis: vi.fn(),
    exportCompareSequenceExcel: vi.fn(),
    exportCompareSequenceCsv: vi.fn(),
    getOperationLogEstimate: vi.fn(),
    exportPlanHistoryReport: vi.fn(),
  },
}));

const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedScheduleApi = scheduleApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const plans: SchedulePlan[] = [
  {
    id: 1,
    plan_no: 'P-001',
    name: '当前方案',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    status: 'saved',
    version: 2,
    total_count: 10,
    total_weight: 100,
    score_overall: 86,
  },
  {
    id: 2,
    plan_no: 'P-002',
    name: '历史方案',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    status: 'archived',
    version: 1,
    total_count: 9,
    total_weight: 92,
    score_overall: 82,
  },
];

const versions: PlanVersionItem[] = [
  {
    plan_id: 1,
    plan_no: 'P-001',
    name: '当前方案',
    version: 2,
    status: 'saved',
    score_overall: 86,
    total_count: 10,
    total_weight: 100,
    roll_change_count: 2,
    risk_high: 1,
    risk_medium: 2,
    risk_low: 1,
    created_at: '2026-02-13T08:00:00Z',
    updated_at: '2026-02-13T08:00:00Z',
  },
  {
    plan_id: 2,
    plan_no: 'P-002',
    name: '历史方案',
    version: 1,
    status: 'archived',
    score_overall: 82,
    total_count: 9,
    total_weight: 92,
    roll_change_count: 3,
    risk_high: 2,
    risk_medium: 2,
    risk_low: 2,
    created_at: '2026-02-12T08:00:00Z',
    updated_at: '2026-02-12T08:00:00Z',
  },
];

const logs: OperationLogEntry[] = [
  {
    id: 1001,
    log_type: 'plan',
    action: 'save',
    target_type: 'plan',
    target_id: 1,
    detail: '保存当前方案',
    created_at: '2026-02-13T08:30:00Z',
  },
];

const buildLogs = (count: number): OperationLogEntry[] =>
  Array.from({ length: count }).map((_, index) => ({
    id: 1000 + index,
    log_type: 'plan',
    action: 'save',
    target_type: 'plan',
    target_id: 1,
    detail: `保存记录-${index + 1}`,
    created_at: '2026-02-13T08:30:00Z',
  }));

const compareResult: PlanComparisonResult = {
  plan_a: {
    plan_id: 1,
    plan_name: '当前方案',
    plan_no: 'P-001',
    status: 'saved',
    score_overall: 86,
    score_sequence: 84,
    score_delivery: 83,
    score_efficiency: 88,
    total_count: 10,
    total_weight: 100,
    roll_change_count: 2,
    risk_high: 1,
    risk_medium: 2,
    risk_low: 1,
    steel_grade_switches: 4,
    created_at: '2026-02-13T08:00:00Z',
  },
  plan_b: {
    plan_id: 2,
    plan_name: '历史方案',
    plan_no: 'P-002',
    status: 'archived',
    score_overall: 82,
    score_sequence: 80,
    score_delivery: 81,
    score_efficiency: 84,
    total_count: 9,
    total_weight: 92,
    roll_change_count: 3,
    risk_high: 2,
    risk_medium: 2,
    risk_low: 2,
    steel_grade_switches: 5,
    created_at: '2026-02-12T08:00:00Z',
  },
  common_count: 1,
  only_a_count: 0,
  only_b_count: 0,
  common_coils: ['C-001'],
  only_a_coils: [],
  only_b_coils: [],
  sequence_changes: [],
};

const riskTemplate: RiskAnalysis = {
  plan_id: 1,
  plan_name: '当前方案',
  score_overall: 86,
  score_sequence: 84,
  score_delivery: 83,
  score_efficiency: 88,
  total_count: 10,
  total_weight: 100,
  roll_change_count: 2,
  risk_high: 1,
  risk_medium: 2,
  risk_low: 1,
  violations: [],
  width_jumps: [],
  shift_summary: [],
  temp_distribution: { ready: 8, waiting: 2, unknown: 0 },
  due_risk_distribution: { overdue: 1, in3: 0, in7: 1, later: 0 },
  overdue_count: 1,
  steel_grade_switches: 4,
};

function renderHistory(initialUrl = '/history?planId=1') {
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/history" element={<History />} />
        <Route path="/" element={<div>工作台页</div>} />
        <Route path="/compare" element={<div>对比页</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('History 版本追溯', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedScheduleApi.getPlans.mockResolvedValue(plans);
    mockedScheduleApi.getPlanVersions.mockResolvedValue(versions);
    mockedScheduleApi.getOperationLogs.mockResolvedValue(logs);
    mockedScheduleApi.rollbackPlanVersion.mockResolvedValue(undefined);
    mockedScheduleApi.comparePlans.mockResolvedValue(compareResult);
    mockedScheduleApi.getRiskAnalysis.mockResolvedValue(riskTemplate);
    mockedScheduleApi.exportCompareSequenceExcel.mockResolvedValue(0);
    mockedScheduleApi.exportCompareSequenceCsv.mockResolvedValue(0);
    mockedScheduleApi.getOperationLogEstimate.mockResolvedValue({
      count: 1,
      cap: 2000,
      capped: false,
    });
    mockedScheduleApi.exportPlanHistoryReport.mockResolvedValue(1);
    mockedSave.mockResolvedValue('/tmp/history-report.csv');
  });

  it('happy path: 加载历史页后展示版本与日志信息', async () => {
    renderHistory();

    expect(await screen.findByText('版本时间线')).toBeInTheDocument();
    expect(await screen.findByText(/操作日志 \(1条记录\)/)).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedScheduleApi.getPlanVersions).toHaveBeenCalledWith(1);
    });
  });

  it('happy path: 点击版本对比跳转到对比页', async () => {
    const user = userEvent.setup();
    renderHistory();

    await screen.findByText('版本时间线', {}, { timeout: 10000 });
    const compareButton = await screen.findByRole(
      'button',
      { name: /版本对比/ },
      { timeout: 10000 }
    );
    await waitFor(() => expect(compareButton).toBeEnabled(), { timeout: 10000 });
    await user.click(compareButton);

    expect(await screen.findByText('对比页')).toBeInTheDocument();
  }, 15000);

  it('fail path: 导出报告选择路径取消时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce(null);
    renderHistory();

    await screen.findByText('版本时间线');
    await user.click(screen.getByRole('button', { name: /导出报告/ }));

    const exportDialog = await screen.findByRole('dialog');
    const confirmButton = within(exportDialog).getByRole('button', { name: /选择路径并导出/ });
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    await user.click(confirmButton);

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportPlanHistoryReport).not.toHaveBeenCalled();
  }, 20000);

  it('fail path: 导出预览日志估算失败时回退到当前日志数', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getOperationLogs.mockResolvedValue(buildLogs(5));
    mockedScheduleApi.getOperationLogEstimate.mockRejectedValueOnce(new Error('estimate failed'));
    renderHistory();

    await screen.findByText(/操作日志 \(5条记录\)/);
    await user.click(screen.getByRole('button', { name: /导出报告/ }));

    const exportDialog = await screen.findByRole('dialog');
    expect(await within(exportDialog).findByText(/logs.*5/)).toBeInTheDocument();
  }, 20000);

  it('fail path: 导出报告接口失败时仍保持页面可用', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce('/tmp/history-report.csv');
    mockedScheduleApi.exportPlanHistoryReport.mockRejectedValueOnce(new Error('export failed'));
    renderHistory();

    await screen.findByText('版本时间线');
    await user.click(screen.getByRole('button', { name: /导出报告/ }));
    const exportDialog = await screen.findByRole('dialog');
    const confirmButton = within(exportDialog).getByRole('button', { name: /选择路径并导出/ });
    await waitFor(() => {
      expect(confirmButton).toBeEnabled();
    });
    await user.click(confirmButton);
    await waitFor(() => {
      expect(mockedScheduleApi.exportPlanHistoryReport).toHaveBeenCalledWith(
        1,
        '/tmp/history-report.csv'
      );
    });
    expect(await screen.findByText('版本时间线')).toBeInTheDocument();
  }, 20000);

  it('fail path: 导出顺序差异 CSV 取消选择路径时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce(null);
    renderHistory();

    await screen.findByText('版本时间线');
    const exportCsvButton = await screen.findByRole('button', { name: /导出CSV/ });
    await waitFor(() => {
      expect(exportCsvButton).toBeEnabled();
    });
    await user.click(exportCsvButton);

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportCompareSequenceCsv).not.toHaveBeenCalled();
  }, 20000);

  it('fail path: 导出顺序差异 CSV 失败时页面仍可继续使用', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce('/tmp/history-sequence.csv');
    mockedScheduleApi.exportCompareSequenceCsv.mockRejectedValueOnce(
      new Error('sequence export failed')
    );
    renderHistory();

    await screen.findByText('版本时间线');
    const exportCsvButton = await screen.findByRole('button', { name: /导出CSV/ });
    await waitFor(() => {
      expect(exportCsvButton).toBeEnabled();
    });
    await user.click(exportCsvButton);

    await waitFor(() => {
      expect(mockedScheduleApi.exportCompareSequenceCsv).toHaveBeenCalledWith(
        1,
        2,
        '/tmp/history-sequence.csv'
      );
    });
    expect(await screen.findByText('版本顺序差异')).toBeInTheDocument();
  }, 20000);

  it('fail path: 导出报告预览日志触顶时展示已触顶标识', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getOperationLogEstimate.mockResolvedValueOnce({
      count: 2000,
      cap: 2000,
      capped: true,
    });
    renderHistory();

    await screen.findByText('版本时间线');
    await user.click(screen.getByRole('button', { name: /导出报告/ }));

    const exportDialog = await screen.findByRole('dialog');
    expect(await within(exportDialog).findByText(/logs\(已触顶\): 2000/)).toBeInTheDocument();
  }, 20000);

  it('happy path: 顺序差异支持筛选与双击定位', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.comparePlans.mockResolvedValue({
      ...compareResult,
      sequence_changes: [
        { coil_id: 'C-001', sequence_a: 1, sequence_b: 4, delta: 3 },
        { coil_id: 'C-002', sequence_a: 3, sequence_b: 2, delta: -1 },
      ],
    });
    renderHistory();

    // 等待版本对比完成
    await waitFor(() => {
      expect(mockedScheduleApi.comparePlans).toHaveBeenCalled();
    });

    const sequenceCardTitle = await screen.findByText('版本顺序差异');
    const sequenceCard = sequenceCardTitle.closest('.ant-card') as HTMLElement;
    expect(await within(sequenceCard).findByText('C-001')).toBeInTheDocument();
    expect(within(sequenceCard).getByText('C-002')).toBeInTheDocument();

    const moveFilter = within(sequenceCard).getByText('全部位移');
    fireEvent.mouseDown(moveFilter);
    await user.click(await screen.findByText('仅后移'));
    await waitFor(() => {
      expect(within(sequenceCard).queryByText('C-002')).not.toBeInTheDocument();
    });

    const thresholdInput = within(sequenceCard).getByRole('spinbutton');
    fireEvent.change(thresholdInput, { target: { value: '5' } });
    fireEvent.blur(thresholdInput);
    expect(await within(sequenceCard).findByText('两版本共同材料顺序无变化')).toBeInTheDocument();

    fireEvent.change(thresholdInput, { target: { value: '0' } });
    fireEvent.blur(thresholdInput);
    expect(await within(sequenceCard).findByText('C-001')).toBeInTheDocument();
    await user.dblClick(within(sequenceCard).getByText('C-001'));
    expect(await screen.findByText('工作台页')).toBeInTheDocument();
  }, 20000);

  it('happy path: 风险差异筛选与版本表点击可切换方案', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getRiskAnalysis
      .mockResolvedValueOnce({
        ...riskTemplate,
        violations: [
          {
            constraint_type: 'width_jump',
            severity: 'high',
            message: 'A',
            material_id: 101,
            coil_id: 'C-001',
            sequence: 1,
          },
        ],
      })
      .mockResolvedValueOnce({
        ...riskTemplate,
        violations: [
          {
            constraint_type: 'width_jump',
            severity: 'high',
            message: 'B',
            material_id: 101,
            coil_id: 'C-001',
            sequence: 1,
          },
          {
            constraint_type: 'width_jump',
            severity: 'medium',
            message: 'C',
            material_id: 102,
            coil_id: 'C-002',
            sequence: 2,
          },
        ],
      });
    renderHistory();

    const riskCardTitle = await screen.findByText('版本风险差异（按类型）');
    const riskCard = riskCardTitle.closest('.ant-card') as HTMLElement;
    expect(await within(riskCard).findByText('宽度跳跃')).toBeInTheDocument();

    const trendFilter = within(riskCard).getByText('全部变化');
    fireEvent.mouseDown(trendFilter);
    await user.click(await screen.findByText('仅看变差'));
    const riskThreshold = within(riskCard).getByRole('spinbutton');
    fireEvent.change(riskThreshold, { target: { value: '2' } });
    fireEvent.blur(riskThreshold);
    expect(
      await within(riskCard).findByText('当前与目标版本风险类型分布无差异')
    ).toBeInTheDocument();

    const versionCardTitle = await screen.findByText('版本历史 (2个版本)');
    const versionCard = versionCardTitle.closest('.ant-card') as HTMLElement;
    await user.click(within(versionCard).getByText('历史方案'));
    await waitFor(() => {
      expect(mockedScheduleApi.getPlanVersions).toHaveBeenLastCalledWith(2);
    });
  }, 20000);

  it('happy path: 刷新按钮可重新加载版本和日志', async () => {
    const user = userEvent.setup();
    renderHistory();

    await screen.findByText('版本时间线');

    // 清除之前的调用记录
    mockedScheduleApi.getPlanVersions.mockClear();
    mockedScheduleApi.getOperationLogs.mockClear();

    const refreshButton = screen.getByRole('button', { name: /刷新/ });
    await user.click(refreshButton);

    await waitFor(() => {
      expect(mockedScheduleApi.getPlanVersions).toHaveBeenCalled();
      expect(mockedScheduleApi.getOperationLogs).toHaveBeenCalled();
    });
  }, 15000);

  it('happy path: 版本时间线为空时显示空状态', async () => {
    mockedScheduleApi.getPlanVersions.mockResolvedValueOnce([]);
    renderHistory();

    await screen.findByText('版本时间线');
    expect(await screen.findByText('暂无版本时间线')).toBeInTheDocument();
  }, 15000);
});

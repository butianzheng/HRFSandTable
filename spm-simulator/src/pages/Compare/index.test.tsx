import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { save } from '@tauri-apps/plugin-dialog';
import type {
  MultiPlanComparisonResult,
  PlanComparisonResult,
  SchedulePlan,
} from '../../types/schedule';
import { scheduleApi } from '../../services/scheduleApi';
import Compare from './index';

vi.mock('../../components/DeferredEChart', () => ({
  default: () => <div data-testid="deferred-echart" />,
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('../../services/scheduleApi', () => ({
  scheduleApi: {
    getPlans: vi.fn(),
    comparePlans: vi.fn(),
    comparePlansMulti: vi.fn(),
    exportCompareSequenceCsv: vi.fn(),
    exportCompareSequenceExcel: vi.fn(),
  },
}));

const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedScheduleApi = scheduleApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const plans: SchedulePlan[] = [
  {
    id: 1,
    plan_no: 'P-001',
    name: '方案A',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    status: 'saved',
    score_overall: 82,
  },
  {
    id: 2,
    plan_no: 'P-002',
    name: '方案B',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    status: 'draft',
    score_overall: 78,
  },
  {
    id: 3,
    plan_no: 'P-003',
    name: '方案C',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    status: 'confirmed',
    score_overall: 88,
  },
];

const twoPlanResult: PlanComparisonResult = {
  plan_a: {
    plan_id: 1,
    plan_name: '方案A',
    plan_no: 'P-001',
    status: 'saved',
    score_overall: 82,
    score_sequence: 80,
    score_delivery: 79,
    score_efficiency: 87,
    total_count: 10,
    total_weight: 100,
    roll_change_count: 2,
    risk_high: 1,
    risk_medium: 2,
    risk_low: 3,
    steel_grade_switches: 4,
    created_at: '2026-02-13T00:00:00Z',
  },
  plan_b: {
    plan_id: 2,
    plan_name: '方案B',
    plan_no: 'P-002',
    status: 'draft',
    score_overall: 78,
    score_sequence: 77,
    score_delivery: 80,
    score_efficiency: 76,
    total_count: 9,
    total_weight: 92,
    roll_change_count: 3,
    risk_high: 2,
    risk_medium: 3,
    risk_low: 2,
    steel_grade_switches: 5,
    created_at: '2026-02-13T00:00:00Z',
  },
  common_count: 2,
  only_a_count: 1,
  only_b_count: 1,
  common_coils: ['C-001', 'C-002'],
  only_a_coils: ['C-003'],
  only_b_coils: ['C-004'],
  sequence_changes: [
    { coil_id: 'C-001', sequence_a: 1, sequence_b: 3, delta: 2 },
    { coil_id: 'C-002', sequence_a: 2, sequence_b: 1, delta: -1 },
  ],
};

const multiPlanResult: MultiPlanComparisonResult = {
  plans: [
    twoPlanResult.plan_a,
    twoPlanResult.plan_b,
    {
      plan_id: 3,
      plan_name: '方案C',
      plan_no: 'P-003',
      status: 'confirmed',
      score_overall: 88,
      score_sequence: 86,
      score_delivery: 90,
      score_efficiency: 88,
      total_count: 11,
      total_weight: 110,
      roll_change_count: 2,
      risk_high: 1,
      risk_medium: 1,
      risk_low: 2,
      steel_grade_switches: 3,
      created_at: '2026-02-13T00:00:00Z',
    },
  ],
  overlaps: [
    {
      plan_a_id: 1,
      plan_b_id: 2,
      common_count: 2,
      only_a_count: 1,
      only_b_count: 1,
    },
  ],
};

function renderCompare(url = '/compare?planA=1&planB=2') {
  render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/compare" element={<Compare />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Compare 对比视图', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedScheduleApi.getPlans.mockResolvedValue(plans);
    mockedScheduleApi.comparePlans.mockResolvedValue(twoPlanResult);
    mockedScheduleApi.comparePlansMulti.mockResolvedValue(multiPlanResult);
    mockedScheduleApi.exportCompareSequenceCsv.mockResolvedValue(2);
    mockedScheduleApi.exportCompareSequenceExcel.mockResolvedValue(2);
    mockedSave.mockResolvedValue('/tmp/compare.xlsx');
  });

  it('happy path: URL 传入双方案时自动完成对比', async () => {
    renderCompare('/compare?planA=1&planB=2');

    await waitFor(() => {
      expect(mockedScheduleApi.comparePlans).toHaveBeenCalledWith(1, 2);
    });
    expect(await screen.findByText('关键指标对比')).toBeInTheDocument();
    expect(screen.getByText(/材料清单 \(4卷\)/)).toBeInTheDocument();
  });

  it('happy path: URL 传入三方案时进入三方案模式', async () => {
    renderCompare('/compare?planA=1&planB=2&planC=3');

    await waitFor(() => {
      expect(mockedScheduleApi.comparePlansMulti).toHaveBeenCalledWith([1, 2, 3]);
    });
    expect(await screen.findByText('评分雷达对比(三方案)')).toBeInTheDocument();
    expect(screen.getByText('多方案指标明细')).toBeInTheDocument();
  });

  it('fail path: 对比接口失败时表格正常显示错误', async () => {
    mockedScheduleApi.comparePlans.mockRejectedValueOnce(new Error('server error'));
    renderCompare('/compare?planA=1&planB=2');

    await waitFor(() => {
      expect(mockedScheduleApi.comparePlans).toHaveBeenCalled();
    });
  });

  it('happy path: 无URL参数时显示空状态', async () => {
    renderCompare('/compare');

    expect(await screen.findByText('请选择两个方案进行对比')).toBeInTheDocument();
  });

  it('happy path: 交换按钮存在', async () => {
    renderCompare('/compare');

    await screen.findByText('方案 A:');
    const swapButton = screen.getByTitle('交换方案 A 和 B');
    expect(swapButton).toBeInTheDocument();
  });

  it('happy path: 两方案对比展示指标差异明细与推荐标签', async () => {
    renderCompare('/compare?planA=1&planB=2');

    await waitFor(() => {
      expect(mockedScheduleApi.comparePlans).toHaveBeenCalledWith(1, 2);
    });
    expect(await screen.findByText('指标差异明细')).toBeInTheDocument();
    expect(screen.getByText('推荐方案')).toBeInTheDocument();
    expect(screen.getByText('材料重叠分析')).toBeInTheDocument();
  });

  it('happy path: 两方案对比展示顺序变化明细与导出按钮', async () => {
    mockedScheduleApi.comparePlans.mockResolvedValue({
      ...twoPlanResult,
      sequence_changes: [{ coil_id: 'C-001', sequence_a: 1, sequence_b: 3, delta: 2 }],
    });
    renderCompare('/compare?planA=1&planB=2');

    await waitFor(() => {
      expect(mockedScheduleApi.comparePlans).toHaveBeenCalledWith(1, 2);
    });
    expect(await screen.findByText(/顺序变化明细/)).toBeInTheDocument();
    expect(screen.getByText('导出Excel')).toBeInTheDocument();
    expect(screen.getByText('导出CSV')).toBeInTheDocument();
  });

  it('happy path: 三方案对比展示成对重叠统计', async () => {
    renderCompare('/compare?planA=1&planB=2&planC=3');

    await waitFor(() => {
      expect(mockedScheduleApi.comparePlansMulti).toHaveBeenCalledWith([1, 2, 3]);
    });
    expect(await screen.findByText('方案成对重叠统计')).toBeInTheDocument();
  });
});

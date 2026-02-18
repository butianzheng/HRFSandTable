import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RiskAnalysis, SchedulePlan } from '../../types/schedule';
import type { StrategyTemplate } from '../../types/config';
import type { Material } from '../../types/material';
import { scheduleApi } from '../../services/scheduleApi';
import { configApi } from '../../services/configApi';
import { materialApi } from '../../services/materialApi';
import RiskOverview from './index';

vi.mock('../../components/DeferredEChart', () => ({
  default: () => <div data-testid="deferred-echart" />,
}));

vi.mock('../../services/scheduleApi', () => ({
  scheduleApi: {
    getPlans: vi.fn(),
    evaluateRisks: vi.fn(),
    getWaitingForecast: vi.fn(),
    applyRiskSuggestion: vi.fn(),
    getScheduleItems: vi.fn(),
  },
}));

vi.mock('../../services/configApi', () => ({
  configApi: {
    getStrategyTemplates: vi.fn(),
  },
}));

vi.mock('../../services/materialApi', () => ({
  materialApi: {
    getMaterials: vi.fn(),
  },
}));

const mockedScheduleApi = scheduleApi as unknown as {
  getPlans: ReturnType<typeof vi.fn>;
  evaluateRisks: ReturnType<typeof vi.fn>;
  getWaitingForecast: ReturnType<typeof vi.fn>;
  applyRiskSuggestion: ReturnType<typeof vi.fn>;
  getScheduleItems: ReturnType<typeof vi.fn>;
};
const mockedConfigApi = configApi as unknown as {
  getStrategyTemplates: ReturnType<typeof vi.fn>;
};
const mockedMaterialApi = materialApi as unknown as {
  getMaterials: ReturnType<typeof vi.fn>;
};

const plans: SchedulePlan[] = [
  {
    id: 1,
    plan_no: 'P-001',
    name: '测试方案',
    period_type: 'daily',
    start_date: '2026-02-01',
    end_date: '2026-02-01',
    strategy_id: 1,
    status: 'draft',
    score_overall: 88,
  },
];

const strategyTemplates: StrategyTemplate[] = [
  {
    id: 1,
    name: '风险控制策略',
    description: '强调交付与适温',
    sort_weights: JSON.stringify({
      priorities: [
        {
          field: 'temp_status',
          order: 'asc',
          weight: 100,
          enabled: true,
          group: true,
          description: '适温优先',
        },
      ],
    }),
    constraints: JSON.stringify({
      constraints: [
        {
          type: 'temp_status_filter',
          name: '适温状态',
          enabled: true,
          value: 1,
        },
      ],
    }),
    soft_constraints: JSON.stringify({
      constraints: [
        {
          type: 'contract_grouping',
          name: '合同集批',
          enabled: true,
          bonus: 2,
        },
      ],
    }),
    eval_weights: JSON.stringify({
      weights: {
        urgent_completion: { weight: 35 },
        tempered_ratio: { weight: 30 },
      },
    }),
    temper_rules: JSON.stringify({
      enabled: true,
      description: '按季节待温',
      seasons: {},
    }),
  },
];

const materials: Material[] = [
  {
    id: 101,
    coil_id: 'C101',
    steel_grade: 'Q235',
    thickness: 2.0,
    width: 1250,
    weight: 12,
    coiling_time: '2026-02-13T08:00:00Z',
    due_date: '2026-02-01',
    product_type: '热轧',
    contract_nature: '订单',
    export_flag: true,
    status: 'pending',
  },
  {
    id: 102,
    coil_id: 'C102',
    steel_grade: 'Q235',
    thickness: 2.5,
    width: 1300,
    weight: 8,
    coiling_time: '2026-02-17T08:00:00Z',
    due_date: '2026-02-07',
    product_type: '冷轧',
    contract_nature: '订单',
    export_flag: false,
    status: 'pending',
  },
];

const analysis: RiskAnalysis = {
  plan_id: 1,
  plan_name: '测试方案',
  score_overall: 88,
  score_sequence: 90,
  score_delivery: 82,
  score_efficiency: 84,
  total_count: 2,
  total_weight: 20,
  roll_change_count: 0,
  risk_high: 1,
  risk_medium: 1,
  risk_low: 0,
  violations: [
    {
      constraint_type: 'temp_status_filter',
      severity: 'high',
      message: '待温材料存在违规',
      material_id: 101,
      coil_id: 'C101',
      sequence: 1,
      due_bucket: 'overdue',
      due_date: '2026-02-01',
    },
    {
      constraint_type: 'width_jump',
      severity: 'medium',
      message: '宽度跳跃超限',
      material_id: 102,
      coil_id: 'C102',
      sequence: 2,
      due_bucket: 'in7',
      due_date: '2026-02-07',
    },
  ],
  width_jumps: [],
  thickness_jumps: [],
  shift_summary: [],
  temp_distribution: {
    ready: 1,
    waiting: 1,
    unknown: 0,
  },
  due_risk_distribution: {
    overdue: 1,
    in3: 0,
    in7: 1,
    later: 0,
  },
  overdue_count: 1,
  steel_grade_switches: 0,
};

function renderRiskPage(initialUrl = '/risk?planId=1') {
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/risk" element={<RiskOverview />} />
        <Route path="/settings" element={<div>设置页</div>} />
        <Route path="/" element={<div>工作台</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RiskOverview 交互回归', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedScheduleApi.getPlans.mockResolvedValue(plans);
    mockedScheduleApi.evaluateRisks.mockResolvedValue(analysis);
    mockedScheduleApi.getWaitingForecast.mockResolvedValue([]);
    mockedScheduleApi.applyRiskSuggestion.mockResolvedValue({
      risk_id: '0',
      changed: false,
      reason_code: 'no_change',
      constraint_type: 'temp_status_filter',
      material_id: 101,
      coil_id: 'C101',
      sequence: 1,
      action_note: 'no-op',
    });
    mockedScheduleApi.getScheduleItems.mockResolvedValue([
      {
        id: 1,
        plan_id: 1,
        material_id: 101,
        sequence: 1,
        shift_date: '2026-02-18',
        shift_no: 1,
        shift_type: 'day',
      },
    ]);
    mockedConfigApi.getStrategyTemplates.mockResolvedValue(strategyTemplates);
    mockedMaterialApi.getMaterials
      .mockResolvedValueOnce({
        items: [materials[0]],
        total: materials.length,
        page: 1,
        page_size: 1,
      })
      .mockResolvedValue({
        items: materials,
        total: materials.length,
        page: 1,
        page_size: materials.length,
      });
  });

  it('显示方案描述并包含策略参数摘要', async () => {
    renderRiskPage();

    expect(await screen.findByText('方案描述')).toBeInTheDocument();
    expect(screen.getByText('风险控制策略')).toBeInTheDocument();
    expect(screen.getByText(/排序 适温状态/)).toBeInTheDocument();
    expect(screen.getByText(/策略倾向/)).toBeInTheDocument();
    expect(screen.getByText('库存情况表')).toBeInTheDocument();
  });

  it('点击配置命中标签后会联动筛选风险清单', async () => {
    const user = userEvent.setup();
    renderRiskPage();

    const chip = await screen.findByText(/约束:适温状态\s+1/);
    await user.click(chip);

    expect(await screen.findByText('类型:适温状态')).toBeInTheDocument();
    expect(screen.getByText(/风险问题清单\s+\(1\/2项\)/)).toBeInTheDocument();
  });

  it('双击配置命中标签会跳转到配置页', async () => {
    const user = userEvent.setup();
    renderRiskPage();

    const chip = await screen.findByText(/交期:已超期\s+1/);
    await user.dblClick(chip);

    expect(await screen.findByText('设置页')).toBeInTheDocument();
  });

  it('支持从 URL 参数恢复筛选状态', async () => {
    renderRiskPage(
      '/risk?planId=1&riskSeverity=high&riskConstraint=temp_status_filter&riskDue=overdue&riskKeyword=%E5%BE%85%E6%B8%A9'
    );

    expect(await screen.findByText('严重度:高')).toBeInTheDocument();
    expect(screen.getByText('类型:适温状态')).toBeInTheDocument();
    expect(screen.getByText('交期:已超期')).toBeInTheDocument();
    expect(screen.getByText('关键词:待温')).toBeInTheDocument();
    expect(screen.getByText(/风险问题清单\s+\(1\/2项\)/)).toBeInTheDocument();
  });

  it('清空筛选会恢复风险列表', async () => {
    const user = userEvent.setup();
    renderRiskPage(
      '/risk?planId=1&riskSeverity=high&riskConstraint=temp_status_filter&riskDue=overdue&riskKeyword=%E5%BE%85%E6%B8%A9'
    );

    expect(await screen.findByText(/风险问题清单\s+\(1\/2项\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清空筛选' }));

    await waitFor(() => {
      expect(screen.queryByText('严重度:高')).not.toBeInTheDocument();
      expect(screen.queryByText('关键词:待温')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/风险问题清单\s+\(2项\)/)).toBeInTheDocument();
  });

  it('点击高风险统计可切换严重度筛选', async () => {
    const user = userEvent.setup();
    renderRiskPage();

    expect(await screen.findByText(/风险问题清单\s+\(2项\)/)).toBeInTheDocument();
    await user.click((await screen.findAllByText('高风险'))[0]);
    expect(await screen.findByText('严重度:高')).toBeInTheDocument();
    expect(screen.getByText(/风险问题清单\s+\(1\/2项\)/)).toBeInTheDocument();

    await user.click((await screen.findAllByText('高风险'))[0]);
    await waitFor(() => {
      expect(screen.queryByText('严重度:高')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/风险问题清单\s+\(2项\)/)).toBeInTheDocument();
  });

  it('点击逾期材料统计可切换交期筛选', async () => {
    const user = userEvent.setup();
    renderRiskPage();

    expect(await screen.findByText(/风险问题清单\s+\(2项\)/)).toBeInTheDocument();
    await user.click(await screen.findByText('逾期材料'));
    expect(await screen.findByText('交期:已超期')).toBeInTheDocument();
    expect(screen.getByText(/风险问题清单\s+\(1\/2项\)/)).toBeInTheDocument();

    await user.click(await screen.findByText('逾期材料'));
    await waitFor(() => {
      expect(screen.queryByText('交期:已超期')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/风险问题清单\s+\(2项\)/)).toBeInTheDocument();
  });

  it('一键处理高风险后可按未生效原因筛选并切换', async () => {
    const user = userEvent.setup();
    renderRiskPage();

    await screen.findByText(/风险问题清单\s+\(2项\)/);
    await user.click(screen.getByRole('button', { name: '一键处理高风险' }));

    expect(await screen.findByText('风险处理摘要（批量）')).toBeInTheDocument();
    const reasonTag = await screen.findByText(/无变化\s+1/);

    await user.click(reasonTag);
    expect(await screen.findByText('未生效原因:无变化')).toBeInTheDocument();

    await user.click(reasonTag);
    await waitFor(() => {
      expect(screen.queryByText('未生效原因:无变化')).not.toBeInTheDocument();
    });
  });

  it('fail path: 无排程数据时展示空状态提示', async () => {
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      total_count: 0,
      total_weight: 0,
      risk_high: 0,
      risk_medium: 0,
      risk_low: 0,
      violations: [],
      overdue_count: 0,
      temp_distribution: { ready: 0, waiting: 0, unknown: 0 },
      due_risk_distribution: { overdue: 0, in3: 0, in7: 0, later: 0 },
    });
    renderRiskPage();

    expect(await screen.findByText('请选择一个已完成排程的方案查看风险分析')).toBeInTheDocument();
  });

  it('happy path: 待温预测明细点击查看详情会跳转工作台', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getWaitingForecast.mockResolvedValueOnce([
      { ready_date: '2026-02-20', count: 3, total_weight: 28 },
    ]);
    renderRiskPage();

    await screen.findByText('待温预测明细 (7天)');
    await user.click(await screen.findByRole('button', { name: '查看详情' }));

    expect(await screen.findByText('工作台')).toBeInTheDocument();
  });

  it('happy path: 宽度跳跃定位按钮会跳转工作台', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      width_jumps: [
        {
          sequence: 2,
          coil_id: 'C102',
          prev_coil_id: 'C101',
          width_diff: 180,
          width: 1380,
          prev_width: 1200,
        },
      ],
    });
    renderRiskPage();

    const widthTitle = await screen.findByText(/宽度跳跃分析/);
    const widthCard = widthTitle.closest('.ant-card') as HTMLElement;
    await user.click(within(widthCard).getByRole('button', { name: '定位' }));

    expect(await screen.findByText('工作台')).toBeInTheDocument();
  });

  it('happy path: 宽度跳跃行双击会跳转工作台', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      width_jumps: [
        {
          sequence: 2,
          coil_id: 'C102',
          prev_coil_id: 'C101',
          width_diff: 180,
          width: 1380,
          prev_width: 1200,
        },
      ],
    });
    renderRiskPage();

    const widthTitle = await screen.findByText(/宽度跳跃分析/);
    const widthCard = widthTitle.closest('.ant-card') as HTMLElement;
    const row = within(widthCard).getByText('C102').closest('tr') as HTMLElement;
    await user.dblClick(row);

    expect(await screen.findByText('工作台')).toBeInTheDocument();
  });

  it('happy path: 宽度跳跃明细会显示换辊标记', async () => {
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      width_jumps: [
        {
          sequence: 2,
          coil_id: 'C102',
          prev_coil_id: 'C101',
          width_diff: 180,
          width: 1380,
          prev_width: 1200,
          is_roll_change_boundary: true,
        },
        {
          sequence: 3,
          coil_id: 'C103',
          prev_coil_id: 'C102',
          width_diff: 130,
          width: 1250,
          prev_width: 1380,
          is_roll_change_boundary: false,
        },
      ],
    });
    renderRiskPage();

    const widthTitle = await screen.findByText(/宽度跳跃分析/);
    const widthCard = widthTitle.closest('.ant-card') as HTMLElement;
    expect(within(widthCard).getByText('换辊边界')).toBeInTheDocument();
    expect(within(widthCard).getByText('非换辊')).toBeInTheDocument();
  });

  it('happy path: 可切换为仅看非换辊宽跳', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      width_jumps: [
        {
          sequence: 2,
          coil_id: 'C102',
          prev_coil_id: 'C101',
          width_diff: 180,
          width: 1380,
          prev_width: 1200,
          is_roll_change_boundary: true,
        },
        {
          sequence: 3,
          coil_id: 'C103',
          prev_coil_id: 'C102',
          width_diff: 130,
          width: 1250,
          prev_width: 1380,
          is_roll_change_boundary: false,
        },
      ],
    });
    renderRiskPage();

    const widthTitle = await screen.findByText(/宽度跳跃分析/);
    const widthCard = widthTitle.closest('.ant-card') as HTMLElement;
    expect(within(widthCard).getByText('宽度跳跃分析 (2处)')).toBeInTheDocument();

    const onlyNonRollCheckbox = within(widthCard).getByRole('checkbox', { name: '仅看非换辊宽跳' });
    await user.click(onlyNonRollCheckbox);

    expect(within(widthCard).getByText('宽度跳跃分析 (1/2处)')).toBeInTheDocument();
    expect(within(widthCard).getByText('C103')).toBeInTheDocument();
    expect(within(widthCard).getAllByRole('button', { name: '定位' })).toHaveLength(1);
  });

  it('happy path: 厚度跳跃定位按钮会跳转工作台', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      thickness_jumps: [
        {
          sequence: 3,
          coil_id: 'C201',
          prev_coil_id: 'C200',
          thickness_diff: 1.35,
          thickness: 3.25,
          prev_thickness: 1.9,
          is_roll_change_boundary: true,
        },
      ],
    });
    renderRiskPage();

    const thicknessTitle = await screen.findByText(/厚度跳跃分析/);
    const thicknessCard = thicknessTitle.closest('.ant-card') as HTMLElement;
    await user.click(within(thicknessCard).getByRole('button', { name: '定位' }));

    expect(await screen.findByText('工作台')).toBeInTheDocument();
  });

  it('happy path: 可切换为仅看非换辊厚跳', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce({
      ...analysis,
      thickness_jumps: [
        {
          sequence: 3,
          coil_id: 'C201',
          prev_coil_id: 'C200',
          thickness_diff: 1.35,
          thickness: 3.25,
          prev_thickness: 1.9,
          is_roll_change_boundary: true,
        },
        {
          sequence: 4,
          coil_id: 'C202',
          prev_coil_id: 'C201',
          thickness_diff: 1.1,
          thickness: 2.15,
          prev_thickness: 3.25,
          is_roll_change_boundary: false,
        },
      ],
    });
    renderRiskPage();

    const thicknessTitle = await screen.findByText(/厚度跳跃分析/);
    const thicknessCard = thicknessTitle.closest('.ant-card') as HTMLElement;
    expect(within(thicknessCard).getByText('厚度跳跃分析 (2处)')).toBeInTheDocument();

    const onlyNonRollCheckbox = within(thicknessCard).getByRole('checkbox', {
      name: '仅看非换辊厚跳',
    });
    await user.click(onlyNonRollCheckbox);

    expect(within(thicknessCard).getByText('厚度跳跃分析 (1/2处)')).toBeInTheDocument();
    expect(within(thicknessCard).getByText('C202')).toBeInTheDocument();
    expect(within(thicknessCard).getAllByRole('button', { name: '定位' })).toHaveLength(1);
  });

  it('happy path: 风险清单行双击会跳转工作台', async () => {
    const user = userEvent.setup();
    renderRiskPage();

    const listTitle = await screen.findByText(/风险问题清单/);
    const listCard = listTitle.closest('.ant-card') as HTMLElement;
    const row = within(listCard).getByText('待温材料存在违规').closest('tr') as HTMLElement;
    await user.dblClick(row);

    expect(await screen.findByText('工作台')).toBeInTheDocument();
  });

  it('happy path: 单条应用建议生效后会展示单条摘要', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.evaluateRisks.mockResolvedValueOnce(analysis).mockResolvedValueOnce({
      ...analysis,
      total_count: 1,
      risk_high: 0,
      risk_medium: 1,
      violations: [analysis.violations[1]],
    });
    mockedScheduleApi.applyRiskSuggestion.mockResolvedValueOnce({
      risk_id: '0',
      changed: true,
      reason_code: 'none',
      constraint_type: 'temp_status_filter',
      material_id: 101,
      coil_id: 'C101',
      sequence: 1,
      action_note: 'moved',
    });
    renderRiskPage();

    await screen.findByText(/风险问题清单/);
    const applyButtons = await screen.findAllByRole('button', { name: '应用' });
    await user.click(applyButtons[0]);

    // Popconfirm 弹出后，点击"确认应用"
    const confirmBtn = await screen.findByRole('button', { name: '确认应用' });
    await user.click(confirmBtn);

    expect(await screen.findByText('风险处理摘要（单条）')).toBeInTheDocument();
    expect(screen.getByText(/生效 1/)).toBeInTheDocument();
  }, 10000);
});

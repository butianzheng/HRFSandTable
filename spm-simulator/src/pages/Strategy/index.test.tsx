import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { open, save } from '@tauri-apps/plugin-dialog';
import { configApi } from '../../services/configApi';
import Strategy from './index';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../../services/configApi', () => ({
  configApi: {
    getStrategyTemplates: vi.fn(),
    createStrategyTemplate: vi.fn(),
    updateStrategyTemplate: vi.fn(),
    deleteStrategyTemplate: vi.fn(),
    setDefaultStrategy: vi.fn(),
    exportStrategyTemplate: vi.fn(),
    importStrategyTemplate: vi.fn(),
  },
}));

const mockedOpen = open as unknown as ReturnType<typeof vi.fn>;
const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedConfigApi = configApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const templates = [
  {
    id: 1,
    name: '默认策略',
    description: '系统内置模板',
    is_default: true,
    is_system: true,
    sort_weights: JSON.stringify({
      priorities: [
        {
          field: 'temp_status',
          order: 'asc',
          weight: 100,
          enabled: true,
          group: false,
          description: '适温优先',
          is_prerequisite: true,
        },
      ],
    }),
    constraints: JSON.stringify({
      constraints: [
        {
          type: 'width_jump',
          name: '宽度跳跃',
          enabled: true,
          max_value: 120,
          unit: 'mm',
        },
      ],
    }),
    soft_constraints: JSON.stringify({
      constraints: [
        {
          type: 'batch_cluster',
          name: '集批聚合',
          enabled: true,
          bonus: 2,
        },
      ],
    }),
    eval_weights: JSON.stringify({
      weights: {
        width_jump_count: { weight: 20, description: '宽跳' },
        roll_change_count: { weight: 20, description: '换辊' },
        capacity_utilization: { weight: 20, description: '产能' },
        tempered_ratio: { weight: 20, description: '适温' },
        urgent_completion: { weight: 20, description: '紧急' },
      },
    }),
    temper_rules: JSON.stringify({
      enabled: true,
      description: '按季节规则计算',
      seasons: {
        spring: { months: [3, 4, 5], min_days: 3, description: '春季待温' },
      },
    }),
  },
  {
    id: 2,
    name: '自定义策略',
    description: '用于验证编辑/设默认',
    is_default: false,
    is_system: false,
    sort_weights: JSON.stringify({
      priorities: [
        {
          field: 'priority',
          order: 'desc',
          weight: 100,
          enabled: true,
          group: false,
          description: '优先级优先',
          is_prerequisite: false,
        },
      ],
    }),
    constraints: JSON.stringify({
      constraints: [
        {
          type: 'width_jump',
          name: '宽度跳跃',
          enabled: true,
          max_value: 150,
          unit: 'mm',
        },
      ],
    }),
    soft_constraints: JSON.stringify({
      constraints: [
        {
          type: 'batch_cluster',
          name: '集批聚合',
          enabled: true,
          bonus: 1,
        },
      ],
    }),
    eval_weights: JSON.stringify({
      weights: {
        width_jump_count: { weight: 20, description: '宽跳' },
        roll_change_count: { weight: 20, description: '换辊' },
        capacity_utilization: { weight: 20, description: '产能' },
        tempered_ratio: { weight: 20, description: '适温' },
        urgent_completion: { weight: 20, description: '紧急' },
      },
    }),
    temper_rules: JSON.stringify({
      enabled: true,
      description: '按季节规则计算',
      seasons: {
        spring: { months: [3, 4, 5], min_days: 3, description: '春季待温' },
      },
    }),
  },
];

describe('Strategy 模板管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue(templates);
    mockedConfigApi.createStrategyTemplate.mockResolvedValue({
      ...templates[1],
      id: 3,
      name: '新策略',
    });
    mockedConfigApi.updateStrategyTemplate.mockResolvedValue(templates[1]);
    mockedConfigApi.deleteStrategyTemplate.mockResolvedValue(undefined);
    mockedConfigApi.setDefaultStrategy.mockImplementation(async (id: number) => {
      if (id === 3) {
        return { ...templates[1], id: 3, name: '新策略', is_default: true };
      }
      return templates.find((item) => item.id === id) ?? templates[0];
    });
    mockedConfigApi.exportStrategyTemplate.mockResolvedValue(undefined);
    mockedConfigApi.importStrategyTemplate.mockResolvedValue({
      ...templates[0],
      id: 9,
      name: '导入模板',
    });
    mockedOpen.mockResolvedValue('/tmp/strategy-template.json');
    mockedSave.mockResolvedValue('/tmp/strategy-template-export.json');
  });

  it('happy path: 加载模板后展示策略详情', async () => {
    render(<Strategy />);

    expect(await screen.findByText('策略模板')).toBeInTheDocument();
    expect(await screen.findByText('默认策略')).toBeInTheDocument();
    expect(await screen.findByText('策略详情 — 默认策略')).toBeInTheDocument();
    expect(mockedConfigApi.getStrategyTemplates).toHaveBeenCalled();
  }, 15000);

  it('fail path: 初始加载失败时页面仍可新建策略', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockRejectedValueOnce(new Error('load failed'));
    render(<Strategy />);

    expect(await screen.findByText('策略模板')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /新建/ }));
    expect(await screen.findByText('新建策略模板')).toBeInTheDocument();
  }, 15000);

  it('happy path: 点击导入会调用导入接口', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导入/ }));

    await waitFor(() => {
      expect(mockedConfigApi.importStrategyTemplate).toHaveBeenCalledWith(
        '/tmp/strategy-template.json'
      );
    });
  }, 15000);

  it('fail path: 导入失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedConfigApi.importStrategyTemplate.mockRejectedValueOnce(new Error('import failed'));
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导入/ }));

    await waitFor(() => {
      expect(mockedConfigApi.importStrategyTemplate).toHaveBeenCalledWith(
        '/tmp/strategy-template.json'
      );
    });
    expect(screen.getByText('策略模板')).toBeInTheDocument();
  }, 15000);

  it('happy path: 点击导出会调用导出接口', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导出/ }));

    await waitFor(() => {
      expect(mockedConfigApi.exportStrategyTemplate).toHaveBeenCalledWith(
        1,
        '/tmp/strategy-template-export.json'
      );
    });
  }, 15000);

  it('fail path: 导出选择取消时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce(null);
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导出/ }));

    await waitFor(() => {
      expect(mockedConfigApi.exportStrategyTemplate).not.toHaveBeenCalled();
    });
  }, 15000);

  it('fail path: 无可选模板时点击导出不会触发导出接口', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([]);
    render(<Strategy />);

    await screen.findByText('策略模板');
    await user.click(await screen.findByRole('button', { name: /导出/ }));

    await waitFor(() => {
      expect(mockedSave).not.toHaveBeenCalled();
      expect(mockedConfigApi.exportStrategyTemplate).not.toHaveBeenCalled();
    });
  }, 15000);

  it('fail path: 导出接口失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedConfigApi.exportStrategyTemplate.mockRejectedValueOnce(new Error('export failed'));
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导出/ }));

    await waitFor(() => {
      expect(mockedConfigApi.exportStrategyTemplate).toHaveBeenCalledWith(
        1,
        '/tmp/strategy-template-export.json'
      );
    });
    expect(screen.getByText('策略模板')).toBeInTheDocument();
  }, 15000);

  it('fail path: 创建模板接口异常时保持弹窗可继续编辑', async () => {
    const user = userEvent.setup();
    mockedConfigApi.createStrategyTemplate.mockRejectedValueOnce(new Error('create failed'));
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const modal = await screen.findByRole('dialog');
    const nameInput = within(modal).getByPlaceholderText('如：宽幅板优先策略');
    await user.type(nameInput, '创建失败策略');
    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).toHaveBeenCalled();
    });
    expect(screen.getByText('新建策略模板')).toBeInTheDocument();
  }, 15000);

  it('happy path: 新建并设为默认会调用创建和设默认接口', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const nameInput = await screen.findByPlaceholderText('如：宽幅板优先策略');
    await user.type(nameInput, '测试新策略');
    await user.click(await screen.findByRole('switch', { name: /设为默认模板/ }));
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ name: '测试新策略' })
      );
      expect(mockedConfigApi.setDefaultStrategy).toHaveBeenCalledWith(3);
    });
  }, 15000);

  it('happy path: 编辑模板后保存会调用更新接口', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(templateItem!);
    await user.click(await screen.findByRole('button', { name: /编辑/ }));
    const nameInput = await screen.findByDisplayValue('自定义策略');
    await user.clear(nameInput);
    await user.type(nameInput, '自定义策略-已更新');
    const modal = await screen.findByRole('dialog');
    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.updateStrategyTemplate).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ name: '自定义策略-已更新' })
      );
    });
  }, 15000);

  it('happy path: 列表编辑图标可直接打开编辑弹窗', async () => {
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(within(templateItem! as HTMLElement).getByRole('img', { name: 'edit' }));

    expect(await screen.findByRole('dialog', { name: '编辑策略模板' })).toBeInTheDocument();
  }, 15000);

  it('happy path: 复制模板会预填副本名称且可取消关闭弹窗', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(within(templateItem! as HTMLElement).getByRole('img', { name: 'copy' }));

    const modal = await screen.findByRole('dialog');
    expect(await within(modal).findByDisplayValue('自定义策略 - 副本')).toBeInTheDocument();
    await user.click(within(modal).getByRole('button', { name: /取消|cancel/i }));

    await waitFor(() => {
      expect(screen.queryByText('新建策略模板')).not.toBeInTheDocument();
    });
  }, 15000);

  it('fail path: 导入取消时不会调用导入接口', async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce(null);
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导入/ }));

    await waitFor(() => {
      expect(mockedConfigApi.importStrategyTemplate).not.toHaveBeenCalled();
    });
  }, 15000);

  it('fail path: 导入返回数组路径时不会调用导入接口', async () => {
    const user = userEvent.setup();
    mockedOpen.mockResolvedValueOnce(['/tmp/a.json', '/tmp/b.json']);
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /导入/ }));

    await waitFor(() => {
      expect(mockedConfigApi.importStrategyTemplate).not.toHaveBeenCalled();
    });
  }, 15000);

  it('fail path: 设为默认失败时页面保持可用', async () => {
    userEvent.setup();
    mockedConfigApi.setDefaultStrategy.mockRejectedValueOnce(new Error('set default failed'));
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(within(templateItem! as HTMLElement).getByRole('img', { name: 'star' }));

    await waitFor(() => {
      expect(mockedConfigApi.setDefaultStrategy).toHaveBeenCalledWith(2);
    });
    expect(screen.getByText('策略模板')).toBeInTheDocument();
  }, 15000);

  it('happy path: 删除模板会调用删除接口', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(within(templateItem! as HTMLElement).getByRole('img', { name: 'delete' }));
    await user.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteStrategyTemplate).toHaveBeenCalledWith(2);
    });
  }, 15000);

  it('fail path: 删除确认取消时不会触发删除接口', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(within(templateItem! as HTMLElement).getByRole('img', { name: 'delete' }));
    await user.click(await screen.findByRole('button', { name: /取消|cancel/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteStrategyTemplate).not.toHaveBeenCalled();
    });
  }, 15000);

  it('fail path: 删除失败时页面仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedConfigApi.deleteStrategyTemplate.mockRejectedValueOnce(new Error('delete failed'));
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(within(templateItem! as HTMLElement).getByRole('img', { name: 'delete' }));
    await user.click(await screen.findByRole('button', { name: /确定|ok|确认/i }));

    await waitFor(() => {
      expect(mockedConfigApi.deleteStrategyTemplate).toHaveBeenCalledWith(2);
    });
    expect(screen.getByText('策略模板')).toBeInTheDocument();
  }, 15000);

  it('fail path: 评估权重总和不为100时不会创建模板', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByPlaceholderText('如：宽幅板优先策略'), '评估校验策略');
    await user.click(within(modal).getByRole('tab', { name: '评估权重' }));
    const spinButtons = within(modal).getAllByRole('spinbutton');
    fireEvent.change(spinButtons[0], { target: { value: '10' } });
    fireEvent.blur(spinButtons[0]);

    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).not.toHaveBeenCalled();
    });
    expect(screen.getByText('新建策略模板')).toBeInTheDocument();
  }, 15000);

  it('fail path: 无启用排序规则时不会创建模板', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValueOnce([]);
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByPlaceholderText('如：宽幅板优先策略'), '无排序策略');
    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).not.toHaveBeenCalled();
    });
    expect(screen.getByText('新建策略模板')).toBeInTheDocument();
  }, 15000);

  it('fail path: 硬约束阈值不大于0时不会创建模板', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByPlaceholderText('如：宽幅板优先策略'), '硬约束校验策略');
    await user.click(within(modal).getByRole('tab', { name: '硬约束' }));

    const widthJumpCell = await within(modal).findByText('宽度跳跃');
    const widthJumpRow = widthJumpCell.closest('tr');
    if (!widthJumpRow) {
      throw new Error('硬约束行未找到');
    }
    const thresholdInput = within(widthJumpRow).getByRole('spinbutton');
    fireEvent.change(thresholdInput, { target: { value: '0' } });
    fireEvent.blur(thresholdInput);

    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).not.toHaveBeenCalled();
    });
    expect(screen.getByText('新建策略模板')).toBeInTheDocument();
  }, 15000);

  it('happy path: 排序权重调序按钮会交换优先级顺序', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([
      {
        ...templates[0],
        sort_weights: JSON.stringify({
          priorities: [
            {
              field: 'temp_status',
              order: 'asc',
              weight: 70,
              enabled: true,
              group: false,
              description: '适温优先',
              is_prerequisite: true,
            },
            {
              field: 'priority',
              order: 'desc',
              weight: 30,
              enabled: true,
              group: false,
              description: '优先级优先',
              is_prerequisite: false,
            },
          ],
        }),
      },
      templates[1],
    ]);
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByPlaceholderText('如：宽幅板优先策略'), '排序调序策略');

    const downIcons = within(modal).getAllByRole('img', { name: 'arrow-down' });
    const firstDownBtn = downIcons[0].closest('button');
    if (!firstDownBtn) {
      throw new Error('调序按钮未找到');
    }
    fireEvent.click(firstDownBtn);
    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).toHaveBeenCalled();
    });
    const payload = mockedConfigApi.createStrategyTemplate.mock.calls[0][0];
    const priorities = JSON.parse(payload.sort_weights).priorities;
    expect(priorities[0].field).toBe('priority');
  }, 15000);

  it('happy path: 新建时编辑软约束后保存会写入最新配置且适温规则保持原值', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('button', { name: /新建/ }));
    const modal = await screen.findByRole('dialog');
    await user.type(within(modal).getByPlaceholderText('如：宽幅板优先策略'), '软约束适温策略');

    await user.click(within(modal).getByRole('tab', { name: '软约束' }));
    const softCell = await within(modal).findByText('集批聚合');
    const softRow = softCell.closest('tr');
    if (!softRow) {
      throw new Error('软约束行未找到');
    }
    const softScoreInput = within(softRow).getByRole('spinbutton');
    fireEvent.change(softScoreInput, { target: { value: '9' } });
    fireEvent.blur(softScoreInput);

    await user.click(within(modal).getByRole('tab', { name: '适温规则' }));
    expect(
      within(modal).getByText('适温参数已归并到设置中心 > 适温参数，策略配置中仅展示。')
    ).toBeInTheDocument();

    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.createStrategyTemplate).toHaveBeenCalled();
    });

    const payload = mockedConfigApi.createStrategyTemplate.mock.calls[0][0];
    const softConstraints = JSON.parse(payload.soft_constraints).constraints;
    expect(
      softConstraints.find(
        (item: { type: string; bonus?: number }) => item.type === 'batch_cluster'
      )?.bonus
    ).toBe(9);
    const temperRules = JSON.parse(payload.temper_rules);
    expect(temperRules.description).toBe('按季节规则计算');
    expect(temperRules.seasons.spring.min_days).toBe(3);
    expect(temperRules.seasons.spring.description).toBe('春季待温');
  }, 15000);

  it('fail path: 编辑异常模板JSON时会回退为空配置并阻止保存', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([
      templates[0],
      {
        ...templates[1],
        sort_weights: '{bad-json',
        constraints: '{bad-json',
        soft_constraints: '{bad-json',
        eval_weights: '{bad-json',
        temper_rules: '{bad-json',
      },
    ]);
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(templateItem!);
    await user.click(await screen.findByRole('button', { name: /编辑/ }));
    const modal = await screen.findByRole('dialog', { name: '编辑策略模板' });

    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));
    await waitFor(() => {
      expect(mockedConfigApi.updateStrategyTemplate).not.toHaveBeenCalled();
    });
    expect(screen.getByText('编辑策略模板')).toBeInTheDocument();
  }, 15000);

  it('happy path: 编辑时历史适温规则异常也不影响保存', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([
      templates[0],
      {
        ...templates[1],
        temper_rules: JSON.stringify({
          enabled: true,
          description: '异常适温',
          seasons: {
            spring: { months: [3, 4, 5], min_days: 31, description: '超上限' },
          },
        }),
      },
    ]);
    render(<Strategy />);

    const templateName = await screen.findByText('自定义策略');
    const templateItem = templateName.closest('.ant-list-item');
    expect(templateItem).toBeTruthy();
    fireEvent.click(templateItem!);
    await user.click(await screen.findByRole('button', { name: /编辑/ }));
    const modal = await screen.findByRole('dialog');

    await user.click(within(modal).getByRole('button', { name: /确定|ok/i }));

    await waitFor(() => {
      expect(mockedConfigApi.updateStrategyTemplate).toHaveBeenCalled();
    });
  }, 15000);

  it('happy path: 适温规则详情会展示季节配置', async () => {
    const user = userEvent.setup();
    render(<Strategy />);

    await user.click(await screen.findByRole('tab', { name: '适温规则' }));

    expect(await screen.findByText('季节配置')).toBeInTheDocument();
    expect(await screen.findByText('春季')).toBeInTheDocument();
  }, 15000);

  it('fail path: 适温规则解析失败时展示空配置提示', async () => {
    const user = userEvent.setup();
    mockedConfigApi.getStrategyTemplates.mockResolvedValue([
      {
        ...templates[0],
        temper_rules: 'invalid-temper-rules',
      },
    ]);
    render(<Strategy />);

    await user.click(await screen.findByRole('tab', { name: '适温规则' }));

    expect(await screen.findByText('无适温规则配置')).toBeInTheDocument();
  }, 15000);
});

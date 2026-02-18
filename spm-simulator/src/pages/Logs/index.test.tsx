import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { save } from '@tauri-apps/plugin-dialog';
import type { OperationLogEntry } from '../../types/schedule';
import { scheduleApi } from '../../services/scheduleApi';
import Logs from './index';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(),
}));

vi.mock('../../services/scheduleApi', () => ({
  scheduleApi: {
    getOperationLogs: vi.fn(),
    exportLogs: vi.fn(),
    exportLogsExcel: vi.fn(),
  },
}));

const mockedSave = save as unknown as ReturnType<typeof vi.fn>;
const mockedScheduleApi = scheduleApi as unknown as Record<string, ReturnType<typeof vi.fn>>;

const logs: OperationLogEntry[] = [
  {
    id: 1,
    log_type: 'plan',
    action: 'create',
    target_type: 'plan',
    target_id: 101,
    detail: '创建方案 A',
    created_at: '2026-02-13T08:00:00Z',
  },
  {
    id: 2,
    log_type: 'schedule',
    action: 'auto_schedule',
    target_type: 'plan',
    target_id: 101,
    detail: '自动排程完成',
    created_at: '2026-02-13T09:00:00Z',
  },
];

const buildLogs = (count: number): OperationLogEntry[] => (
  Array.from({ length: count }).map((_, index) => ({
    id: index + 1,
    log_type: index % 2 === 0 ? 'plan' : 'schedule',
    action: index % 2 === 0 ? 'create' : 'auto_schedule',
    target_type: 'plan',
    target_id: 100 + index,
    detail: `日志-${index + 1}`,
    created_at: '2026-02-13T08:00:00Z',
  }))
);

describe('Logs 日志管理', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedScheduleApi.getOperationLogs.mockResolvedValue(logs);
    mockedScheduleApi.exportLogs.mockResolvedValue(2);
    mockedScheduleApi.exportLogsExcel.mockResolvedValue(2);
    mockedSave.mockResolvedValue('/tmp/logs.csv');
  });

  it('happy path: 页面加载后展示日志统计与明细', async () => {
    render(<Logs />);

    expect(await screen.findByText('日志总数')).toBeInTheDocument();
    expect(await screen.findByText('创建方案 A')).toBeInTheDocument();
    expect(mockedScheduleApi.getOperationLogs).toHaveBeenCalledTimes(1);
  });

  it('happy path: 点击导出CSV会调用后端导出', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    await user.click(await screen.findByRole('button', { name: /导出CSV/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.exportLogs).toHaveBeenCalledWith('/tmp/logs.csv', {
        log_type: undefined,
        action: undefined,
        start_time: undefined,
        end_time: undefined,
      });
    });
  });

  it('fail path: 导出CSV取消选择路径时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce(null);
    render(<Logs />);

    await user.click(await screen.findByRole('button', { name: /导出CSV/ }));

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportLogs).not.toHaveBeenCalled();
  });

  it('fail path: 导出Excel失败后仍可继续交互', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce('/tmp/logs.xlsx');
    mockedScheduleApi.exportLogsExcel.mockRejectedValueOnce(new Error('export excel failed'));
    render(<Logs />);

    const exportExcelButton = await screen.findByRole('button', { name: /导出Excel/ });
    await user.click(exportExcelButton);

    await waitFor(() => {
      expect(mockedScheduleApi.exportLogsExcel).toHaveBeenCalledWith('/tmp/logs.xlsx', {
        log_type: undefined,
        action: undefined,
        start_time: undefined,
        end_time: undefined,
      });
    });
    await waitFor(() => {
      expect(exportExcelButton).toBeEnabled();
    });
  });

  it('happy path: 时间轴视图超过50条时显示加载更多按钮', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getOperationLogs.mockResolvedValue(buildLogs(120));
    render(<Logs />);

    await screen.findByText('日志总数');
    await user.click(screen.getByText('时间轴'));

    expect(await screen.findByText(/已显示 50 \/ 120 条记录/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /加载更多/ })).toBeInTheDocument();
  });

  it('happy path: 搜索关键字会过滤日志并支持清空恢复', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    await screen.findByText('创建方案 A');
    const input = screen.getByPlaceholderText('搜索关键字...');
    await user.type(input, '自动');

    await waitFor(() => {
      expect(screen.getByText(/共 1 条记录/)).toBeInTheDocument();
      expect(screen.queryByText('创建方案 A')).not.toBeInTheDocument();
    });

    await user.clear(input);
    await waitFor(() => {
      expect(screen.getByText(/共 2 条记录/)).toBeInTheDocument();
      expect(screen.getByText('创建方案 A')).toBeInTheDocument();
    });
  });

  it('happy path: 点击刷新会重新拉取日志', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    await screen.findByText('日志总数');
    await user.click(screen.getByRole('button', { name: /刷新/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.getOperationLogs).toHaveBeenCalledTimes(2);
    });
  });

  it('happy path: 选择日志类型后会按筛选条件重拉数据', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    await screen.findByText('日志总数');
    const [logTypeSelect] = screen.getAllByRole('combobox');
    fireEvent.mouseDown(logTypeSelect);
    const options = await screen.findAllByText('方案操作');
    await user.click(options[options.length - 1]);

    await waitFor(() => {
      expect(mockedScheduleApi.getOperationLogs).toHaveBeenLastCalledWith({
        log_type: 'plan',
        action: undefined,
        start_time: undefined,
        end_time: undefined,
        limit: 500,
      });
    });
  });

  it('happy path: 选择操作类型后会按 action 条件重拉数据', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    await screen.findByText('日志总数');
    const selects = screen.getAllByRole('combobox');
    const actionSelect = selects[1];
    fireEvent.mouseDown(actionSelect);
    const options = await screen.findAllByText('自动排程');
    await user.click(options[options.length - 1]);

    await waitFor(() => {
      expect(mockedScheduleApi.getOperationLogs).toHaveBeenLastCalledWith({
        log_type: undefined,
        action: 'auto_schedule',
        start_time: undefined,
        end_time: undefined,
        limit: 500,
      });
    });
  });

  it('happy path: 设置并清空时间范围会切换 start/end 参数', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    await screen.findByText('日志总数');
    const picker = document.querySelector('.ant-picker-range') as HTMLElement | null;
    if (!picker) {
      throw new Error('未找到时间范围选择器');
    }
    const inputs = Array.from(picker.querySelectorAll('input')) as HTMLInputElement[];
    if (inputs.length < 2) {
      throw new Error('时间范围输入框数量不足');
    }

    await user.click(inputs[0]);
    await user.clear(inputs[0]);
    await user.type(inputs[0], '2026-02-01');
    fireEvent.keyDown(inputs[0], { key: 'Enter', code: 'Enter' });

    await user.click(inputs[1]);
    await user.clear(inputs[1]);
    await user.type(inputs[1], '2026-02-05');
    fireEvent.keyDown(inputs[1], { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      const params = mockedScheduleApi.getOperationLogs.mock.calls.at(-1)?.[0];
      expect(params?.start_time).toEqual(expect.any(String));
      expect(params?.end_time).toEqual(expect.any(String));
    });

    const clearIcon = picker.querySelector('.ant-picker-clear') as HTMLElement | null;
    if (!clearIcon) {
      throw new Error('未找到时间范围清空按钮');
    }
    fireEvent.mouseDown(clearIcon);
    fireEvent.click(clearIcon);

    await waitFor(() => {
      const params = mockedScheduleApi.getOperationLogs.mock.calls.at(-1)?.[0];
      expect(params?.start_time).toBeUndefined();
      expect(params?.end_time).toBeUndefined();
    });
  });

  it('fail path: 无日志数据时展示空状态', async () => {
    mockedScheduleApi.getOperationLogs.mockResolvedValueOnce([]);
    render(<Logs />);

    expect(await screen.findByText('暂无日志记录')).toBeInTheDocument();
  });

  it('fail path: 导出Excel取消选择路径时不会调用导出接口', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce(null);
    render(<Logs />);

    await user.click(await screen.findByRole('button', { name: /导出Excel/ }));

    await waitFor(() => {
      expect(mockedSave).toHaveBeenCalledTimes(1);
    });
    expect(mockedScheduleApi.exportLogsExcel).not.toHaveBeenCalled();
  });

  it('happy path: 点击表格行可以打开日志详情弹窗', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    const row = await screen.findByText('创建方案 A');
    await user.click(row);

    await waitFor(() => {
      expect(screen.getByText('时间:')).toBeInTheDocument();
      expect(screen.getByText('目标类型:')).toBeInTheDocument();
    });
  });

  it('happy path: 日志详情弹窗可关闭', async () => {
    const user = userEvent.setup();
    render(<Logs />);

    const row = await screen.findByText('创建方案 A');
    await user.click(row);

    await waitFor(() => {
      expect(screen.getByText('时间:')).toBeInTheDocument();
    });
    const modal = screen.getByText('时间:').closest('.ant-modal') as HTMLElement;
    const closeBtn = modal.querySelector('.ant-modal-close') as HTMLElement;
    await user.click(closeBtn);

    await waitFor(() => {
      expect(modal).not.toBeVisible();
    });
  });

  it('happy path: 时间轴加载更多后显示更多条目', async () => {
    const user = userEvent.setup();
    mockedScheduleApi.getOperationLogs.mockResolvedValue(buildLogs(120));
    render(<Logs />);

    await screen.findByText('日志总数');
    await user.click(screen.getByText('时间轴'));

    expect(await screen.findByText(/已显示 50 \/ 120 条记录/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /加载更多/ }));
    expect(await screen.findByText(/已显示 100 \/ 120 条记录/)).toBeInTheDocument();
  });

  it('happy path: 导出Excel成功', async () => {
    const user = userEvent.setup();
    mockedSave.mockResolvedValueOnce('/tmp/logs.xlsx');
    render(<Logs />);

    await user.click(await screen.findByRole('button', { name: /导出Excel/ }));

    await waitFor(() => {
      expect(mockedScheduleApi.exportLogsExcel).toHaveBeenCalledWith('/tmp/logs.xlsx', {
        log_type: undefined,
        action: undefined,
        start_time: undefined,
        end_time: undefined,
      });
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useScheduleStore } from './scheduleStore';
import { scheduleApi } from '../services/scheduleApi';
import type { SchedulePlan, ScheduleItem } from '../types/schedule';

vi.mock('../services/scheduleApi', () => ({
  scheduleApi: {
    getPlans: vi.fn(),
    getScheduleItems: vi.fn(),
  },
}));

describe('scheduleStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 store 状态
    useScheduleStore.setState({
      plans: [],
      currentPlan: null,
      scheduleItems: [],
      loading: false,
    });
  });

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const state = useScheduleStore.getState();
      expect(state.plans).toEqual([]);
      expect(state.currentPlan).toBeNull();
      expect(state.scheduleItems).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchPlans', () => {
    it('应该成功获取方案列表', async () => {
      const mockPlans: SchedulePlan[] = [
        { id: 1, name: 'Plan 1', status: 'draft' } as SchedulePlan,
        { id: 2, name: 'Plan 2', status: 'active' } as SchedulePlan,
      ];
      vi.mocked(scheduleApi.getPlans).mockResolvedValue(mockPlans);

      const { fetchPlans } = useScheduleStore.getState();
      await fetchPlans();

      const state = useScheduleStore.getState();
      expect(state.plans).toEqual(mockPlans);
      expect(state.loading).toBe(false);
      expect(scheduleApi.getPlans).toHaveBeenCalledTimes(1);
    });

    it('应该在加载时设置 loading 状态', async () => {
      let resolveGetPlans: (value: SchedulePlan[]) => void;
      const getPlansPromise = new Promise<SchedulePlan[]>((resolve) => {
        resolveGetPlans = resolve;
      });
      vi.mocked(scheduleApi.getPlans).mockReturnValue(getPlansPromise);

      const { fetchPlans } = useScheduleStore.getState();
      const fetchPromise = fetchPlans();

      // 加载中应该是 true
      expect(useScheduleStore.getState().loading).toBe(true);

      // 完成后应该是 false
      resolveGetPlans!([]);
      await fetchPromise;
      expect(useScheduleStore.getState().loading).toBe(false);
    });

    it('应该处理获取失败的情况', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(scheduleApi.getPlans).mockRejectedValue(new Error('Network error'));

      const { fetchPlans } = useScheduleStore.getState();
      await fetchPlans();

      const state = useScheduleStore.getState();
      expect(state.plans).toEqual([]);
      expect(state.loading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch plans:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('setCurrentPlan', () => {
    it('应该设置当前方案', () => {
      const mockPlan: SchedulePlan = { id: 1, name: 'Test Plan', status: 'draft' } as SchedulePlan;

      const { setCurrentPlan } = useScheduleStore.getState();
      setCurrentPlan(mockPlan);

      const state = useScheduleStore.getState();
      expect(state.currentPlan).toEqual(mockPlan);
    });

    it('应该能够清除当前方案', () => {
      const mockPlan: SchedulePlan = { id: 1, name: 'Test Plan', status: 'draft' } as SchedulePlan;

      const { setCurrentPlan } = useScheduleStore.getState();
      setCurrentPlan(mockPlan);
      expect(useScheduleStore.getState().currentPlan).toEqual(mockPlan);

      setCurrentPlan(null);
      expect(useScheduleStore.getState().currentPlan).toBeNull();
    });
  });

  describe('fetchScheduleItems', () => {
    it('应该成功获取排程项目', async () => {
      const mockItems: ScheduleItem[] = [
        { id: 1, material_id: 101, position: 0 } as ScheduleItem,
        { id: 2, material_id: 102, position: 1 } as ScheduleItem,
      ];
      vi.mocked(scheduleApi.getScheduleItems).mockResolvedValue(mockItems);

      const { fetchScheduleItems } = useScheduleStore.getState();
      await fetchScheduleItems(1);

      const state = useScheduleStore.getState();
      expect(state.scheduleItems).toEqual(mockItems);
      expect(scheduleApi.getScheduleItems).toHaveBeenCalledWith(1);
    });

    it('应该处理获取失败的情况', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(scheduleApi.getScheduleItems).mockRejectedValue(new Error('Network error'));

      const { fetchScheduleItems } = useScheduleStore.getState();
      await fetchScheduleItems(1);

      const state = useScheduleStore.getState();
      expect(state.scheduleItems).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch schedule items:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

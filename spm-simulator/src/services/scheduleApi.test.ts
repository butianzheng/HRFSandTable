import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scheduleApi } from './scheduleApi';
import { invoke } from '@tauri-apps/api/core';
import { clearInvokeCache, invokeDeduped } from './requestCache';
import type {
  SchedulePlan,
  ScheduleItem,
  CreatePlanInput,
  ScheduleResult,
  UndoRedoResult,
  RiskAnalysis,
} from '../types/schedule';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('./requestCache', () => ({
  invokeDeduped: vi.fn(),
  clearInvokeCache: vi.fn(),
}));

describe('scheduleApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Plan Management', () => {
    describe('createPlan', () => {
      it('应该调用 create_plan 命令并清除缓存', async () => {
        const mockPlan: SchedulePlan = { id: 1, name: 'Test Plan' } as SchedulePlan;
        vi.mocked(invoke).mockResolvedValue(mockPlan);

        const input: CreatePlanInput = { name: 'Test Plan', description: 'Test' };
        const result = await scheduleApi.createPlan(input);

        expect(invoke).toHaveBeenCalledWith('create_plan', { input });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockPlan);
      });
    });

    describe('getPlan', () => {
      it('应该使用缓存调用 get_plan 命令', async () => {
        const mockPlan: SchedulePlan = { id: 1, name: 'Test Plan' } as SchedulePlan;
        vi.mocked(invokeDeduped).mockResolvedValue(mockPlan);

        const result = await scheduleApi.getPlan(1);

        expect(invokeDeduped).toHaveBeenCalledWith('get_plan', { id: 1 }, 5000);
        expect(result).toEqual(mockPlan);
      });
    });

    describe('getPlans', () => {
      it('应该使用缓存调用 get_plans 命令', async () => {
        const mockPlans: SchedulePlan[] = [
          { id: 1, name: 'Plan 1' } as SchedulePlan,
          { id: 2, name: 'Plan 2' } as SchedulePlan,
        ];
        vi.mocked(invokeDeduped).mockResolvedValue(mockPlans);

        const result = await scheduleApi.getPlans({ status: 'active' });

        expect(invokeDeduped).toHaveBeenCalledWith(
          'get_plans',
          { filter: { status: 'active' } },
          10000
        );
        expect(result).toEqual(mockPlans);
      });

      it('应该在没有过滤条件时传递 null', async () => {
        vi.mocked(invokeDeduped).mockResolvedValue([]);

        await scheduleApi.getPlans();

        expect(invokeDeduped).toHaveBeenCalledWith('get_plans', { filter: null }, 10000);
      });
    });

    describe('savePlan', () => {
      it('应该调用 save_plan 命令并清除缓存', async () => {
        const mockPlan: SchedulePlan = { id: 1, name: 'Saved Plan' } as SchedulePlan;
        vi.mocked(invoke).mockResolvedValue(mockPlan);

        const result = await scheduleApi.savePlan(1);

        expect(invoke).toHaveBeenCalledWith('save_plan', { id: 1 });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockPlan);
      });
    });

    describe('deletePlan', () => {
      it('应该调用 delete_plan 命令并清除缓存', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await scheduleApi.deletePlan(1);

        expect(invoke).toHaveBeenCalledWith('delete_plan', { id: 1 });
        expect(clearInvokeCache).toHaveBeenCalled();
      });
    });

    describe('updatePlanStatus', () => {
      it('应该调用 update_plan_status 命令并清除缓存', async () => {
        const mockPlan: SchedulePlan = { id: 1, status: 'completed' } as SchedulePlan;
        vi.mocked(invoke).mockResolvedValue(mockPlan);

        const result = await scheduleApi.updatePlanStatus(1, 'completed');

        expect(invoke).toHaveBeenCalledWith('update_plan_status', { id: 1, status: 'completed' });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockPlan);
      });
    });
  });

  describe('Schedule Operations', () => {
    describe('autoSchedule', () => {
      it('应该调用 auto_schedule 命令并清除缓存', async () => {
        const mockResult: ScheduleResult = {
          plan_id: 1,
          total_count: 10,
          total_weight: 1000,
          roll_change_count: 2,
          score: 88,
          scheduler_mode_used: 'hybrid',
          fallback_triggered: true,
        };
        vi.mocked(invoke).mockResolvedValue(mockResult);

        const result = await scheduleApi.autoSchedule(1, 2);

        expect(invoke).toHaveBeenCalledWith('auto_schedule', { planId: 1, strategyId: 2 });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
      });
    });

    describe('analyzeScheduleIdleGaps', () => {
      it('应该使用缓存调用 analyze_schedule_idle_gaps 命令', async () => {
        const mockResult = {
          plan_id: 1,
          threshold_minutes: 30,
          total_checked_gaps: 12,
          over_threshold_count: 2,
          max_gap_minutes: 45,
          avg_gap_minutes: 37.5,
          items: [],
        };
        vi.mocked(invokeDeduped).mockResolvedValue(mockResult);

        const result = await scheduleApi.analyzeScheduleIdleGaps(1, 30);

        expect(invokeDeduped).toHaveBeenCalledWith(
          'analyze_schedule_idle_gaps',
          { planId: 1, thresholdMinutes: 30 },
          3000
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('addToSchedule', () => {
      it('应该调用 add_to_schedule 命令并清除缓存', async () => {
        const mockItems: ScheduleItem[] = [{ id: 1 } as ScheduleItem];
        vi.mocked(invoke).mockResolvedValue(mockItems);

        const result = await scheduleApi.addToSchedule(1, [101, 102], 5);

        expect(invoke).toHaveBeenCalledWith('add_to_schedule', {
          planId: 1,
          materialIds: [101, 102],
          position: 5,
        });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockItems);
      });

      it('应该在没有 position 时传递 null', async () => {
        vi.mocked(invoke).mockResolvedValue([]);

        await scheduleApi.addToSchedule(1, [101]);

        expect(invoke).toHaveBeenCalledWith('add_to_schedule', {
          planId: 1,
          materialIds: [101],
          position: null,
        });
      });
    });

    describe('removeFromSchedule', () => {
      it('应该调用 remove_from_schedule 命令并清除缓存', async () => {
        vi.mocked(invoke).mockResolvedValue(2);

        const result = await scheduleApi.removeFromSchedule(1, [10, 20]);

        expect(invoke).toHaveBeenCalledWith('remove_from_schedule', {
          planId: 1,
          itemIds: [10, 20],
        });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toBe(2);
      });
    });

    describe('moveScheduleItem', () => {
      it('应该调用 move_schedule_item 命令并清除缓存', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await scheduleApi.moveScheduleItem(1, 10, 5);

        expect(invoke).toHaveBeenCalledWith('move_schedule_item', {
          planId: 1,
          itemId: 10,
          newPosition: 5,
        });
        expect(clearInvokeCache).toHaveBeenCalled();
      });
    });

    describe('lockScheduleItems', () => {
      it('应该调用 lock_schedule_items 命令并清除缓存', async () => {
        vi.mocked(invoke).mockResolvedValue(3);

        const result = await scheduleApi.lockScheduleItems(1, [10, 20, 30], true);

        expect(invoke).toHaveBeenCalledWith('lock_schedule_items', {
          planId: 1,
          itemIds: [10, 20, 30],
          locked: true,
        });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toBe(3);
      });
    });

    describe('getScheduleItems', () => {
      it('应该使用缓存调用 get_schedule_items 命令', async () => {
        const mockItems: ScheduleItem[] = [{ id: 1 } as ScheduleItem];
        vi.mocked(invokeDeduped).mockResolvedValue(mockItems);

        const result = await scheduleApi.getScheduleItems(1);

        expect(invokeDeduped).toHaveBeenCalledWith('get_schedule_items', { planId: 1 }, 3000);
        expect(result).toEqual(mockItems);
      });
    });
  });

  describe('Undo/Redo', () => {
    describe('pushUndo', () => {
      it('应该调用 push_undo 命令并清除缓存', async () => {
        vi.mocked(invoke).mockResolvedValue(undefined);

        await scheduleApi.pushUndo(1, 'move', 'before', 'after');

        expect(invoke).toHaveBeenCalledWith('push_undo', {
          planId: 1,
          actionType: 'move',
          beforeState: 'before',
          afterState: 'after',
        });
        expect(clearInvokeCache).toHaveBeenCalled();
      });
    });

    describe('undoAction', () => {
      it('应该调用 undo_action 命令并清除缓存', async () => {
        const mockResult: UndoRedoResult = { success: true };
        vi.mocked(invoke).mockResolvedValue(mockResult);

        const result = await scheduleApi.undoAction(1);

        expect(invoke).toHaveBeenCalledWith('undo_action', { planId: 1 });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
      });
    });

    describe('redoAction', () => {
      it('应该调用 redo_action 命令并清除缓存', async () => {
        const mockResult: UndoRedoResult = { success: true };
        vi.mocked(invoke).mockResolvedValue(mockResult);

        const result = await scheduleApi.redoAction(1);

        expect(invoke).toHaveBeenCalledWith('redo_action', { planId: 1 });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockResult);
      });
    });

    describe('getUndoRedoCount', () => {
      it('应该使用缓存调用 get_undo_redo_count 命令', async () => {
        vi.mocked(invokeDeduped).mockResolvedValue([5, 3]);

        const result = await scheduleApi.getUndoRedoCount(1);

        expect(invokeDeduped).toHaveBeenCalledWith('get_undo_redo_count', { planId: 1 }, 3000);
        expect(result).toEqual([5, 3]);
      });
    });

    describe('clearUndoStack', () => {
      it('应该调用 clear_undo_stack 命令并清除缓存', async () => {
        vi.mocked(invoke).mockResolvedValue(10);

        const result = await scheduleApi.clearUndoStack(1);

        expect(invoke).toHaveBeenCalledWith('clear_undo_stack', { planId: 1 });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toBe(10);
      });

      it('应该在没有 planId 时传递 null', async () => {
        vi.mocked(invoke).mockResolvedValue(0);

        await scheduleApi.clearUndoStack();

        expect(invoke).toHaveBeenCalledWith('clear_undo_stack', { planId: null });
      });
    });
  });

  describe('Risk Analysis', () => {
    describe('getRiskAnalysis', () => {
      it('应该使用缓存调用 get_risk_analysis 命令', async () => {
        const mockAnalysis: RiskAnalysis = { score: 85 } as RiskAnalysis;
        vi.mocked(invokeDeduped).mockResolvedValue(mockAnalysis);

        const result = await scheduleApi.getRiskAnalysis(1);

        expect(invokeDeduped).toHaveBeenCalledWith('get_risk_analysis', { planId: 1 }, 5000);
        expect(result).toEqual(mockAnalysis);
      });
    });

    describe('evaluateRisks', () => {
      it('应该调用 evaluate_risks 命令并清除缓存', async () => {
        const mockAnalysis: RiskAnalysis = { score: 85 } as RiskAnalysis;
        vi.mocked(invoke).mockResolvedValue(mockAnalysis);

        const result = await scheduleApi.evaluateRisks(1);

        expect(invoke).toHaveBeenCalledWith('evaluate_risks', { planId: 1 });
        expect(clearInvokeCache).toHaveBeenCalled();
        expect(result).toEqual(mockAnalysis);
      });
    });
  });

  describe('Plan Comparison', () => {
    describe('comparePlans', () => {
      it('应该使用缓存调用 compare_plans 命令', async () => {
        const mockResult = { differences: [] };
        vi.mocked(invokeDeduped).mockResolvedValue(mockResult);

        const result = await scheduleApi.comparePlans(1, 2);

        expect(invokeDeduped).toHaveBeenCalledWith(
          'compare_plans',
          { planAId: 1, planBId: 2 },
          10000
        );
        expect(result).toEqual(mockResult);
      });
    });

    describe('comparePlansMulti', () => {
      it('应该使用缓存调用 compare_plans_multi 命令', async () => {
        const mockResult = { plans: [] };
        vi.mocked(invokeDeduped).mockResolvedValue(mockResult);

        const result = await scheduleApi.comparePlansMulti([1, 2, 3]);

        expect(invokeDeduped).toHaveBeenCalledWith(
          'compare_plans_multi',
          { planIds: [1, 2, 3] },
          10000
        );
        expect(result).toEqual(mockResult);
      });
    });
  });
});

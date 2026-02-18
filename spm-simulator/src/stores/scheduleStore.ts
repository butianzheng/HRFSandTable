import { create } from 'zustand';
import type { SchedulePlan, ScheduleItem } from '../types/schedule';
import { scheduleApi } from '../services/scheduleApi';

interface ScheduleState {
  plans: SchedulePlan[];
  currentPlan: SchedulePlan | null;
  scheduleItems: ScheduleItem[];
  loading: boolean;

  fetchPlans: () => Promise<void>;
  setCurrentPlan: (plan: SchedulePlan | null) => void;
  fetchScheduleItems: (planId: number) => Promise<void>;
}

export const useScheduleStore = create<ScheduleState>((set) => ({
  plans: [],
  currentPlan: null,
  scheduleItems: [],
  loading: false,

  fetchPlans: async () => {
    set({ loading: true });
    try {
      const plans = await scheduleApi.getPlans();
      set({ plans, loading: false });
    } catch (error) {
      console.error('Failed to fetch plans:', error);
      set({ loading: false });
    }
  },

  setCurrentPlan: (plan) => set({ currentPlan: plan }),

  fetchScheduleItems: async (planId) => {
    try {
      const items = await scheduleApi.getScheduleItems(planId);
      set({ scheduleItems: items });
    } catch (error) {
      console.error('Failed to fetch schedule items:', error);
    }
  },
}));

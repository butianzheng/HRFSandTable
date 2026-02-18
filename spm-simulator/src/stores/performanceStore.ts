import { create } from 'zustand';
import type { PerformanceStats, PerformanceBaseline, PerformanceAlert } from '../types/performance';
import { performanceApi } from '../services/performanceApi';

interface PerformanceState {
  stats: PerformanceStats[];
  baselines: PerformanceBaseline[];
  alerts: PerformanceAlert[];
  loading: boolean;
  hours: number;

  // Actions
  setHours: (hours: number) => void;
  fetchStats: (metricType?: string, metricName?: string) => Promise<void>;
  fetchBaselines: () => Promise<void>;
  fetchAlerts: () => Promise<void>;
  cleanupMetrics: (days: number) => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const usePerformanceStore = create<PerformanceState>((set, get) => ({
  stats: [],
  baselines: [],
  alerts: [],
  loading: false,
  hours: 24,

  setHours: (hours) => {
    set({ hours });
  },

  fetchStats: async (metricType?: string, metricName?: string) => {
    set({ loading: true });
    try {
      const stats = await performanceApi.getStats(metricType, metricName, get().hours);
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch performance stats:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchBaselines: async () => {
    try {
      const baselines = await performanceApi.getBaselines();
      set({ baselines });
    } catch (error) {
      console.error('Failed to fetch performance baselines:', error);
    }
  },

  fetchAlerts: async () => {
    try {
      const alerts = await performanceApi.checkAlerts(get().hours);
      set({ alerts });
    } catch (error) {
      console.error('Failed to fetch performance alerts:', error);
    }
  },

  cleanupMetrics: async (days: number) => {
    try {
      await performanceApi.cleanupMetrics(days);
      // 清理后重新获取数据
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to cleanup performance metrics:', error);
    }
  },

  refreshAll: async () => {
    await Promise.all([get().fetchStats(), get().fetchBaselines(), get().fetchAlerts()]);
  },
}));

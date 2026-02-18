import { create } from 'zustand';
import type { ErrorLog, ErrorStats, ErrorFilter } from '../types/error';
import { errorTrackingApi } from '../services/errorTrackingApi';

interface ErrorTrackingState {
  errors: ErrorLog[];
  stats: ErrorStats | null;
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  filter: ErrorFilter;

  // Actions
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setFilter: (filter: Partial<ErrorFilter>) => void;
  fetchErrors: () => Promise<void>;
  fetchStats: () => Promise<void>;
  resolveError: (errorId: number) => Promise<void>;
  deleteError: (errorId: number) => Promise<void>;
  cleanupOldErrors: (days: number) => Promise<void>;
  refreshAll: () => Promise<void>;
}

export const useErrorTrackingStore = create<ErrorTrackingState>((set, get) => ({
  errors: [],
  stats: null,
  total: 0,
  loading: false,
  page: 1,
  pageSize: 20,
  filter: {},

  setPage: (page) => {
    set({ page });
  },

  setPageSize: (pageSize) => {
    set({ pageSize, page: 1 });
  },

  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
      page: 1,
    }));
  },

  fetchErrors: async () => {
    set({ loading: true });
    try {
      const { page, pageSize, filter } = get();
      const response = await errorTrackingApi.getErrors({
        filter,
        page,
        page_size: pageSize,
      });
      set({ errors: response.errors, total: response.total });
    } catch (error) {
      console.error('Failed to fetch errors:', error);
    } finally {
      set({ loading: false });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await errorTrackingApi.getStats();
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch error stats:', error);
    }
  },

  resolveError: async (errorId: number) => {
    try {
      await errorTrackingApi.resolveError(errorId);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to resolve error:', error);
      throw error;
    }
  },

  deleteError: async (errorId: number) => {
    try {
      await errorTrackingApi.deleteError(errorId);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to delete error:', error);
      throw error;
    }
  },

  cleanupOldErrors: async (days: number) => {
    try {
      await errorTrackingApi.cleanupOldErrors(days);
      await get().refreshAll();
    } catch (error) {
      console.error('Failed to cleanup old errors:', error);
      throw error;
    }
  },

  refreshAll: async () => {
    await Promise.all([get().fetchErrors(), get().fetchStats()]);
  },
}));

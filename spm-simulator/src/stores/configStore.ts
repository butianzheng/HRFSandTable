import { create } from 'zustand';
import type { StrategyTemplate, SystemConfig } from '../types/config';
import { configApi } from '../services/configApi';

interface ConfigState {
  systemConfig: SystemConfig | null;
  strategyTemplates: StrategyTemplate[];
  loading: boolean;

  fetchSystemConfig: () => Promise<void>;
  fetchStrategyTemplates: () => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set) => ({
  systemConfig: null,
  strategyTemplates: [],
  loading: false,

  fetchSystemConfig: async () => {
    try {
      const config = await configApi.getSystemConfig();
      set({ systemConfig: config });
    } catch (error) {
      console.error('Failed to fetch system config:', error);
    }
  },

  fetchStrategyTemplates: async () => {
    set({ loading: true });
    try {
      const templates = await configApi.getStrategyTemplates();
      set({ strategyTemplates: templates, loading: false });
    } catch (error) {
      console.error('Failed to fetch strategy templates:', error);
      set({ loading: false });
    }
  },
}));

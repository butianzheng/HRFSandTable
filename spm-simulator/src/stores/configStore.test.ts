import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useConfigStore } from './configStore';
import { configApi } from '../services/configApi';
import type { SystemConfig, StrategyTemplate } from '../types/config';

vi.mock('../services/configApi', () => ({
  configApi: {
    getSystemConfig: vi.fn(),
    getStrategyTemplates: vi.fn(),
  },
}));

describe('configStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 store 状态
    useConfigStore.setState({
      systemConfig: null,
      strategyTemplates: [],
      loading: false,
    });
  });

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const state = useConfigStore.getState();
      expect(state.systemConfig).toBeNull();
      expect(state.strategyTemplates).toEqual([]);
      expect(state.loading).toBe(false);
    });
  });

  describe('fetchSystemConfig', () => {
    it('应该成功获取系统配置', async () => {
      const mockConfig: SystemConfig = {
        id: 1,
        max_width_jump: 100,
        min_temper_hours: 24,
      } as SystemConfig;
      vi.mocked(configApi.getSystemConfig).mockResolvedValue(mockConfig);

      const { fetchSystemConfig } = useConfigStore.getState();
      await fetchSystemConfig();

      const state = useConfigStore.getState();
      expect(state.systemConfig).toEqual(mockConfig);
      expect(configApi.getSystemConfig).toHaveBeenCalledTimes(1);
    });

    it('应该处理获取失败的情况', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(configApi.getSystemConfig).mockRejectedValue(new Error('Network error'));

      const { fetchSystemConfig } = useConfigStore.getState();
      await fetchSystemConfig();

      const state = useConfigStore.getState();
      expect(state.systemConfig).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch system config:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchStrategyTemplates', () => {
    it('应该成功获取策略模板列表', async () => {
      const mockTemplates: StrategyTemplate[] = [
        { id: 1, name: 'Template 1' } as StrategyTemplate,
        { id: 2, name: 'Template 2' } as StrategyTemplate,
      ];
      vi.mocked(configApi.getStrategyTemplates).mockResolvedValue(mockTemplates);

      const { fetchStrategyTemplates } = useConfigStore.getState();
      await fetchStrategyTemplates();

      const state = useConfigStore.getState();
      expect(state.strategyTemplates).toEqual(mockTemplates);
      expect(state.loading).toBe(false);
      expect(configApi.getStrategyTemplates).toHaveBeenCalledTimes(1);
    });

    it('应该在加载时设置 loading 状态', async () => {
      let resolveTemplates: (value: StrategyTemplate[]) => void;
      const templatesPromise = new Promise<StrategyTemplate[]>((resolve) => {
        resolveTemplates = resolve;
      });
      vi.mocked(configApi.getStrategyTemplates).mockReturnValue(templatesPromise);

      const { fetchStrategyTemplates } = useConfigStore.getState();
      const fetchPromise = fetchStrategyTemplates();

      // 加载中应该是 true
      expect(useConfigStore.getState().loading).toBe(true);

      // 完成后应该是 false
      resolveTemplates!([]);
      await fetchPromise;
      expect(useConfigStore.getState().loading).toBe(false);
    });

    it('应该处理获取失败的情况', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(configApi.getStrategyTemplates).mockRejectedValue(new Error('Network error'));

      const { fetchStrategyTemplates } = useConfigStore.getState();
      await fetchStrategyTemplates();

      const state = useConfigStore.getState();
      expect(state.strategyTemplates).toEqual([]);
      expect(state.loading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch strategy templates:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMaterialStore } from './materialStore';
import { materialApi } from '../services/materialApi';
import type { Material, MaterialFilter } from '../types/material';

vi.mock('../services/materialApi', () => ({
  materialApi: {
    getMaterials: vi.fn(),
    refreshTemperStatus: vi.fn(),
  },
}));

describe('materialStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 store 状态
    useMaterialStore.setState({
      materials: [],
      total: 0,
      loading: false,
      filter: {},
      page: 1,
      pageSize: 50,
    });
  });

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const state = useMaterialStore.getState();
      expect(state.materials).toEqual([]);
      expect(state.total).toBe(0);
      expect(state.loading).toBe(false);
      expect(state.filter).toEqual({});
      expect(state.page).toBe(1);
      expect(state.pageSize).toBe(50);
    });
  });

  describe('setFilter', () => {
    it('应该更新过滤条件', () => {
      const { setFilter } = useMaterialStore.getState();
      const newFilter: Partial<MaterialFilter> = { status: 'pending' };

      setFilter(newFilter);

      const state = useMaterialStore.getState();
      expect(state.filter).toEqual({ status: 'pending' });
    });

    it('应该合并过滤条件', () => {
      const { setFilter } = useMaterialStore.getState();

      setFilter({ status: 'pending' });
      setFilter({ search: 'test' });

      const state = useMaterialStore.getState();
      expect(state.filter).toEqual({ status: 'pending', search: 'test' });
    });

    it('应该在设置过滤条件时重置页码为 1', () => {
      const { setFilter, setPage } = useMaterialStore.getState();

      setPage(3);
      expect(useMaterialStore.getState().page).toBe(3);

      setFilter({ status: 'pending' });
      expect(useMaterialStore.getState().page).toBe(1);
    });
  });

  describe('setPage', () => {
    it('应该更新页码', () => {
      const { setPage } = useMaterialStore.getState();

      setPage(5);

      const state = useMaterialStore.getState();
      expect(state.page).toBe(5);
    });
  });

  describe('fetchMaterials', () => {
    it('应该成功获取材料列表', async () => {
      const mockMaterials: Material[] = [
        { id: 1, material_no: 'M001' } as Material,
        { id: 2, material_no: 'M002' } as Material,
      ];
      const mockResult = {
        items: mockMaterials,
        total: 2,
      };
      vi.mocked(materialApi.getMaterials).mockResolvedValue(mockResult);

      const { fetchMaterials } = useMaterialStore.getState();
      await fetchMaterials();

      const state = useMaterialStore.getState();
      expect(state.materials).toEqual(mockMaterials);
      expect(state.total).toBe(2);
      expect(state.loading).toBe(false);
      expect(materialApi.getMaterials).toHaveBeenCalledWith({}, { page: 1, page_size: 50 });
    });

    it('应该使用当前的过滤条件和分页参数', async () => {
      const mockResult = { items: [], total: 0 };
      vi.mocked(materialApi.getMaterials).mockResolvedValue(mockResult);

      const { setFilter, setPage, fetchMaterials } = useMaterialStore.getState();
      setFilter({ status: 'pending' });
      setPage(3);

      await fetchMaterials();

      expect(materialApi.getMaterials).toHaveBeenCalledWith(
        { status: 'pending' },
        { page: 3, page_size: 50 }
      );
    });

    it('应该在加载时设置 loading 状态', async () => {
      let resolveMaterials: (value: Material[]) => void;
      const materialsPromise = new Promise<Material[]>((resolve) => {
        resolveMaterials = resolve;
      });
      vi.mocked(materialApi.getMaterials).mockReturnValue(materialsPromise as Promise<Material[]>);

      const { fetchMaterials } = useMaterialStore.getState();
      const fetchPromise = fetchMaterials();

      // 加载中应该是 true
      expect(useMaterialStore.getState().loading).toBe(true);

      // 完成后应该是 false
      resolveMaterials!({ items: [], total: 0 });
      await fetchPromise;
      expect(useMaterialStore.getState().loading).toBe(false);
    });

    it('应该处理获取失败的情况', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(materialApi.getMaterials).mockRejectedValue(new Error('Network error'));

      const { fetchMaterials } = useMaterialStore.getState();
      await fetchMaterials();

      const state = useMaterialStore.getState();
      expect(state.materials).toEqual([]);
      expect(state.loading).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to fetch materials:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('refreshTemperStatus', () => {
    it('应该刷新适温状态并重新获取材料', async () => {
      const mockMaterials = { items: [], total: 0 };
      vi.mocked(materialApi.refreshTemperStatus).mockResolvedValue(undefined);
      vi.mocked(materialApi.getMaterials).mockResolvedValue(mockMaterials);

      const { refreshTemperStatus } = useMaterialStore.getState();
      await refreshTemperStatus();

      expect(materialApi.refreshTemperStatus).toHaveBeenCalledTimes(1);
      expect(materialApi.getMaterials).toHaveBeenCalledTimes(1);
    });

    it('应该处理刷新失败的情况', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(materialApi.refreshTemperStatus).mockRejectedValue(new Error('Refresh failed'));

      const { refreshTemperStatus } = useMaterialStore.getState();
      await refreshTemperStatus();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to refresh temper status:',
        expect.any(Error)
      );
      // 失败时不应该调用 getMaterials
      expect(materialApi.getMaterials).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});

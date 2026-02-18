import { create } from 'zustand';
import type { Material, MaterialFilter } from '../types/material';
import { materialApi } from '../services/materialApi';

interface MaterialState {
  materials: Material[];
  total: number;
  loading: boolean;
  filter: MaterialFilter;
  page: number;
  pageSize: number;

  setFilter: (filter: Partial<MaterialFilter>) => void;
  setPage: (page: number) => void;
  fetchMaterials: () => Promise<void>;
  refreshTemperStatus: () => Promise<void>;
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  materials: [],
  total: 0,
  loading: false,
  filter: {},
  page: 1,
  pageSize: 50,

  setFilter: (filter) => set((state) => ({ filter: { ...state.filter, ...filter }, page: 1 })),

  setPage: (page) => set({ page }),

  fetchMaterials: async () => {
    set({ loading: true });
    try {
      const { filter, page, pageSize } = get();
      const result = await materialApi.getMaterials(filter, {
        page,
        page_size: pageSize,
      });
      set({
        materials: result.items,
        total: result.total,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to fetch materials:', error);
      set({ loading: false });
    }
  },

  refreshTemperStatus: async () => {
    try {
      await materialApi.refreshTemperStatus();
      await get().fetchMaterials();
    } catch (error) {
      console.error('Failed to refresh temper status:', error);
    }
  },
}));

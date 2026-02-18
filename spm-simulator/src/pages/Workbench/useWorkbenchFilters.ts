import { useState, useMemo, useCallback, useDeferredValue } from 'react';

import type { Material } from '../../types/material';
import type { SchedulePlan } from '../../types/schedule';
import { matchesPriorityHitFilter, type PriorityHitCodeSets } from '../../utils/priorityHit';
import type { ScheduleRow, DueBucket } from './types';

export interface UseWorkbenchFiltersParams {
  materials: Material[];
  scheduleItems: ScheduleRow[];
  selectedMaterialIds: number[];
  setSelectedMaterialIds: React.Dispatch<React.SetStateAction<number[]>>;
  currentPlan: SchedulePlan | null;
  clearForecastFilter: (syncUrl: boolean) => void;
  priorityHitCodeSets: PriorityHitCodeSets;
  // Lifted filter state (owned by parent, passed in)
  materialTempFilter: 'all' | 'ready' | 'waiting';
  setMaterialTempFilter: React.Dispatch<React.SetStateAction<'all' | 'ready' | 'waiting'>>;
  materialStatusFilter: 'all' | 'pending' | 'frozen';
  setMaterialStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'pending' | 'frozen'>>;
  forecastReadyDateFilter: string | null;
  setForecastReadyDateFilter: React.Dispatch<React.SetStateAction<string | null>>;
  forecastMaterialIdsFilter: number[] | null;
  setForecastMaterialIdsFilter: React.Dispatch<React.SetStateAction<number[] | null>>;
}

export interface UseWorkbenchFiltersReturn {
  materialSearch: string;
  setMaterialSearch: React.Dispatch<React.SetStateAction<string>>;
  deferredMaterialSearch: string;
  materialTempFilter: 'all' | 'ready' | 'waiting';
  setMaterialTempFilter: React.Dispatch<React.SetStateAction<'all' | 'ready' | 'waiting'>>;
  materialStatusFilter: 'all' | 'pending' | 'frozen';
  setMaterialStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'pending' | 'frozen'>>;
  materialDueFilter: 'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none';
  setMaterialDueFilter: React.Dispatch<
    React.SetStateAction<'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none'>
  >;
  materialSteelFilter: string[];
  setMaterialSteelFilter: React.Dispatch<React.SetStateAction<string[]>>;
  priorityHitFilter: string;
  setPriorityHitFilter: React.Dispatch<React.SetStateAction<string>>;
  forecastReadyDateFilter: string | null;
  setForecastReadyDateFilter: React.Dispatch<React.SetStateAction<string | null>>;
  forecastMaterialIdsFilter: number[] | null;
  setForecastMaterialIdsFilter: React.Dispatch<React.SetStateAction<number[] | null>>;
  widthMin: number | null;
  setWidthMin: React.Dispatch<React.SetStateAction<number | null>>;
  widthMax: number | null;
  setWidthMax: React.Dispatch<React.SetStateAction<number | null>>;
  thicknessMin: number | null;
  setThicknessMin: React.Dispatch<React.SetStateAction<number | null>>;
  thicknessMax: number | null;
  setThicknessMax: React.Dispatch<React.SetStateAction<number | null>>;
  getDueBucket: (dueDate?: string) => DueBucket;
  resetMaterialFilters: () => void;
  steelOptions: string[];
  scheduledMaterialIds: Set<number>;
  unscheduledMaterials: Material[];
  baseAvailableMaterials: Material[];
  availableMaterials: Material[];
  materialStats: {
    total: { ready: number; waiting: number; pending: number; frozen: number };
    filtered: { ready: number; waiting: number; pending: number; frozen: number };
  };
  selectedMaterialSet: Set<number>;
  selectedMaterials: Material[];
  selectedFrozenCount: number;
  selectedWaitingCount: number;
  selectedReadyPendingCount: number;
  canAddSelected: boolean;
  materialAddBlockedReason: string | undefined;
  materialGroups: {
    ready: Material[];
    waiting: Material[];
    readyIds: number[];
    waitingIds: number[];
  };
  readySelectedMaterialIds: number[];
  waitingSelectedMaterialIds: number[];
  handleScopedMaterialSelectionChange: (scopeIds: number[], keys: number[]) => void;
}

export function useWorkbenchFilters(params: UseWorkbenchFiltersParams): UseWorkbenchFiltersReturn {
  const {
    materials,
    scheduleItems,
    selectedMaterialIds,
    setSelectedMaterialIds,
    currentPlan,
    clearForecastFilter,
    priorityHitCodeSets,
    // Lifted filter state
    materialTempFilter,
    setMaterialTempFilter,
    materialStatusFilter,
    setMaterialStatusFilter,
    forecastReadyDateFilter,
    setForecastReadyDateFilter,
    forecastMaterialIdsFilter,
    setForecastMaterialIdsFilter,
  } = params;

  // ─── Local Filter State (owned by this hook) ───
  const [materialSearch, setMaterialSearch] = useState('');
  const deferredMaterialSearch = useDeferredValue(materialSearch);
  const [materialDueFilter, setMaterialDueFilter] = useState<
    'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none'
  >('all');
  const [materialSteelFilter, setMaterialSteelFilter] = useState<string[]>([]);
  const [priorityHitFilter, setPriorityHitFilter] = useState<string>('all');
  const [widthMin, setWidthMin] = useState<number | null>(null);
  const [widthMax, setWidthMax] = useState<number | null>(null);
  const [thicknessMin, setThicknessMin] = useState<number | null>(null);
  const [thicknessMax, setThicknessMax] = useState<number | null>(null);

  // ─── Helpers ───
  const getDueBucket = (dueDate?: string): DueBucket => {
    if (!dueDate) return 'none';
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return 'none';
    const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffDays = Math.floor((dueStart - todayStart) / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 3) return 'in3';
    if (diffDays <= 7) return 'in7';
    return 'later';
  };

  const resetMaterialFilters = () => {
    setMaterialSearch('');
    setMaterialTempFilter('all');
    setMaterialStatusFilter('pending');
    setMaterialDueFilter('all');
    setMaterialSteelFilter([]);
    setPriorityHitFilter('all');
    clearForecastFilter(true);
    setWidthMin(null);
    setWidthMax(null);
    setThicknessMin(null);
    setThicknessMax(null);
  };

  // ─── Derived Data ───
  const steelOptions = useMemo(
    () =>
      Array.from(new Set(materials.map((m) => m.steel_grade)))
        .filter(Boolean)
        .sort(),
    [materials]
  );

  const scheduledMaterialIds = useMemo(
    () => new Set(scheduleItems.map((item) => item.material_id)),
    [scheduleItems]
  );

  const unscheduledMaterials = useMemo(
    () => materials.filter((m) => !scheduledMaterialIds.has(m.id)),
    [materials, scheduledMaterialIds]
  );

  const baseAvailableMaterials = useMemo(() => {
    const keyword = deferredMaterialSearch.trim().toLowerCase();
    const forecastSet = forecastMaterialIdsFilter ? new Set(forecastMaterialIdsFilter) : null;

    return unscheduledMaterials.filter((m) => {
      const status = m.status ?? 'pending';
      if (materialStatusFilter === 'pending' && status !== 'pending') return false;
      if (materialStatusFilter === 'frozen' && status !== 'frozen') return false;

      const temp = m.temp_status ?? 'waiting';
      if (materialTempFilter !== 'all' && temp !== materialTempFilter) return false;

      if (materialSteelFilter.length > 0 && !materialSteelFilter.includes(m.steel_grade))
        return false;

      if (widthMin != null && m.width < widthMin) return false;
      if (widthMax != null && m.width > widthMax) return false;
      if (thicknessMin != null && m.thickness < thicknessMin) return false;
      if (thicknessMax != null && m.thickness > thicknessMax) return false;

      if (materialDueFilter !== 'all' && getDueBucket(m.due_date) !== materialDueFilter)
        return false;
      if (forecastSet && !forecastSet.has(m.id)) return false;

      if (keyword) {
        return (
          m.coil_id.toLowerCase().includes(keyword) ||
          m.steel_grade.toLowerCase().includes(keyword) ||
          (m.customer_name || '').toLowerCase().includes(keyword) ||
          (m.contract_no || '').toLowerCase().includes(keyword)
        );
      }
      return true;
    });
  }, [
    deferredMaterialSearch,
    forecastMaterialIdsFilter,
    materialDueFilter,
    materialStatusFilter,
    materialSteelFilter,
    materialTempFilter,
    thicknessMax,
    thicknessMin,
    unscheduledMaterials,
    widthMax,
    widthMin,
  ]);

  const availableMaterials = useMemo(() => {
    if (priorityHitFilter === 'all') return baseAvailableMaterials;
    return baseAvailableMaterials.filter((material) =>
      matchesPriorityHitFilter(material, priorityHitFilter, priorityHitCodeSets)
    );
  }, [baseAvailableMaterials, priorityHitFilter, priorityHitCodeSets]);

  const materialStats = useMemo(() => {
    const total = { ready: 0, waiting: 0, pending: 0, frozen: 0 };
    const filtered = { ready: 0, waiting: 0, pending: 0, frozen: 0 };

    unscheduledMaterials.forEach((m) => {
      const temp = m.temp_status ?? 'waiting';
      const status = m.status ?? 'pending';
      if (temp === 'ready') total.ready += 1;
      else total.waiting += 1;
      if (status === 'frozen') total.frozen += 1;
      else total.pending += 1;
    });

    availableMaterials.forEach((m) => {
      const temp = m.temp_status ?? 'waiting';
      const status = m.status ?? 'pending';
      if (temp === 'ready') filtered.ready += 1;
      else filtered.waiting += 1;
      if (status === 'frozen') filtered.frozen += 1;
      else filtered.pending += 1;
    });

    return { total, filtered };
  }, [availableMaterials, unscheduledMaterials]);

  const selectedMaterialSet = useMemo(() => new Set(selectedMaterialIds), [selectedMaterialIds]);
  const selectedMaterials = useMemo(
    () => materials.filter((m) => selectedMaterialSet.has(m.id)),
    [materials, selectedMaterialSet]
  );
  const selectedFrozenCount = useMemo(
    () => selectedMaterials.filter((m) => (m.status ?? 'pending') === 'frozen').length,
    [selectedMaterials]
  );
  const selectedWaitingCount = useMemo(
    () => selectedMaterials.filter((m) => (m.temp_status ?? 'waiting') !== 'ready').length,
    [selectedMaterials]
  );
  const selectedReadyPendingCount = useMemo(
    () =>
      selectedMaterials.filter(
        (m) => (m.status ?? 'pending') !== 'frozen' && (m.temp_status ?? 'waiting') === 'ready'
      ).length,
    [selectedMaterials]
  );
  const selectedBlockedCount = selectedMaterialIds.length - selectedReadyPendingCount;
  const materialAddBlockedReason = useMemo(() => {
    if (!currentPlan) return '请先选择方案';
    const reasons: string[] = [];
    if (selectedFrozenCount > 0) reasons.push(`冻结${selectedFrozenCount}条`);
    if (selectedWaitingCount > 0) reasons.push(`待温${selectedWaitingCount}条(自动排程可处理期内转适温材料)`);
    if (reasons.length > 0) return `已选材料含${reasons.join('，')}，不可入排`;
    return undefined;
  }, [currentPlan, selectedFrozenCount, selectedWaitingCount]);
  const canAddSelected =
    Boolean(currentPlan) && selectedMaterialIds.length > 0 && selectedBlockedCount === 0;

  const materialGroups = useMemo(() => {
    const ready: Material[] = [];
    const waiting: Material[] = [];
    const readyIds: number[] = [];
    const waitingIds: number[] = [];

    availableMaterials.forEach((m) => {
      if ((m.temp_status ?? 'waiting') === 'ready') {
        ready.push(m);
        readyIds.push(m.id);
        return;
      }
      waiting.push(m);
      waitingIds.push(m.id);
    });

    return { ready, waiting, readyIds, waitingIds };
  }, [availableMaterials]);

  const readySelectedMaterialIds = useMemo(() => {
    const readySet = new Set(materialGroups.readyIds);
    return selectedMaterialIds.filter((id) => readySet.has(id));
  }, [materialGroups.readyIds, selectedMaterialIds]);

  const waitingSelectedMaterialIds = useMemo(() => {
    const waitingSet = new Set(materialGroups.waitingIds);
    return selectedMaterialIds.filter((id) => waitingSet.has(id));
  }, [materialGroups.waitingIds, selectedMaterialIds]);

  const handleScopedMaterialSelectionChange = useCallback(
    (scopeIds: number[], keys: number[]) => {
      setSelectedMaterialIds((prev) => {
        const scopeSet = new Set(scopeIds);
        const preserved = prev.filter((id) => !scopeSet.has(id));
        return Array.from(new Set([...preserved, ...keys]));
      });
    },
    [setSelectedMaterialIds]
  );

  return {
    materialSearch,
    setMaterialSearch,
    deferredMaterialSearch,
    materialTempFilter,
    setMaterialTempFilter,
    materialStatusFilter,
    setMaterialStatusFilter,
    materialDueFilter,
    setMaterialDueFilter,
    materialSteelFilter,
    setMaterialSteelFilter,
    priorityHitFilter,
    setPriorityHitFilter,
    forecastReadyDateFilter,
    setForecastReadyDateFilter,
    forecastMaterialIdsFilter,
    setForecastMaterialIdsFilter,
    widthMin,
    setWidthMin,
    widthMax,
    setWidthMax,
    thicknessMin,
    setThicknessMin,
    thicknessMax,
    setThicknessMax,
    getDueBucket,
    resetMaterialFilters,
    steelOptions,
    scheduledMaterialIds,
    unscheduledMaterials,
    baseAvailableMaterials,
    availableMaterials,
    materialStats,
    selectedMaterialSet,
    selectedMaterials,
    selectedFrozenCount,
    selectedWaitingCount,
    selectedReadyPendingCount,
    canAddSelected,
    materialAddBlockedReason,
    materialGroups,
    readySelectedMaterialIds,
    waitingSelectedMaterialIds,
    handleScopedMaterialSelectionChange,
  };
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { message } from 'antd';
import type { NavigateFunction } from 'react-router-dom';

import { scheduleApi } from '../../services/scheduleApi';
import { materialApi } from '../../services/materialApi';
import { configApi } from '../../services/configApi';
import { fieldMappingApi } from '../../services/fieldMappingApi';
import type { SchedulePlan, ExportTemplate } from '../../types/schedule';
import type { Material } from '../../types/material';
import type {
  StrategyTemplate,
  PriorityDimensionConfig,
  CustomerPriorityConfig,
  BatchPriorityConfig,
  ProductTypePriorityConfig,
} from '../../types/config';
import type { FieldMapping as FieldMappingType } from '../../types/fieldMapping';
import { getErrorMessage } from '../../utils/error';
import type { ScheduleRow } from './types';
import type { GanttGroupBy } from './types';
import { GANTT_ZOOM_STORAGE_KEY, GANTT_GROUP_BY_STORAGE_KEY } from './constants';

export interface UseWorkbenchDataParams {
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  // For URL param effects:
  setActivePanel: (v: 'materials' | 'schedule') => void;
  setScheduleViewMode: (v: 'list' | 'gantt') => void;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<number[]>>;
  setFocusedScheduleItemId: React.Dispatch<React.SetStateAction<number | null>>;
  // For forecast filter:
  setMaterialTempFilter: React.Dispatch<React.SetStateAction<'all' | 'ready' | 'waiting'>>;
  setMaterialStatusFilter: React.Dispatch<React.SetStateAction<'all' | 'pending' | 'frozen'>>;
  setForecastReadyDateFilter: React.Dispatch<React.SetStateAction<string | null>>;
  setForecastMaterialIdsFilter: React.Dispatch<React.SetStateAction<number[] | null>>;
  // For modal-triggered loads:
  importModalOpen: boolean;
  exportModalOpen: boolean;
  // For focused item cleanup:
  focusedScheduleItemId: number | null;
}

export interface UseWorkbenchDataReturn {
  plans: SchedulePlan[];
  setPlans: React.Dispatch<React.SetStateAction<SchedulePlan[]>>;
  currentPlan: SchedulePlan | null;
  setCurrentPlan: React.Dispatch<React.SetStateAction<SchedulePlan | null>>;
  scheduleItems: ScheduleRow[];
  setScheduleItems: React.Dispatch<React.SetStateAction<ScheduleRow[]>>;
  materials: Material[];
  setMaterials: React.Dispatch<React.SetStateAction<Material[]>>;
  strategies: StrategyTemplate[];
  setStrategies: React.Dispatch<React.SetStateAction<StrategyTemplate[]>>;
  loading: boolean;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  scheduling: boolean;
  setScheduling: React.Dispatch<React.SetStateAction<boolean>>;
  undoCount: number;
  setUndoCount: React.Dispatch<React.SetStateAction<number>>;
  redoCount: number;
  setRedoCount: React.Dispatch<React.SetStateAction<number>>;
  shiftCapacity: number;
  dailyTarget: number;
  capacityWarningYellow: number;
  capacityWarningRed: number;
  mappingTemplates: FieldMappingType[];
  exportTemplates: ExportTemplate[];
  exportTemplateId: number | null;
  setExportTemplateId: React.Dispatch<React.SetStateAction<number | null>>;
  priorityDimensionConfigs: PriorityDimensionConfig[];
  customerPriorityConfigs: CustomerPriorityConfig[];
  batchPriorityConfigs: BatchPriorityConfig[];
  productTypePriorityConfigs: ProductTypePriorityConfig[];
  ganttZoom: number;
  setGanttZoom: React.Dispatch<React.SetStateAction<number>>;
  ganttGroupBy: GanttGroupBy;
  setGanttGroupBy: React.Dispatch<React.SetStateAction<GanttGroupBy>>;
  viewportHeight: number;
  loadPlans: () => Promise<void>;
  loadMaterials: () => Promise<void>;
  loadStrategies: () => Promise<void>;
  loadPriorityConfigContext: () => Promise<void>;
  loadCapacityConfig: () => Promise<void>;
  loadMappingTemplates: () => Promise<void>;
  loadExportTemplates: () => Promise<void>;
  loadScheduleItems: (planId: number) => Promise<void>;
  loadUndoRedoCount: (planId: number) => Promise<void>;
  clearForecastFilter: (syncUrl: boolean) => void;
  queryFocusAppliedRef: React.MutableRefObject<boolean>;
}

export function useWorkbenchData(params: UseWorkbenchDataParams): UseWorkbenchDataReturn {
  const {
    navigate,
    searchParams,
    setActivePanel,
    setScheduleViewMode,
    setSelectedItemIds,
    setFocusedScheduleItemId,
    setMaterialTempFilter,
    setMaterialStatusFilter,
    setForecastReadyDateFilter,
    setForecastMaterialIdsFilter,
    importModalOpen,
    exportModalOpen,
    focusedScheduleItemId,
  } = params;

  // ─── State ───
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<SchedulePlan | null>(null);
  const [scheduleItems, setScheduleItems] = useState<ScheduleRow[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [strategies, setStrategies] = useState<StrategyTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);
  const [shiftCapacity, setShiftCapacity] = useState(0);
  const [dailyTarget, setDailyTarget] = useState(0);
  const [capacityWarningYellow, setCapacityWarningYellow] = useState(85);
  const [capacityWarningRed, setCapacityWarningRed] = useState(95);
  const [mappingTemplates, setMappingTemplates] = useState<FieldMappingType[]>([]);
  const [exportTemplates, setExportTemplates] = useState<ExportTemplate[]>([]);
  const [exportTemplateId, setExportTemplateId] = useState<number | null>(null);
  const [priorityDimensionConfigs, setPriorityDimensionConfigs] = useState<
    PriorityDimensionConfig[]
  >([]);
  const [customerPriorityConfigs, setCustomerPriorityConfigs] = useState<CustomerPriorityConfig[]>(
    []
  );
  const [batchPriorityConfigs, setBatchPriorityConfigs] = useState<BatchPriorityConfig[]>([]);
  const [productTypePriorityConfigs, setProductTypePriorityConfigs] = useState<
    ProductTypePriorityConfig[]
  >([]);
  const [ganttZoom, setGanttZoom] = useState(1);
  const [ganttGroupBy, setGanttGroupBy] = useState<GanttGroupBy>('none');
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  const queryPlanAppliedRef = useRef(false);
  const queryFocusAppliedRef = useRef(false);
  const queryForecastAppliedRef = useRef<string | null>(null);

  // ─── Data Loading Callbacks ───
  const loadPlans = useCallback(async () => {
    try {
      const data = await scheduleApi.getPlans();
      setPlans(data);
    } catch (error: unknown) {
      message.error(`加载方案列表失败: ${getErrorMessage(error)}`);
    }
  }, []);

  const loadMaterials = useCallback(async () => {
    try {
      const result = await materialApi.getMaterials(undefined, { page: 1, page_size: 5000 });
      setMaterials(result.items);
    } catch (error: unknown) {
      message.error(`加载材料失败: ${getErrorMessage(error)}`);
    }
  }, []);

  const loadStrategies = useCallback(async () => {
    try {
      const data = await configApi.getStrategyTemplates();
      setStrategies(data);
    } catch (error: unknown) {
      message.error(`加载策略列表失败: ${getErrorMessage(error)}`);
    }
  }, []);

  const loadPriorityConfigContext = useCallback(async () => {
    try {
      const [dimensions, customers, batches, products] = await Promise.all([
        configApi.getPriorityDimensionConfigs(),
        configApi.getCustomerPriorityConfigs(),
        configApi.getBatchPriorityConfigs(),
        configApi.getProductTypePriorityConfigs(),
      ]);
      setPriorityDimensionConfigs(dimensions.filter((item) => item.enabled));
      setCustomerPriorityConfigs(customers.filter((item) => item.enabled));
      setBatchPriorityConfigs(batches.filter((item) => item.enabled));
      setProductTypePriorityConfigs(products.filter((item) => item.enabled));
    } catch {
      setPriorityDimensionConfigs([]);
      setCustomerPriorityConfigs([]);
      setBatchPriorityConfigs([]);
      setProductTypePriorityConfigs([]);
    }
  }, []);

  const loadCapacityConfig = useCallback(async () => {
    try {
      const data = await configApi.getSystemConfig();
      const shiftCap = Number(data.capacity?.shift_capacity?.value ?? 0);
      const daily = Number(data.capacity?.daily_target?.value ?? 0);
      const yellow = Number(data.warning?.capacity_yellow?.value ?? 85);
      const red = Number(data.warning?.capacity_red?.value ?? 95);
      setShiftCapacity(Number.isFinite(shiftCap) && shiftCap > 0 ? shiftCap : 0);
      setDailyTarget(Number.isFinite(daily) && daily > 0 ? daily : 0);
      setCapacityWarningYellow(Number.isFinite(yellow) && yellow > 0 ? yellow : 85);
      setCapacityWarningRed(Number.isFinite(red) && red > 0 ? red : 95);
    } catch {
      setShiftCapacity(0);
      setDailyTarget(0);
      setCapacityWarningYellow(85);
      setCapacityWarningRed(95);
    }
  }, []);

  const loadMappingTemplates = useCallback(async () => {
    try {
      const data = await fieldMappingApi.getFieldMappings();
      setMappingTemplates(data);
    } catch (error: unknown) {
      message.error(`加载映射模板失败: ${getErrorMessage(error)}`);
    }
  }, []);

  const loadExportTemplates = useCallback(async () => {
    try {
      const data = await scheduleApi.getExportTemplates();
      setExportTemplates(data);
      const defaultTemplate = data.find((item) => item.is_default);
      setExportTemplateId(defaultTemplate?.id ?? null);
    } catch (error: unknown) {
      message.error(`加载导出模板失败: ${getErrorMessage(error)}`);
    }
  }, []);

  const loadScheduleItems = useCallback(
    async (planId: number) => {
      try {
        setLoading(true);
        // 先刷新材料列表确保最新（避免闭包中 materials 状态过期）
        // 两步加载：先获取总数，再全量获取，避免分页遗漏
        const probe = await materialApi.getMaterials(undefined, { page: 1, page_size: 1 });
        const totalMaterials = probe.total || 10000;
        const result = await materialApi.getMaterials(undefined, { page: 1, page_size: totalMaterials });
        const freshMaterials = result.items;
        setMaterials(freshMaterials);

        const items = await scheduleApi.getScheduleItems(planId);
        // 用最新材料构建关联
        const materialMap = new Map(freshMaterials.map((m) => [m.id, m]));
        const rows: ScheduleRow[] = items.map((item) => ({
          ...item,
          material: materialMap.get(item.material_id),
        }));

        const missingCount = rows.filter((r) => !r.material).length;
        if (missingCount > 0) {
          console.warn(`[排程] ${missingCount} 条排程项未找到关联材料`);
        }

        setScheduleItems(rows);
      } catch (error: unknown) {
        message.error(`加载排程项失败: ${getErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const loadUndoRedoCount = useCallback(async (planId: number) => {
    try {
      const [undo, redo] = await scheduleApi.getUndoRedoCount(planId);
      setUndoCount(undo);
      setRedoCount(redo);
    } catch {
      setUndoCount(0);
      setRedoCount(0);
    }
  }, []);

  const clearForecastFilter = useCallback(
    (syncUrl: boolean) => {
      setForecastReadyDateFilter(null);
      setForecastMaterialIdsFilter(null);
      queryForecastAppliedRef.current = null;
      if (!syncUrl) return;
      const next = new URLSearchParams(searchParams);
      if (!next.has('forecastReadyDate')) return;
      next.delete('forecastReadyDate');
      const nextQuery = next.toString();
      navigate(nextQuery ? `/?${nextQuery}` : '/', { replace: true });
    },
    [navigate, searchParams, setForecastReadyDateFilter, setForecastMaterialIdsFilter]
  );

  // ─── Effects ───

  // Initial data loading
  useEffect(() => {
    loadPlans();
    loadMaterials();
    loadStrategies();
    loadCapacityConfig();
    loadPriorityConfigContext();
  }, [loadPlans, loadMaterials, loadStrategies, loadCapacityConfig, loadPriorityConfigContext]);

  // Gantt zoom localStorage read
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(GANTT_ZOOM_STORAGE_KEY);
      if (!raw) return;
      const parsed = Number(raw);
      if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 3) {
        setGanttZoom(Number(parsed.toFixed(1)));
      }
    } catch {
      // ignore
    }
  }, []);

  // Gantt zoom localStorage write
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GANTT_ZOOM_STORAGE_KEY, String(ganttZoom));
    } catch {
      // ignore
    }
  }, [ganttZoom]);

  // Gantt groupBy localStorage read
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(GANTT_GROUP_BY_STORAGE_KEY);
      if (raw && ['none', 'date', 'date+product', 'date+grade'].includes(raw)) {
        setGanttGroupBy(raw as GanttGroupBy);
      }
    } catch {
      // ignore
    }
  }, []);

  // Gantt groupBy localStorage write
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GANTT_GROUP_BY_STORAGE_KEY, ganttGroupBy);
    } catch {
      // ignore
    }
  }, [ganttGroupBy]);

  // currentPlan change → load items
  useEffect(() => {
    if (currentPlan) {
      loadScheduleItems(currentPlan.id);
      loadUndoRedoCount(currentPlan.id);
    } else {
      setScheduleItems([]);
      setUndoCount(0);
      setRedoCount(0);
    }
  }, [currentPlan, loadScheduleItems, loadUndoRedoCount]);

  // URL param plan selection
  useEffect(() => {
    if (queryPlanAppliedRef.current) return;
    const queryPlanId = Number(searchParams.get('planId'));
    if (!Number.isFinite(queryPlanId) || queryPlanId <= 0) return;
    const target = plans.find((item) => item.id === queryPlanId);
    if (!target) return;
    queryPlanAppliedRef.current = true;
    setCurrentPlan(target);
  }, [plans, searchParams]);

  // URL param focus
  useEffect(() => {
    if (queryFocusAppliedRef.current) return;
    if (!currentPlan || scheduleItems.length === 0) return;
    const queryPlanId = Number(searchParams.get('planId'));
    if (Number.isFinite(queryPlanId) && queryPlanId > 0 && currentPlan.id !== queryPlanId) return;
    const focusMaterialId = Number(searchParams.get('focusMaterialId'));
    const focusSeq = Number(searchParams.get('focusSeq'));
    const focusByMaterial =
      Number.isFinite(focusMaterialId) && focusMaterialId > 0
        ? scheduleItems.find((item) => item.material_id === focusMaterialId)
        : undefined;
    const focusBySequence =
      Number.isFinite(focusSeq) && focusSeq > 0
        ? scheduleItems.find((item) => item.sequence === focusSeq)
        : undefined;
    const target = focusByMaterial ?? focusBySequence;
    if (!target) return;
    queryFocusAppliedRef.current = true;
    setScheduleViewMode('list');
    setActivePanel('schedule');
    setSelectedItemIds([target.id]);
    setFocusedScheduleItemId(target.id);
    message.info(
      `已定位到 ${target.material?.coil_id ?? `材料${target.material_id}`}（序号#${target.sequence}）`
    );
  }, [
    currentPlan,
    scheduleItems,
    searchParams,
    setActivePanel,
    setScheduleViewMode,
    setSelectedItemIds,
    setFocusedScheduleItemId,
  ]);

  // Forecast filter from URL
  useEffect(() => {
    const forecastReadyDateRaw = searchParams.get('forecastReadyDate');
    if (!forecastReadyDateRaw) {
      clearForecastFilter(false);
      return;
    }
    const forecastReadyDate = decodeURIComponent(forecastReadyDateRaw);
    if (queryForecastAppliedRef.current === forecastReadyDate) return;
    queryForecastAppliedRef.current = forecastReadyDate;
    setActivePanel('materials');
    setMaterialTempFilter('waiting');
    setMaterialStatusFilter('pending');
    setForecastReadyDateFilter(forecastReadyDate);
    void (async () => {
      try {
        const details = await scheduleApi.getWaitingForecastDetails(forecastReadyDate);
        setForecastMaterialIdsFilter(
          details.map((item: { material_id: number }) => item.material_id)
        );
        if (details.length === 0) {
          message.warning(`${forecastReadyDate} 预测明细为空，已按空结果过滤`);
          return;
        }
        message.info(`已筛选 ${forecastReadyDate} 预计适温材料 ${details.length} 条`);
      } catch (error: unknown) {
        setForecastMaterialIdsFilter([]);
        message.error(`加载待温明细失败: ${getErrorMessage(error)}`);
      }
    })();
  }, [
    clearForecastFilter,
    searchParams,
    setActivePanel,
    setMaterialTempFilter,
    setMaterialStatusFilter,
    setForecastReadyDateFilter,
    setForecastMaterialIdsFilter,
  ]);

  // Cleanup focused item
  useEffect(() => {
    if (focusedScheduleItemId == null) return;
    if (!scheduleItems.some((item) => item.id === focusedScheduleItemId)) {
      setFocusedScheduleItemId(null);
    }
  }, [focusedScheduleItemId, scheduleItems, setFocusedScheduleItemId]);

  // Load mapping templates when import opens
  useEffect(() => {
    if (!importModalOpen) return;
    loadMappingTemplates();
  }, [importModalOpen, loadMappingTemplates]);

  // Load export templates when export opens
  useEffect(() => {
    if (!exportModalOpen) return;
    loadExportTemplates();
  }, [exportModalOpen, loadExportTemplates]);

  // Window resize
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return {
    plans,
    setPlans,
    currentPlan,
    setCurrentPlan,
    scheduleItems,
    setScheduleItems,
    materials,
    setMaterials,
    strategies,
    setStrategies,
    loading,
    setLoading,
    scheduling,
    setScheduling,
    undoCount,
    setUndoCount,
    redoCount,
    setRedoCount,
    shiftCapacity,
    dailyTarget,
    capacityWarningYellow,
    capacityWarningRed,
    mappingTemplates,
    exportTemplates,
    exportTemplateId,
    setExportTemplateId,
    priorityDimensionConfigs,
    customerPriorityConfigs,
    batchPriorityConfigs,
    productTypePriorityConfigs,
    ganttZoom,
    setGanttZoom,
    ganttGroupBy,
    setGanttGroupBy,
    viewportHeight,
    loadPlans,
    loadMaterials,
    loadStrategies,
    loadPriorityConfigContext,
    loadCapacityConfig,
    loadMappingTemplates,
    loadExportTemplates,
    loadScheduleItems,
    loadUndoRedoCount,
    clearForecastFilter,
    queryFocusAppliedRef,
  };
}

import { useEffect, useMemo, useState } from 'react';
import { message } from 'antd';

import { materialApi } from '../../services/materialApi';
import { scheduleApi } from '../../services/scheduleApi';
import type { Material } from '../../types/material';
import { getErrorMessage } from '../../utils/error';
import { calcPriorityDeliveryCode, isAssessmentContract } from '../../utils/priorityHit';

export type InventoryColorMode = 'product_type' | 'delivery' | 'assessment' | 'export';
export type StockBucketKey = 'd5p' | 'd4' | 'd3' | 'd2' | 'd1' | 'd0';

export interface InventoryMetric {
  totalWeight: number;
  totalCount: number;
  scheduledWeight: number;
  scheduledCount: number;
}

export interface InventoryBucketMetrics {
  d5p: InventoryMetric;
  d4: InventoryMetric;
  d3: InventoryMetric;
  d2: InventoryMetric;
  d1: InventoryMetric;
  d0: InventoryMetric;
}

export interface InventoryRow {
  key: string;
  label: string;
  color?: string;
  isTotal?: boolean;
  byBucket: InventoryBucketMetrics;
  total: InventoryMetric;
}

interface UseRiskInventoryReturn {
  colorMode: InventoryColorMode;
  setColorMode: React.Dispatch<React.SetStateAction<InventoryColorMode>>;
  loading: boolean;
  rows: InventoryRow[];
  totalMetric: InventoryMetric;
  scopedMaterialCount: number;
  scopedMaterialWeight: number;
}

const STOCK_BUCKET_ORDER: StockBucketKey[] = ['d5p', 'd4', 'd3', 'd2', 'd1', 'd0'];

export const stockBucketLabelMap: Record<StockBucketKey, string> = {
  d5p: '5+天',
  d4: '4天',
  d3: '3天',
  d2: '2天',
  d1: '1天',
  d0: '0天',
};

const deliveryLabelMap: Record<string, string> = {
  'D+0': 'D+0',
  'D+7': 'D+7',
  super_overdue: '超前欠',
  double_overdue: '双前欠',
  overdue: '前欠',
  current_period: '本期',
  next_period: '次月本期',
  no_requirement: '无要求',
};

const COLOR_PALETTE = [
  '#1677ff',
  '#13c2c2',
  '#52c41a',
  '#fa8c16',
  '#eb2f96',
  '#722ed1',
  '#2f54eb',
  '#08979c',
  '#389e0d',
  '#faad14',
];

function createMetric(): InventoryMetric {
  return {
    totalWeight: 0,
    totalCount: 0,
    scheduledWeight: 0,
    scheduledCount: 0,
  };
}

function createBucketMetrics(): InventoryBucketMetrics {
  return {
    d5p: createMetric(),
    d4: createMetric(),
    d3: createMetric(),
    d2: createMetric(),
    d1: createMetric(),
    d0: createMetric(),
  };
}

function mergeBucketMetrics(bucketMetrics: InventoryBucketMetrics): InventoryMetric {
  const result = createMetric();
  STOCK_BUCKET_ORDER.forEach((bucket) => {
    const metric = bucketMetrics[bucket];
    result.totalWeight += metric.totalWeight;
    result.totalCount += metric.totalCount;
    result.scheduledWeight += metric.scheduledWeight;
    result.scheduledCount += metric.scheduledCount;
  });
  return result;
}

function applyMetric(metric: InventoryMetric, weight: number, scheduled: boolean) {
  metric.totalWeight += weight;
  metric.totalCount += 1;
  if (scheduled) {
    metric.scheduledWeight += weight;
    metric.scheduledCount += 1;
  }
}

function hashString(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function resolveDynamicColor(key: string): string {
  return COLOR_PALETTE[hashString(key) % COLOR_PALETTE.length];
}

function resolveGroup(material: Material, colorMode: InventoryColorMode) {
  if (colorMode === 'assessment') {
    const assessed = isAssessmentContract(material);
    return {
      key: assessed ? 'assessed' : 'not_assessed',
      label: assessed ? '考核合同' : '非考核合同',
      color: assessed ? '#eb2f96' : '#8c8c8c',
    };
  }
  if (colorMode === 'export') {
    const exported = Boolean(material.export_flag);
    return {
      key: exported ? 'export' : 'domestic',
      label: exported ? '出口' : '内销',
      color: exported ? '#faad14' : '#1677ff',
    };
  }
  if (colorMode === 'delivery') {
    const code = calcPriorityDeliveryCode(material.due_date);
    return {
      key: code,
      label: deliveryLabelMap[code] ?? code,
      color:
        code === 'overdue' || code === 'super_overdue' || code === 'double_overdue'
          ? '#ff4d4f'
          : resolveDynamicColor(code),
    };
  }
  const productType = material.product_type?.trim() || '未分类';
  return {
    key: productType,
    label: productType,
    color: resolveDynamicColor(productType),
  };
}

function resolveStockBucket(coilingTime: string): StockBucketKey {
  const parsed = new Date(coilingTime);
  if (Number.isNaN(parsed.getTime())) return 'd0';
  const coilingStart = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate()
  ).getTime();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((todayStart - coilingStart) / (24 * 60 * 60 * 1000));
  if (diffDays >= 5) return 'd5p';
  if (diffDays <= 0) return 'd0';
  if (diffDays === 4) return 'd4';
  if (diffDays === 3) return 'd3';
  if (diffDays === 2) return 'd2';
  return 'd1';
}

function resolveScopedMaterials(items: Material[]): Material[] {
  return items.filter((item) => {
    const status = (item.status as string | undefined) ?? 'pending';
    return status !== 'completed';
  });
}

export function useRiskInventory(selectedPlanId: number | null): UseRiskInventoryReturn {
  const [colorMode, setColorMode] = useState<InventoryColorMode>('product_type');
  const [loading, setLoading] = useState(false);
  const [scopedMaterials, setScopedMaterials] = useState<Material[]>([]);
  const [scheduledMaterialIds, setScheduledMaterialIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      if (!selectedPlanId) {
        setScopedMaterials([]);
        setScheduledMaterialIds(new Set());
        return;
      }
      setLoading(true);
      try {
        const probe = await materialApi.getMaterials(undefined, { page: 1, page_size: 1 });
        const pageSize = Math.max(probe.total, 1);
        const [materialResult, scheduleItems] = await Promise.all([
          materialApi.getMaterials(undefined, { page: 1, page_size: pageSize }),
          scheduleApi.getScheduleItems(selectedPlanId),
        ]);
        if (!mounted) return;
        setScopedMaterials(resolveScopedMaterials(materialResult.items));
        setScheduledMaterialIds(new Set(scheduleItems.map((item) => item.material_id)));
      } catch (error: unknown) {
        if (!mounted) return;
        message.error(`加载库存情况失败: ${getErrorMessage(error)}`);
        setScopedMaterials([]);
        setScheduledMaterialIds(new Set());
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, [selectedPlanId]);

  const rows = useMemo<InventoryRow[]>(() => {
    if (scopedMaterials.length === 0) return [];
    const overallByBucket = createBucketMetrics();
    const groupMap = new Map<
      string,
      {
        key: string;
        label: string;
        color: string;
        byBucket: InventoryBucketMetrics;
      }
    >();

    scopedMaterials.forEach((material) => {
      const bucket = resolveStockBucket(material.coiling_time);
      const weight = Number(material.weight) || 0;
      const scheduled = scheduledMaterialIds.has(material.id);
      applyMetric(overallByBucket[bucket], weight, scheduled);

      const group = resolveGroup(material, colorMode);
      if (!groupMap.has(group.key)) {
        groupMap.set(group.key, {
          key: group.key,
          label: group.label,
          color: group.color,
          byBucket: createBucketMetrics(),
        });
      }
      const row = groupMap.get(group.key);
      if (row) {
        applyMetric(row.byBucket[bucket], weight, scheduled);
      }
    });

    const totalRow: InventoryRow = {
      key: 'overall',
      label: '总库存',
      isTotal: true,
      byBucket: overallByBucket,
      total: mergeBucketMetrics(overallByBucket),
    };

    const groupRows: InventoryRow[] = Array.from(groupMap.values())
      .map((row) => ({
        key: row.key,
        label: row.label,
        color: row.color,
        byBucket: row.byBucket,
        total: mergeBucketMetrics(row.byBucket),
      }))
      .sort((a, b) => {
        if (b.total.totalWeight !== a.total.totalWeight) {
          return b.total.totalWeight - a.total.totalWeight;
        }
        return a.label.localeCompare(b.label, 'zh-CN');
      });

    return [totalRow, ...groupRows];
  }, [colorMode, scheduledMaterialIds, scopedMaterials]);

  const totalMetric = useMemo(() => {
    if (rows.length === 0) return createMetric();
    return rows[0].total;
  }, [rows]);

  const scopedMaterialWeight = totalMetric.totalWeight;

  return {
    colorMode,
    setColorMode,
    loading,
    rows,
    totalMetric,
    scopedMaterialCount: scopedMaterials.length,
    scopedMaterialWeight,
  };
}

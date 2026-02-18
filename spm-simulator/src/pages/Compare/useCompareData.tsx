import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button, Space, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { message } from 'antd';
import type { NavigateFunction } from 'react-router-dom';
import { save } from '@tauri-apps/plugin-dialog';

import { scheduleApi } from '../../services/scheduleApi';
import type {
  SchedulePlan,
  PlanComparisonResult,
  PlanComparisonSide,
  MultiPlanComparisonResult,
  SequenceChangeItem,
} from '../../types/schedule';
import { getErrorMessage } from '../../utils/error';
import type { ThreeModeSequencePair } from './types';
import { comparePlanQuality, buildRecommendReason } from './utils';

export interface UseCompareDataParams {
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
}

export function useCompareData({ navigate, searchParams }: UseCompareDataParams) {
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [planAId, setPlanAId] = useState<number | null>(null);
  const [planBId, setPlanBId] = useState<number | null>(null);
  const [planCId, setPlanCId] = useState<number | null>(null);
  const [result, setResult] = useState<PlanComparisonResult | null>(null);
  const [multiResult, setMultiResult] = useState<MultiPlanComparisonResult | null>(null);
  const [threeModePairs, setThreeModePairs] = useState<ThreeModeSequencePair[]>([]);
  const [threeModePairKey, setThreeModePairKey] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [exportingSequence, setExportingSequence] = useState(false);
  const [queryAutoCompared, setQueryAutoCompared] = useState(false);
  const isThreeMode = !!planCId && planCId !== planAId && planCId !== planBId;

  const loadPlans = useCallback(async () => {
    try {
      const data = await scheduleApi.getPlans();
      setPlans(data);
    } catch (error: unknown) {
      message.error(`加载方案失败: ${getErrorMessage(error)}`);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (plans.length === 0) return;
    const planA = Number(searchParams.get('planA'));
    const planB = Number(searchParams.get('planB'));
    const planC = Number(searchParams.get('planC'));
    if (!Number.isFinite(planA) || !Number.isFinite(planB)) return;
    if (planA <= 0 || planB <= 0) return;
    if (!plans.some((p) => p.id === planA) || !plans.some((p) => p.id === planB)) return;
    setPlanAId(planA);
    setPlanBId(planB);
    if (Number.isFinite(planC) && planC > 0 && plans.some((p) => p.id === planC)) {
      setPlanCId(planC);
    }
  }, [plans, searchParams]);

  const handleCompare = useCallback(async () => {
    if (!planAId || !planBId) {
      message.warning('请选择两个方案进行对比');
      return;
    }
    if (planAId === planBId) {
      message.warning('请选择不同的方案进行对比');
      return;
    }
    try {
      setLoading(true);
      if (isThreeMode && planCId) {
        if (planCId === planAId || planCId === planBId) {
          message.warning('第三个方案必须与 A/B 不同');
          return;
        }
        const pairConfigs = [
          { a: planAId, b: planBId, label: 'A vs B' },
          { a: planAId, b: planCId, label: 'A vs C' },
          { a: planBId, b: planCId, label: 'B vs C' },
        ];
        const [multiData, pairResults] = await Promise.all([
          scheduleApi.comparePlansMulti([planAId, planBId, planCId]),
          Promise.all(
            pairConfigs.map(async (pair) => {
              const detail = await scheduleApi.comparePlans(pair.a, pair.b);
              return { ...pair, detail };
            })
          ),
        ]);
        setMultiResult(multiData);
        setResult(null);
        const pairData = pairResults.map((item) => {
          const planALabel = plans.find((p) => p.id === item.a)?.name ?? `方案${item.a}`;
          const planBLabel = plans.find((p) => p.id === item.b)?.name ?? `方案${item.b}`;
          return {
            key: `${item.a}-${item.b}`,
            label: `${planALabel} vs ${planBLabel}`,
            plan_a_id: item.a,
            plan_b_id: item.b,
            plan_a_label: planALabel,
            plan_b_label: planBLabel,
            changes: item.detail.sequence_changes,
          };
        });
        setThreeModePairs(pairData);
        setThreeModePairKey((prev) =>
          pairData.some((item) => item.key === prev) ? prev : (pairData[0]?.key ?? '')
        );
      } else {
        const data = await scheduleApi.comparePlans(planAId, planBId);
        setResult(data);
        setMultiResult(null);
        setThreeModePairs([]);
        setThreeModePairKey('');
      }
    } catch (error: unknown) {
      message.error(`对比失败: ${getErrorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [planAId, planBId, planCId, isThreeMode, plans]);

  useEffect(() => {
    const planA = Number(searchParams.get('planA'));
    const planB = Number(searchParams.get('planB'));
    const planC = Number(searchParams.get('planC'));
    const hasQueryPair = Number.isFinite(planA) && Number.isFinite(planB) && planA > 0 && planB > 0;
    if (!hasQueryPair || queryAutoCompared) return;
    if (!planAId || !planBId) return;
    if (planAId !== planA || planBId !== planB) return;
    if (Number.isFinite(planC) && planC > 0 && (!planCId || planCId !== planC)) return;
    setQueryAutoCompared(true);
    void handleCompare();
  }, [searchParams, queryAutoCompared, planAId, planBId, planCId, handleCompare]);

  // ─── Derived data ───

  const planOptions = useMemo(
    () =>
      plans.map((p) => ({
        value: p.id,
        label: `${p.name} (${p.plan_no}) ${p.score_overall != null ? `[${p.score_overall}分]` : ''}`,
      })),
    [plans]
  );

  const planLabelById = useMemo(
    () => new Map(plans.map((p) => [p.id, `${p.name} (${p.plan_no})`])),
    [plans]
  );

  const twoModeRecommendation = useMemo(() => {
    if (!result) return null;
    const ranked = [result.plan_a, result.plan_b].sort(comparePlanQuality);
    return {
      recommendedId: ranked[0].plan_id,
      reason: buildRecommendReason(ranked[0], ranked[1]),
    };
  }, [result]);

  const threeModeRecommendation = useMemo(() => {
    if (!multiResult || multiResult.plans.length === 0) return null;
    const ranked = [...multiResult.plans].sort(comparePlanQuality);
    return {
      recommendedId: ranked[0].plan_id,
      reason: ranked.length > 1 ? buildRecommendReason(ranked[0], ranked[1]) : '综合评分更高',
    };
  }, [multiResult]);

  // ─── Tables: Coils ───

  const coilColumns = useMemo<TableColumnsType<{ coil_id: string; source: string }>>(
    () => [
      { title: '卷号', dataIndex: 'coil_id', ellipsis: true },
      {
        title: '归属',
        dataIndex: 'source',
        width: 120,
        align: 'center',
        render: (v: string) => {
          const color = v === '共有' ? 'green' : v.includes('A') ? 'blue' : 'red';
          return <Tag color={color}>{v}</Tag>;
        },
      },
    ],
    []
  );

  const coilData = useMemo(
    () =>
      result
        ? [
            ...result.common_coils.map((c) => ({ coil_id: c, source: '共有' })),
            ...result.only_a_coils.map((c) => ({ coil_id: c, source: `仅A` })),
            ...result.only_b_coils.map((c) => ({ coil_id: c, source: `仅B` })),
          ]
        : [],
    [result]
  );

  // ─── Tables: Sequence changes (two-mode) ───

  const sequenceChangeColumns = useMemo<TableColumnsType<SequenceChangeItem>>(
    () => [
      { title: '卷号', dataIndex: 'coil_id', width: 140, ellipsis: true },
      {
        title: 'A序号',
        dataIndex: 'sequence_a',
        width: 90,
        align: 'right',
        render: (v: number) => `#${v}`,
      },
      {
        title: 'B序号',
        dataIndex: 'sequence_b',
        width: 90,
        align: 'right',
        render: (v: number) => `#${v}`,
      },
      {
        title: '变化(B-A)',
        dataIndex: 'delta',
        width: 120,
        align: 'right',
        render: (v: number) => {
          if (v > 0)
            return (
              <span style={{ color: '#d46b08', fontWeight: 500 }}>
                <ArrowDownOutlined /> 后移 +{v}
              </span>
            );
          if (v < 0)
            return (
              <span style={{ color: '#1677ff', fontWeight: 500 }}>
                <ArrowUpOutlined /> 前移 {Math.abs(v)}
              </span>
            );
          return <span style={{ color: '#999' }}>-</span>;
        },
      },
      {
        title: '定位',
        key: 'locate',
        width: 120,
        align: 'center',
        render: (_: unknown, row: SequenceChangeItem) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!planAId}
              onClick={() => {
                if (planAId) navigate(`/?planId=${planAId}&focusSeq=${row.sequence_a}`);
              }}
            >
              定位A
            </Button>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!planBId}
              onClick={() => {
                if (planBId) navigate(`/?planId=${planBId}&focusSeq=${row.sequence_b}`);
              }}
            >
              定位B
            </Button>
          </Space>
        ),
      },
    ],
    [navigate, planAId, planBId]
  );

  const sequenceChangeData = useMemo(() => result?.sequence_changes ?? [], [result]);
  const sequenceAvgMove = useMemo(
    () =>
      sequenceChangeData.length > 0
        ? (
            sequenceChangeData.reduce((sum, item) => sum + Math.abs(item.delta), 0) /
            sequenceChangeData.length
          ).toFixed(1)
        : '0.0',
    [sequenceChangeData]
  );

  // ─── Tables: Sequence changes (three-mode) ───

  const selectedThreeModePair =
    threeModePairs.find((item) => item.key === threeModePairKey) ?? threeModePairs[0] ?? null;

  const selectedThreeModeAvgMove = useMemo(
    () =>
      selectedThreeModePair && selectedThreeModePair.changes.length > 0
        ? (
            selectedThreeModePair.changes.reduce((sum, item) => sum + Math.abs(item.delta), 0) /
            selectedThreeModePair.changes.length
          ).toFixed(1)
        : '0.0',
    [selectedThreeModePair]
  );

  const threeModeSequenceColumns = useMemo<TableColumnsType<SequenceChangeItem>>(
    () => [
      { title: '卷号', dataIndex: 'coil_id', width: 140, ellipsis: true },
      {
        title: `${selectedThreeModePair?.plan_a_label ?? '左侧'}序号`,
        dataIndex: 'sequence_a',
        width: 120,
        align: 'right',
        render: (v: number) => `#${v}`,
      },
      {
        title: `${selectedThreeModePair?.plan_b_label ?? '右侧'}序号`,
        dataIndex: 'sequence_b',
        width: 120,
        align: 'right',
        render: (v: number) => `#${v}`,
      },
      {
        title: '变化(B-A)',
        dataIndex: 'delta',
        width: 120,
        align: 'right',
        render: (v: number) => {
          if (v > 0)
            return (
              <span style={{ color: '#d46b08', fontWeight: 500 }}>
                <ArrowDownOutlined /> 后移 +{v}
              </span>
            );
          if (v < 0)
            return (
              <span style={{ color: '#1677ff', fontWeight: 500 }}>
                <ArrowUpOutlined /> 前移 {Math.abs(v)}
              </span>
            );
          return <span style={{ color: '#999' }}>-</span>;
        },
      },
      {
        title: '定位',
        key: 'locate',
        width: 120,
        align: 'center',
        render: (_: unknown, row: SequenceChangeItem) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!selectedThreeModePair}
              onClick={() => {
                if (selectedThreeModePair)
                  navigate(
                    `/?planId=${selectedThreeModePair.plan_a_id}&focusSeq=${row.sequence_a}`
                  );
              }}
            >
              定位左
            </Button>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!selectedThreeModePair}
              onClick={() => {
                if (selectedThreeModePair)
                  navigate(
                    `/?planId=${selectedThreeModePair.plan_b_id}&focusSeq=${row.sequence_b}`
                  );
              }}
            >
              定位右
            </Button>
          </Space>
        ),
      },
    ],
    [selectedThreeModePair, navigate]
  );

  // ─── Tables: Multi-mode metrics ───

  const multiMetricRows = useMemo(
    () =>
      multiResult
        ? [
            { key: 'score_overall', label: '综合评分', format: (v: number) => `${v}` },
            { key: 'score_sequence', label: '序列评分', format: (v: number) => `${v}` },
            { key: 'score_delivery', label: '交期评分', format: (v: number) => `${v}` },
            { key: 'score_efficiency', label: '效率评分', format: (v: number) => `${v}` },
            { key: 'total_count', label: '排程数', format: (v: number) => `${v}` },
            { key: 'total_weight', label: '总重量(t)', format: (v: number) => v.toFixed(1) },
            { key: 'roll_change_count', label: '换辊次数', format: (v: number) => `${v}` },
            { key: 'steel_grade_switches', label: '钢种切换', format: (v: number) => `${v}` },
            { key: 'risk_high', label: '高风险', format: (v: number) => `${v}` },
            { key: 'risk_medium', label: '中风险', format: (v: number) => `${v}` },
            { key: 'risk_low', label: '低风险', format: (v: number) => `${v}` },
          ].map((row) => {
            const record: Record<string, string | number> = { key: row.key, metric: row.label };
            multiResult.plans.forEach((side) => {
              const value = side[row.key as keyof PlanComparisonSide] as number;
              record[String(side.plan_id)] = row.format(value);
            });
            return record;
          })
        : [],
    [multiResult]
  );

  const multiMetricColumns = useMemo<TableColumnsType<Record<string, string | number>>>(
    () => [
      { title: '指标', dataIndex: 'metric', key: 'metric', width: 140, fixed: 'left' },
      ...(multiResult?.plans.map((side) => ({
        title: `${side.plan_name} (${side.plan_no})`,
        dataIndex: String(side.plan_id),
        key: String(side.plan_id),
        width: 170,
        align: 'right' as const,
      })) ?? []),
    ],
    [multiResult]
  );

  const overlapColumns = useMemo<
    TableColumnsType<{
      key: string;
      plan_pair: string;
      common_count: number;
      only_a_count: number;
      only_b_count: number;
    }>
  >(
    () => [
      { title: '方案对', dataIndex: 'plan_pair', key: 'plan_pair' },
      {
        title: '共有卷数',
        dataIndex: 'common_count',
        key: 'common_count',
        width: 100,
        align: 'right',
      },
      {
        title: '仅左侧',
        dataIndex: 'only_a_count',
        key: 'only_a_count',
        width: 100,
        align: 'right',
      },
      {
        title: '仅右侧',
        dataIndex: 'only_b_count',
        key: 'only_b_count',
        width: 100,
        align: 'right',
      },
    ],
    []
  );

  const overlapData = useMemo(
    () =>
      multiResult?.overlaps.map((row) => ({
        key: `${row.plan_a_id}-${row.plan_b_id}`,
        plan_pair: `${planLabelById.get(row.plan_a_id) || row.plan_a_id} vs ${planLabelById.get(row.plan_b_id) || row.plan_b_id}`,
        common_count: row.common_count,
        only_a_count: row.only_a_count,
        only_b_count: row.only_b_count,
      })) ?? [],
    [multiResult, planLabelById]
  );

  // ─── Export ───

  const handleExportSequence = useCallback(
    async (planA: number, planB: number, label: string, format: 'excel' | 'csv') => {
      try {
        const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '_').slice(0, 15);
        const ext = format === 'excel' ? 'xlsx' : 'csv';
        const filePath = await save({
          defaultPath: `顺序差异_${label}_${ts}.${ext}`,
          filters: [{ name: format === 'excel' ? 'Excel' : 'CSV', extensions: [ext] }],
        });
        if (!filePath) return;
        setExportingSequence(true);
        const count =
          format === 'excel'
            ? await scheduleApi.exportCompareSequenceExcel(planA, planB, filePath)
            : await scheduleApi.exportCompareSequenceCsv(planA, planB, filePath);
        message.success(`导出${format === 'excel' ? 'Excel' : 'CSV'}成功: ${count} 条顺序变化`);
      } catch (error: unknown) {
        message.error(`导出失败: ${getErrorMessage(error)}`);
      } finally {
        setExportingSequence(false);
      }
    },
    []
  );

  const handleConfirmPlan = useCallback(
    async (planId: number) => {
      try {
        await scheduleApi.updatePlanStatus(planId, 'confirmed');
        message.success('方案已确认生效');
        await loadPlans();
        // Re-run comparison to refresh status display
        if (result || multiResult) {
          const planIds = isThreeMode
            ? [planAId, planBId, planCId].filter(Boolean) as number[]
            : [planAId, planBId].filter(Boolean) as number[];
          if (planIds.length >= 2) {
            if (isThreeMode && planIds.length === 3) {
              const data = await scheduleApi.comparePlansMulti(planIds);
              setMultiResult(data);
            } else if (!isThreeMode) {
              const data = await scheduleApi.comparePlans(planIds[0], planIds[1]);
              setResult(data);
            }
          }
        }
      } catch (error: unknown) {
        message.error(`确认生效失败: ${getErrorMessage(error)}`);
      }
    },
    [loadPlans, result, multiResult, isThreeMode, planAId, planBId, planCId]
  );

  const handleArchivePlan = useCallback(
    async (planId: number) => {
      try {
        await scheduleApi.updatePlanStatus(planId, 'archived');
        message.success('方案已归档');
        await loadPlans();
        if (result || multiResult) {
          const planIds = isThreeMode
            ? [planAId, planBId, planCId].filter(Boolean) as number[]
            : [planAId, planBId].filter(Boolean) as number[];
          if (planIds.length >= 2) {
            if (isThreeMode && planIds.length === 3) {
              const data = await scheduleApi.comparePlansMulti(planIds);
              setMultiResult(data);
            } else if (!isThreeMode) {
              const data = await scheduleApi.comparePlans(planIds[0], planIds[1]);
              setResult(data);
            }
          }
        }
      } catch (error: unknown) {
        message.error(`归档失败: ${getErrorMessage(error)}`);
      }
    },
    [loadPlans, result, multiResult, isThreeMode, planAId, planBId, planCId]
  );

  return {
    // state
    plans,
    planAId,
    setPlanAId,
    planBId,
    setPlanBId,
    planCId,
    setPlanCId,
    result,
    multiResult,
    loading,
    exportingSequence,
    isThreeMode,
    handleCompare,
    // plan options
    planOptions,
    planLabelById,
    // recommendations
    twoModeRecommendation,
    threeModeRecommendation,
    // coil data
    coilColumns,
    coilData,
    // two-mode sequence
    sequenceChangeColumns,
    sequenceChangeData,
    sequenceAvgMove,
    // three-mode sequence
    threeModePairs,
    threeModePairKey,
    setThreeModePairKey,
    selectedThreeModePair,
    selectedThreeModeAvgMove,
    threeModeSequenceColumns,
    // multi metrics
    multiMetricRows,
    multiMetricColumns,
    overlapColumns,
    overlapData,
    // export
    handleExportSequence,
    // plan status actions
    handleConfirmPlan,
    handleArchivePlan,
  };
}

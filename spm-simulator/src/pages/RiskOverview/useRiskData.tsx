import { useState, useEffect, useCallback, useMemo, useRef, useDeferredValue } from 'react';
import { message, Button, Popconfirm, Space } from 'antd';
import type { TableColumnsType } from 'antd';
import type { NavigateFunction } from 'react-router-dom';

import { scheduleApi } from '../../services/scheduleApi';
import type {
  SchedulePlan,
  RiskAnalysis,
  RiskViolationItem,
  WidthJumpItem,
  ThicknessJumpItem,
  WaitingForecastItem,
} from '../../types/schedule';
import { getErrorMessage } from '../../utils/error';
import {
  collectRiskConfigHitEntries,
  buildRiskConfigHitChips,
  nextRiskConfigHitFilters,
  type RiskConfigHitChip,
  type RiskConfigHitWorkerRow,
} from '../../utils/riskConfig';
import RiskSeverityTag from '../../components/RiskSeverityTag';
import DueDateTag from '../../components/DueDateTag';
import {
  severityLabelMap,
  constraintLabelMap,
  dueBucketLabelMap,
  riskApplyReasonLabelMap,
  type DueBucket,
} from '../../constants/schedule';
import type { RiskViolationRow, RiskApplySummary, RiskConfigHitWorkerResponse } from './types';
import { buildRiskSnapshot, buildRiskSignature } from './types';

const RISK_CONFIG_HIT_WORKER_THRESHOLD = 2000;

export interface UseRiskDataParams {
  navigate: NavigateFunction;
  searchParams: URLSearchParams;
  riskListCardRef: React.RefObject<HTMLDivElement | null>;
}

export function useRiskData({ navigate, searchParams, riskListCardRef }: UseRiskDataParams) {
  const riskConfigHitWorkerRef = useRef<Worker | null>(null);
  const latestRiskConfigHitTaskIdRef = useRef(0);

  // ─── State ───
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [waitingForecast, setWaitingForecast] = useState<WaitingForecastItem[]>([]);
  const [forecastDays, setForecastDays] = useState<number>(7);
  const [applyingRiskIndex, setApplyingRiskIndex] = useState<number | null>(null);
  const [applyingRiskBatch, setApplyingRiskBatch] = useState(false);
  const [riskSeverityFilter, setRiskSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>(
    'all'
  );
  const [riskConstraintFilter, setRiskConstraintFilter] = useState<string>('all');
  const [riskDueFilter, setRiskDueFilter] = useState<
    'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none'
  >('all');
  const [riskKeyword, setRiskKeyword] = useState('');
  const deferredRiskKeyword = useDeferredValue(riskKeyword);
  const [riskApplyReasonFilter, setRiskApplyReasonFilter] = useState<string>('all');
  const [riskConfigHitEntries, setRiskConfigHitEntries] = useState<Array<[string, number]>>([]);
  const [lastApplySummary, setLastApplySummary] = useState<RiskApplySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);

  // ─── Data loading ───
  const loadPlans = useCallback(async () => {
    try {
      const data = await scheduleApi.getPlans();
      setPlans(data);
      const planIdFromQuery = Number(searchParams.get('planId'));
      if (Number.isFinite(planIdFromQuery) && planIdFromQuery > 0) {
        const target = data.find((item) => item.id === planIdFromQuery);
        if (target) {
          setSelectedPlanId(target.id);
          return;
        }
      }
      const scored = data.find((p) => p.score_overall != null && p.score_overall > 0);
      if (scored) {
        setSelectedPlanId(scored.id);
      } else if (data.length > 0) {
        setSelectedPlanId(data[0].id);
      }
    } catch (error: unknown) {
      message.error(`加载方案失败: ${getErrorMessage(error)}`);
    }
  }, [searchParams]);

  const loadAnalysis = useCallback(async (planId: number) => {
    try {
      setLoading(true);
      const data = await scheduleApi.evaluateRisks(planId);
      setAnalysis(data);
    } catch (error: unknown) {
      message.error(`加载风险分析失败: ${getErrorMessage(error)}`);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadWaitingForecast = useCallback(async (days: number) => {
    try {
      const data = await scheduleApi.getWaitingForecast(days);
      setWaitingForecast(data);
    } catch (error: unknown) {
      message.error(`加载待温预测失败: ${getErrorMessage(error)}`);
      setWaitingForecast([]);
    }
  }, []);

  // ─── Effects ───
  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    const queryConstraint = searchParams.get('riskConstraint');
    setRiskConstraintFilter(queryConstraint ? decodeURIComponent(queryConstraint) : 'all');
    const querySeverity = searchParams.get('riskSeverity');
    setRiskSeverityFilter(
      querySeverity && ['all', 'high', 'medium', 'low'].includes(querySeverity)
        ? (querySeverity as 'all' | 'high' | 'medium' | 'low')
        : 'all'
    );
    const queryDue = searchParams.get('riskDue');
    setRiskDueFilter(
      queryDue && ['all', 'overdue', 'in3', 'in7', 'later', 'none'].includes(queryDue)
        ? (queryDue as 'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none')
        : 'all'
    );
    const queryKeyword = searchParams.get('riskKeyword');
    setRiskKeyword(queryKeyword != null ? decodeURIComponent(queryKeyword) : '');
  }, [searchParams]);

  useEffect(() => {
    if (selectedPlanId) {
      loadAnalysis(selectedPlanId);
    } else {
      setAnalysis(null);
      setWaitingForecast([]);
    }
  }, [selectedPlanId, loadAnalysis]);

  useEffect(() => {
    setLastApplySummary(null);
    setRiskApplyReasonFilter('all');
  }, [selectedPlanId]);

  useEffect(() => {
    if (selectedPlanId) {
      loadWaitingForecast(forecastDays);
    } else {
      setWaitingForecast([]);
    }
  }, [selectedPlanId, forecastDays, loadWaitingForecast]);

  // ─── Derived data ───
  const noData = !analysis || analysis.total_count === 0;

  const violationRows = useMemo<RiskViolationRow[]>(
    () => (analysis?.violations ?? []).map((item, index) => ({ ...item, risk_index: index })),
    [analysis?.violations]
  );

  const riskConstraintOptions = useMemo(
    () => Array.from(new Set(violationRows.map((row) => row.constraint_type))).sort(),
    [violationRows]
  );

  // ─── Web Worker for riskConfigHit ───
  const riskConfigHitWorkerRows = useMemo<RiskConfigHitWorkerRow[]>(
    () =>
      violationRows.map((row) => ({
        constraint_type: row.constraint_type,
        material_id: row.material_id,
        due_bucket: (row.due_bucket ?? 'none') as DueBucket,
      })),
    [violationRows]
  );

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const worker = new Worker(new URL('../../workers/riskConfigHit.worker.ts', import.meta.url), {
      type: 'module',
    });
    riskConfigHitWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<RiskConfigHitWorkerResponse>) => {
      const { id, entries } = event.data;
      if (id !== latestRiskConfigHitTaskIdRef.current) return;
      setRiskConfigHitEntries(entries);
    };
    worker.onerror = () => {
      riskConfigHitWorkerRef.current = null;
    };
    return () => {
      worker.terminate();
      riskConfigHitWorkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const taskId = latestRiskConfigHitTaskIdRef.current + 1;
    latestRiskConfigHitTaskIdRef.current = taskId;

    if (riskConfigHitWorkerRows.length === 0) {
      setRiskConfigHitEntries([]);
      return;
    }

    const worker = riskConfigHitWorkerRef.current;
    if (!worker || riskConfigHitWorkerRows.length < RISK_CONFIG_HIT_WORKER_THRESHOLD) {
      setRiskConfigHitEntries(collectRiskConfigHitEntries(riskConfigHitWorkerRows));
      return;
    }

    worker.postMessage({
      id: taskId,
      rows: riskConfigHitWorkerRows,
    });
  }, [riskConfigHitWorkerRows]);

  const riskConfigHitChips = useMemo<RiskConfigHitChip[]>(
    () => buildRiskConfigHitChips(riskConfigHitEntries, constraintLabelMap, dueBucketLabelMap),
    [riskConfigHitEntries]
  );

  // ─── Filter logic ───
  const blockedSignatureByReason = useMemo(() => {
    const result = new Map<string, Set<string>>();
    if (!lastApplySummary) return result;
    lastApplySummary.blockedEntries.forEach((entry) => {
      if (!result.has(entry.reasonCode)) {
        result.set(entry.reasonCode, new Set<string>());
      }
      result.get(entry.reasonCode)!.add(entry.signature);
    });
    return result;
  }, [lastApplySummary]);

  const filteredViolations = useMemo(() => {
    const keyword = deferredRiskKeyword.trim().toLowerCase();
    return violationRows.filter((row) => {
      // 忽略项过滤
      if (!showIgnored && row.ignored) return false;
      if (riskSeverityFilter !== 'all' && row.severity !== riskSeverityFilter) return false;
      if (riskConstraintFilter !== 'all' && row.constraint_type !== riskConstraintFilter)
        return false;
      if (riskApplyReasonFilter !== 'all') {
        const signatureSet = blockedSignatureByReason.get(riskApplyReasonFilter);
        if (!signatureSet || !signatureSet.has(buildRiskSignature(row))) return false;
      }
      const dueBucket = (row.due_bucket ?? 'none') as 'overdue' | 'in3' | 'in7' | 'later' | 'none';
      if (riskDueFilter !== 'all' && dueBucket !== riskDueFilter) return false;
      if (!keyword) return true;
      const target =
        `${row.coil_id} ${row.message} ${constraintLabelMap[row.constraint_type] || row.constraint_type}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [
    blockedSignatureByReason,
    deferredRiskKeyword,
    riskApplyReasonFilter,
    riskConstraintFilter,
    riskDueFilter,
    riskSeverityFilter,
    showIgnored,
    violationRows,
  ]);

  const highRiskFilteredCount = filteredViolations.filter((row) => row.severity === 'high').length;
  const enableRiskViolationVirtual = filteredViolations.length >= 200;
  const ignoredCount = violationRows.filter((row) => row.ignored).length;

  const activeRiskFilterTags = useMemo(() => {
    const tags: string[] = [];
    if (riskSeverityFilter !== 'all') {
      tags.push(`严重度:${severityLabelMap[riskSeverityFilter]}`);
    }
    if (riskConstraintFilter !== 'all') {
      tags.push(`类型:${constraintLabelMap[riskConstraintFilter] || riskConstraintFilter}`);
    }
    if (riskDueFilter !== 'all') {
      tags.push(`交期:${dueBucketLabelMap[riskDueFilter]}`);
    }
    if (riskApplyReasonFilter !== 'all') {
      tags.push(
        `未生效原因:${riskApplyReasonLabelMap[riskApplyReasonFilter] || riskApplyReasonFilter}`
      );
    }
    const keyword = riskKeyword.trim();
    if (keyword) {
      tags.push(`关键词:${keyword}`);
    }
    return tags;
  }, [riskApplyReasonFilter, riskConstraintFilter, riskDueFilter, riskKeyword, riskSeverityFilter]);

  // ─── Filter controls ───
  const resetRiskFilters = useCallback(() => {
    setRiskSeverityFilter('all');
    setRiskConstraintFilter('all');
    setRiskDueFilter('all');
    setRiskApplyReasonFilter('all');
    setRiskKeyword('');
  }, []);

  const scrollToRiskList = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.requestAnimationFrame(() => {
      riskListCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [riskListCardRef]);

  const toggleSeverityFilter = useCallback(
    (target: 'high' | 'medium' | 'low') => {
      setRiskSeverityFilter((prev) => (prev === target ? 'all' : target));
      scrollToRiskList();
    },
    [scrollToRiskList]
  );

  const toggleDueFilter = useCallback(
    (target: 'overdue' | 'in3' | 'in7' | 'later') => {
      setRiskDueFilter((prev) => (prev === target ? 'all' : target));
      scrollToRiskList();
    },
    [scrollToRiskList]
  );

  const toggleApplyReasonFilter = useCallback(
    (reasonCode: string) => {
      setRiskApplyReasonFilter((prev) => (prev === reasonCode ? 'all' : reasonCode));
      scrollToRiskList();
    },
    [scrollToRiskList]
  );

  const toggleRiskConfigHitFilter = useCallback(
    (chip: RiskConfigHitChip) => {
      const next = nextRiskConfigHitFilters(riskConstraintFilter, riskDueFilter, chip);
      setRiskConstraintFilter(next.constraintFilter);
      setRiskDueFilter(next.dueFilter);
      scrollToRiskList();
    },
    [riskConstraintFilter, riskDueFilter, scrollToRiskList]
  );

  // ─── Navigation handlers ───
  const handleLocateRisk = useCallback(
    (row: RiskViolationRow) => {
      if (!selectedPlanId) return;
      navigate(
        `/?planId=${selectedPlanId}&focusSeq=${row.sequence}&focusMaterialId=${row.material_id}`
      );
    },
    [navigate, selectedPlanId]
  );

  const handleLocateWidthJump = useCallback(
    (row: WidthJumpItem) => {
      if (!selectedPlanId) return;
      navigate(`/?planId=${selectedPlanId}&focusSeq=${row.sequence}`);
    },
    [navigate, selectedPlanId]
  );

  const handleLocateThicknessJump = useCallback(
    (row: ThicknessJumpItem) => {
      if (!selectedPlanId) return;
      navigate(`/?planId=${selectedPlanId}&focusSeq=${row.sequence}`);
    },
    [navigate, selectedPlanId]
  );

  const handleViewWaitingForecastDetail = useCallback(
    (readyDate: string) => {
      if (!selectedPlanId) return;
      const encodedDate = encodeURIComponent(readyDate);
      navigate(`/?planId=${selectedPlanId}&forecastReadyDate=${encodedDate}`);
    },
    [navigate, selectedPlanId]
  );

  // ─── Ignore actions ───
  const handleIgnoreRisk = useCallback(
    async (row: RiskViolationRow) => {
      if (!selectedPlanId) return;
      try {
        await scheduleApi.ignoreRisk(selectedPlanId, row.constraint_type, row.material_id);
        const latest = await scheduleApi.evaluateRisks(selectedPlanId);
        setAnalysis(latest);
        message.success(`已忽略: ${row.coil_id} (${constraintLabelMap[row.constraint_type] || row.constraint_type})`);
      } catch (error: unknown) {
        message.error(`忽略失败: ${getErrorMessage(error)}`);
      }
    },
    [selectedPlanId]
  );

  const handleUnignoreRisk = useCallback(
    async (row: RiskViolationRow) => {
      if (!selectedPlanId) return;
      try {
        await scheduleApi.unignoreRisk(selectedPlanId, row.constraint_type, row.material_id);
        const latest = await scheduleApi.evaluateRisks(selectedPlanId);
        setAnalysis(latest);
        message.success(`已取消忽略: ${row.coil_id}`);
      } catch (error: unknown) {
        message.error(`取消忽略失败: ${getErrorMessage(error)}`);
      }
    },
    [selectedPlanId]
  );

  // ─── Risk apply actions ───
  const handleApplyRiskSuggestion = useCallback(
    async (index: number) => {
      if (!selectedPlanId || !analysis) return;
      try {
        setApplyingRiskIndex(index);
        const beforeSnapshot = buildRiskSnapshot(analysis);
        const result = await scheduleApi.applyRiskSuggestion(selectedPlanId, String(index));
        const latest = await scheduleApi.evaluateRisks(selectedPlanId);
        setAnalysis(latest);
        const afterSnapshot = buildRiskSnapshot(latest);
        setLastApplySummary({
          mode: 'single',
          requested: 1,
          changed: result.changed ? 1 : 0,
          at: new Date().toISOString(),
          notes: [result.action_note],
          blockedReasons: result.changed ? {} : { [result.reason_code]: 1 },
          blockedEntries: result.changed
            ? []
            : [
                {
                  reasonCode: result.reason_code,
                  signature: buildRiskSignature(result),
                },
              ],
          before: beforeSnapshot,
          after: afterSnapshot,
        });
        setRiskApplyReasonFilter('all');
        if (!result.changed) {
          message.warning(`建议未生效：${result.action_note}`);
          return;
        }
        const deltaHigh = beforeSnapshot.high - afterSnapshot.high;
        if (deltaHigh > 0) {
          message.success(`已应用建议：${result.action_note}（高风险 -${deltaHigh}）`);
        } else {
          message.success(`已应用建议：${result.action_note}`);
        }
      } catch (error: unknown) {
        message.error(`应用建议失败: ${getErrorMessage(error)}`);
      } finally {
        setApplyingRiskIndex(null);
      }
    },
    [analysis, selectedPlanId]
  );

  const handleApplyTopHighRiskSuggestions = useCallback(async () => {
    if (!selectedPlanId || !analysis) return;
    try {
      setApplyingRiskBatch(true);
      const beforeSnapshot = buildRiskSnapshot(analysis);
      let applied = 0;
      let changed = 0;
      const visited = new Set<string>();
      const notes: string[] = [];
      const blockedReasonCounts: Record<string, number> = {};
      const blockedEntries: { reasonCode: string; signature: string }[] = [];
      for (let i = 0; i < 6; i += 1) {
        const latest = await scheduleApi.evaluateRisks(selectedPlanId);
        const nextIndex = latest.violations.findIndex((item) => item.severity === 'high');
        if (nextIndex < 0) break;
        const next = latest.violations[nextIndex];
        const signature = `${next.constraint_type}|${next.material_id}|${next.sequence}|${next.message}`;
        if (visited.has(signature)) break;
        visited.add(signature);
        const result = await scheduleApi.applyRiskSuggestion(selectedPlanId, String(nextIndex));
        if (result.changed) changed += 1;
        if (!result.changed) {
          blockedReasonCounts[result.reason_code] =
            (blockedReasonCounts[result.reason_code] ?? 0) + 1;
          blockedEntries.push({
            reasonCode: result.reason_code,
            signature: buildRiskSignature(result),
          });
        }
        notes.push(result.action_note);
        applied += 1;
      }
      const afterAnalysis = await scheduleApi.evaluateRisks(selectedPlanId);
      setAnalysis(afterAnalysis);
      const afterSnapshot = buildRiskSnapshot(afterAnalysis);
      setLastApplySummary({
        mode: 'batch',
        requested: applied,
        changed,
        at: new Date().toISOString(),
        notes,
        blockedReasons: blockedReasonCounts,
        blockedEntries,
        before: beforeSnapshot,
        after: afterSnapshot,
      });
      setRiskApplyReasonFilter('all');
      if (applied === 0) {
        message.info('未找到可自动处理的高风险项');
        return;
      }
      if (changed === 0) {
        message.warning(`已尝试 ${applied} 条建议，但均未生效`);
        return;
      }
      const reducedHigh = beforeSnapshot.high - afterSnapshot.high;
      if (reducedHigh > 0) {
        message.success(`已应用 ${changed}/${applied} 条建议，高风险减少 ${reducedHigh} 条`);
      } else {
        message.success(`已应用 ${changed}/${applied} 条建议`);
      }
    } catch (error: unknown) {
      message.error(`一键应用失败: ${getErrorMessage(error)}`);
    } finally {
      setApplyingRiskBatch(false);
    }
  }, [analysis, selectedPlanId]);

  // ─── Table columns ───
  const violationColumns: TableColumnsType<RiskViolationItem> = [
    { title: '序号', dataIndex: 'sequence', width: 60, align: 'center' },
    { title: '卷号', dataIndex: 'coil_id', width: 120, ellipsis: true },
    {
      title: '约束类型',
      dataIndex: 'constraint_type',
      width: 100,
      render: (v: string) => constraintLabelMap[v] || v,
    },
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 80,
      align: 'center',
      render: (v: string) => <RiskSeverityTag severity={v} />,
    },
    { title: '风险描述', dataIndex: 'message', ellipsis: true },
    {
      title: '交期',
      dataIndex: 'due_bucket',
      width: 92,
      align: 'center',
      render: (value: RiskViolationItem['due_bucket'], row: RiskViolationItem) => {
        const bucket = (value ?? 'none') as DueBucket;
        return <DueDateTag bucket={bucket} dueDate={row.due_date} />;
      },
    },
  ];

  const violationColumnsWithAction: TableColumnsType<RiskViolationItem> = [
    ...violationColumns,
    {
      title: '定位',
      key: 'locate',
      width: 72,
      align: 'center',
      render: (_: unknown, row: RiskViolationItem) => {
        const targetRow = row as RiskViolationRow;
        return (
          <Button type="link" size="small" onClick={() => handleLocateRisk(targetRow)}>
            定位
          </Button>
        );
      },
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      align: 'center',
      render: (_: unknown, row: RiskViolationItem) => {
        const targetRow = row as RiskViolationRow;
        const ct = targetRow.constraint_type;
        const coil = targetRow.coil_id || '未知';
        const applyDisabled = !!targetRow.ignored || targetRow.severity === 'info';
        let desc: string;
        switch (ct) {
          case 'overdue_priority':
            desc = `将材料 ${coil} 安全前移至最靠前的宽度兼容位置`;
            break;
          case 'width_jump':
            desc = `将材料 ${coil} 智能重定位到最佳位置（最小化宽度跳跃）`;
            break;
          case 'temp_status_filter':
            desc = `从排程中移除未适温材料 ${coil}`;
            break;
          case 'shift_capacity':
            desc = `将材料 ${coil} 移至下一有空余的班次`;
            break;
          default:
            desc = `将材料 ${coil} 前移一位`;
            break;
        }
        return (
          <Space size={0}>
            <Popconfirm
              title="应用建议"
              description={desc}
              okText="确认应用"
              cancelText="取消"
              onConfirm={() => handleApplyRiskSuggestion(targetRow.risk_index)}
            >
              <Button
                type="link"
                size="small"
                loading={applyingRiskIndex === targetRow.risk_index}
                disabled={applyDisabled}
              >
                应用
              </Button>
            </Popconfirm>
            {targetRow.ignored ? (
              <Button
                type="link"
                size="small"
                onClick={() => handleUnignoreRisk(targetRow)}
              >
                取消忽略
              </Button>
            ) : (
              <Popconfirm
                title="确认忽略"
                description="忽略后该问题将不计入风险统计"
                okText="确认"
                cancelText="取消"
                onConfirm={() => handleIgnoreRisk(targetRow)}
              >
                <Button type="link" size="small" style={{ color: '#8c8c8c' }}>
                  忽略
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      },
    },
  ];

  return {
    // State
    plans,
    selectedPlanId,
    setSelectedPlanId,
    analysis,
    waitingForecast,
    forecastDays,
    setForecastDays,
    loading,
    noData,
    // Filters
    riskSeverityFilter,
    setRiskSeverityFilter,
    riskConstraintFilter,
    setRiskConstraintFilter,
    riskDueFilter,
    setRiskDueFilter,
    riskKeyword,
    setRiskKeyword,
    riskApplyReasonFilter,
    setRiskApplyReasonFilter,
    riskConstraintOptions,
    activeRiskFilterTags,
    resetRiskFilters,
    // Filter toggles
    toggleSeverityFilter,
    toggleDueFilter,
    toggleApplyReasonFilter,
    toggleRiskConfigHitFilter,
    // Risk config hit
    riskConfigHitChips,
    // Violations
    filteredViolations,
    highRiskFilteredCount,
    ignoredCount,
    enableRiskViolationVirtual,
    violationColumnsWithAction,
    // Apply state
    applyingRiskBatch,
    lastApplySummary,
    // Ignore state
    showIgnored,
    setShowIgnored,
    // Handlers
    handleApplyTopHighRiskSuggestions,
    handleLocateRisk,
    handleLocateWidthJump,
    handleLocateThicknessJump,
    handleViewWaitingForecastDetail,
    handleIgnoreRisk,
    handleUnignoreRisk,
    // Score
    scoreColor: analysis ? analysis.score_overall : null,
  };
}

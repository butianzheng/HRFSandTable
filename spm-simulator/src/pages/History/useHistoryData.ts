import { useState, useEffect, useCallback, useMemo } from 'react';
import { message } from 'antd';
import { save } from '@tauri-apps/plugin-dialog';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { scheduleApi } from '../../services/scheduleApi';
import type {
  SchedulePlan,
  PlanVersionItem,
  OperationLogEntry,
  SequenceChangeItem,
} from '../../types/schedule';
import { getErrorMessage } from '../../utils/error';

export interface VersionDeltaPreviewItem {
  key: string;
  fromPlanId: number;
  fromVersion: number;
  toPlanId: number;
  toVersion: number;
  scoreDelta: number;
  totalCountDelta: number;
  totalWeightDelta: number;
  rollChangeDelta: number;
  riskHighDelta: number;
  riskMediumDelta: number;
  riskLowDelta: number;
}

export interface RiskConstraintDiffRow {
  key: string;
  constraint_type: string;
  current_high: number;
  current_medium: number;
  current_low: number;
  current_total: number;
  target_high: number;
  target_medium: number;
  target_low: number;
  target_total: number;
  delta_total: number;
}

export function useHistoryData() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [compareTargetPlanId, setCompareTargetPlanId] = useState<number | null>(null);
  const [versions, setVersions] = useState<PlanVersionItem[]>([]);
  const [logs, setLogs] = useState<OperationLogEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [rollbackingId, setRollbackingId] = useState<number | null>(null);
  const [exportingReport, setExportingReport] = useState(false);
  const [exportPreviewOpen, setExportPreviewOpen] = useState(false);
  const [loadingExportPreview, setLoadingExportPreview] = useState(false);
  const [exportLogsCount, setExportLogsCount] = useState<number | null>(null);
  const [exportLogsCapped, setExportLogsCapped] = useState(false);
  const [loadingSequenceDiff, setLoadingSequenceDiff] = useState(false);
  const [exportingSequenceDiff, setExportingSequenceDiff] = useState(false);
  const [sequenceDiffRows, setSequenceDiffRows] = useState<SequenceChangeItem[]>([]);
  const [sequenceMoveFilter, setSequenceMoveFilter] = useState<'all' | 'forward' | 'backward'>(
    'all'
  );
  const [sequenceMinDelta, setSequenceMinDelta] = useState<number>(0);
  const [loadingRiskDiff, setLoadingRiskDiff] = useState(false);
  const [riskDiffRows, setRiskDiffRows] = useState<RiskConstraintDiffRow[]>([]);
  const [riskTrendFilter, setRiskTrendFilter] = useState<'all' | 'worse' | 'improve'>('all');
  const [riskMinDelta, setRiskMinDelta] = useState<number>(0);

  // ─── 数据加载 ───
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
      if (data.length > 0) {
        setSelectedPlanId((prev) => prev ?? data[0].id);
      }
    } catch (error: unknown) {
      message.error(`加载方案列表失败: ${getErrorMessage(error)}`);
    }
  }, [searchParams]);

  const loadVersions = useCallback(async (planId: number) => {
    try {
      setLoadingVersions(true);
      const data = await scheduleApi.getPlanVersions(planId);
      setVersions(data);
      setCompareTargetPlanId((prev) => {
        if (prev && prev !== planId && data.some((row) => row.plan_id === prev)) {
          return prev;
        }
        const fallback = data.find((row) => row.plan_id !== planId);
        return fallback?.plan_id ?? null;
      });
    } catch (error: unknown) {
      message.error(`加载版本历史失败: ${getErrorMessage(error)}`);
      setVersions([]);
      setCompareTargetPlanId(null);
    } finally {
      setLoadingVersions(false);
    }
  }, []);

  const loadLogs = useCallback(async (planId: number) => {
    try {
      setLoadingLogs(true);
      const data = await scheduleApi.getOperationLogs({
        target_type: 'plan',
        target_id: planId,
        limit: 100,
      });
      setLogs(data);
    } catch (error: unknown) {
      message.error(`加载操作日志失败: ${getErrorMessage(error)}`);
      setLogs([]);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  const loadSequenceDiff = useCallback(async (planAId: number, planBId: number) => {
    try {
      setLoadingSequenceDiff(true);
      const result = await scheduleApi.comparePlans(planAId, planBId);
      setSequenceDiffRows(result.sequence_changes);
    } catch (error: unknown) {
      message.error(`加载顺序差异失败: ${getErrorMessage(error)}`);
      setSequenceDiffRows([]);
    } finally {
      setLoadingSequenceDiff(false);
    }
  }, []);

  const loadRiskDiffByConstraint = useCallback(async (planAId: number, planBId: number) => {
    try {
      setLoadingRiskDiff(true);
      const [currentRisk, targetRisk] = await Promise.all([
        scheduleApi.getRiskAnalysis(planAId),
        scheduleApi.getRiskAnalysis(planBId),
      ]);
      const buildMap = (violations: { constraint_type: string; severity: string }[]) => {
        const map = new Map<string, { high: number; medium: number; low: number; total: number }>();
        violations.forEach((item) => {
          const key = item.constraint_type || 'unknown';
          const prev = map.get(key) ?? { high: 0, medium: 0, low: 0, total: 0 };
          if (item.severity === 'high') prev.high += 1;
          else if (item.severity === 'medium') prev.medium += 1;
          else prev.low += 1;
          prev.total += 1;
          map.set(key, prev);
        });
        return map;
      };
      const currentMap = buildMap(currentRisk.violations);
      const targetMap = buildMap(targetRisk.violations);
      const keys = Array.from(new Set([...currentMap.keys(), ...targetMap.keys()]));
      const rows = keys.map((key) => {
        const curr = currentMap.get(key) ?? { high: 0, medium: 0, low: 0, total: 0 };
        const targ = targetMap.get(key) ?? { high: 0, medium: 0, low: 0, total: 0 };
        return {
          key,
          constraint_type: key,
          current_high: curr.high,
          current_medium: curr.medium,
          current_low: curr.low,
          current_total: curr.total,
          target_high: targ.high,
          target_medium: targ.medium,
          target_low: targ.low,
          target_total: targ.total,
          delta_total: targ.total - curr.total,
        };
      });
      rows.sort(
        (a, b) =>
          Math.abs(b.delta_total) - Math.abs(a.delta_total) || b.target_total - a.target_total
      );
      setRiskDiffRows(rows);
    } catch (error: unknown) {
      message.error(`加载风险差异失败: ${getErrorMessage(error)}`);
      setRiskDiffRows([]);
    } finally {
      setLoadingRiskDiff(false);
    }
  }, []);

  // ─── 操作处理 ───
  const handleRollback = async (targetPlanId: number) => {
    if (!selectedPlanId) return;
    try {
      setRollbackingId(targetPlanId);
      await scheduleApi.rollbackPlanVersion(selectedPlanId, targetPlanId);
      message.success('版本回滚成功，当前方案已恢复为目标版本内容');
      await loadPlans();
      await loadVersions(selectedPlanId);
      await loadLogs(selectedPlanId);
    } catch (error: unknown) {
      message.error(`版本回滚失败: ${getErrorMessage(error)}`);
    } finally {
      setRollbackingId(null);
    }
  };

  const handleCompareVersions = () => {
    if (!selectedPlanId || !compareTargetPlanId) {
      message.warning('请先选择对比目标版本');
      return;
    }
    if (selectedPlanId === compareTargetPlanId) {
      message.warning('请设置不同的版本进行对比');
      return;
    }
    navigate(`/compare?planA=${selectedPlanId}&planB=${compareTargetPlanId}`);
  };

  const handleExportSequenceDiff = useCallback(
    async (format: 'excel' | 'csv') => {
      if (!selectedPlanId || !compareTargetPlanId || selectedPlanId === compareTargetPlanId) return;
      try {
        const ext = format === 'excel' ? 'xlsx' : 'csv';
        const ts = dayjs().format('YYYYMMDD_HHmmss');
        const filePath = await save({
          defaultPath: `历史版本顺序差异_${selectedPlanId}_vs_${compareTargetPlanId}_${ts}.${ext}`,
          filters: [{ name: format === 'excel' ? 'Excel' : 'CSV', extensions: [ext] }],
        });
        if (!filePath) return;
        setExportingSequenceDiff(true);
        const count =
          format === 'excel'
            ? await scheduleApi.exportCompareSequenceExcel(
                selectedPlanId,
                compareTargetPlanId,
                filePath
              )
            : await scheduleApi.exportCompareSequenceCsv(
                selectedPlanId,
                compareTargetPlanId,
                filePath
              );
        message.success(`导出${format === 'excel' ? 'Excel' : 'CSV'}成功: ${count} 条顺序变化`);
      } catch (error: unknown) {
        message.error(`导出顺序差异失败: ${getErrorMessage(error)}`);
      } finally {
        setExportingSequenceDiff(false);
      }
    },
    [compareTargetPlanId, selectedPlanId]
  );

  const openExportPreview = async () => {
    if (!selectedPlanId) return;
    const planId = selectedPlanId;
    setExportPreviewOpen(true);
    setLoadingExportPreview(true);
    setExportLogsCount(null);
    setExportLogsCapped(false);
    try {
      const estimate = await scheduleApi.getOperationLogEstimate(
        {
          target_type: 'plan',
          target_id: planId,
        },
        2000
      );
      setExportLogsCount(estimate.count);
      setExportLogsCapped(estimate.capped);
    } catch (error: unknown) {
      message.error(`加载导出预览日志失败: ${getErrorMessage(error)}`);
      setExportLogsCount(logs.length);
      setExportLogsCapped(false);
    } finally {
      setLoadingExportPreview(false);
    }
  };

  const handleExportHistoryReport = async () => {
    if (!selectedPlanId) return;
    try {
      setExportPreviewOpen(false);
      const filePath = await save({
        defaultPath: `历史追溯报告_plan${selectedPlanId}_${dayjs().format('YYYYMMDD_HHmmss')}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      });
      if (!filePath) return;

      setExportingReport(true);
      const count = await scheduleApi.exportPlanHistoryReport(selectedPlanId, filePath);
      message.success(
        `导出成功：${count} 条（含 versions/version_stats/version_delta/sequence_diff/risk_diff/logs）`
      );
    } catch (error: unknown) {
      message.error(`导出追溯报告失败: ${getErrorMessage(error)}`);
    } finally {
      setExportingReport(false);
    }
  };

  // ─── Effects ───
  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    if (selectedPlanId) {
      loadVersions(selectedPlanId);
      loadLogs(selectedPlanId);
    } else {
      setVersions([]);
      setLogs([]);
    }
  }, [selectedPlanId, loadVersions, loadLogs]);

  useEffect(() => {
    if (!selectedPlanId || !compareTargetPlanId || selectedPlanId === compareTargetPlanId) {
      setSequenceDiffRows([]);
      return;
    }
    void loadSequenceDiff(selectedPlanId, compareTargetPlanId);
  }, [compareTargetPlanId, loadSequenceDiff, selectedPlanId]);

  useEffect(() => {
    if (!selectedPlanId || !compareTargetPlanId || selectedPlanId === compareTargetPlanId) {
      setRiskDiffRows([]);
      return;
    }
    void loadRiskDiffByConstraint(selectedPlanId, compareTargetPlanId);
  }, [compareTargetPlanId, loadRiskDiffByConstraint, selectedPlanId]);

  useEffect(() => {
    setExportLogsCount(null);
    setExportLogsCapped(false);
  }, [selectedPlanId]);

  // ─── 派生数据 ───
  const currentPlan = plans.find((p) => p.id === selectedPlanId) ?? null;
  const selectedVersion = versions.find((item) => item.plan_id === selectedPlanId)?.version;
  const compareTargetVersion = versions.find(
    (item) => item.plan_id === compareTargetPlanId
  )?.version;

  const reportVersionCount = versions.length;
  const reportDeltaCount = Math.max(reportVersionCount - 1, 0);
  const reportLogsEstimate = exportLogsCount ?? logs.length;
  const reportEstimatedRows = reportVersionCount * 2 + reportDeltaCount + reportLogsEstimate;

  const versionDeltaPreview = useMemo<VersionDeltaPreviewItem[]>(
    () =>
      versions
        .slice(1)
        .map((to, idx) => {
          const from = versions[idx];
          return {
            key: `${from.plan_id}-${to.plan_id}`,
            fromPlanId: from.plan_id,
            fromVersion: from.version,
            toPlanId: to.plan_id,
            toVersion: to.version,
            scoreDelta: to.score_overall - from.score_overall,
            totalCountDelta: to.total_count - from.total_count,
            totalWeightDelta: to.total_weight - from.total_weight,
            rollChangeDelta: to.roll_change_count - from.roll_change_count,
            riskHighDelta: to.risk_high - from.risk_high,
            riskMediumDelta: to.risk_medium - from.risk_medium,
            riskLowDelta: to.risk_low - from.risk_low,
          };
        })
        .reverse(),
    [versions]
  );

  const reportPreviewSummary = useMemo(() => {
    if (versions.length === 0) {
      return { versionCount: 0, deltaCount: 0, estimateRows: 0, scoreTrend: 0 };
    }
    const first = versions[0];
    const last = versions[versions.length - 1];
    return {
      versionCount: reportVersionCount,
      deltaCount: reportDeltaCount,
      estimateRows: reportEstimatedRows,
      scoreTrend: last.score_overall - first.score_overall,
    };
  }, [versions, reportVersionCount, reportDeltaCount, reportEstimatedRows]);

  const filteredSequenceDiffRows = useMemo(
    () =>
      sequenceDiffRows.filter((row) => {
        if (sequenceMoveFilter === 'forward' && row.delta >= 0) return false;
        if (sequenceMoveFilter === 'backward' && row.delta <= 0) return false;
        return Math.abs(row.delta) >= sequenceMinDelta;
      }),
    [sequenceDiffRows, sequenceMinDelta, sequenceMoveFilter]
  );

  const sequenceDiffAvgMove =
    filteredSequenceDiffRows.length > 0
      ? (
          filteredSequenceDiffRows.reduce((sum, row) => sum + Math.abs(row.delta), 0) /
          filteredSequenceDiffRows.length
        ).toFixed(1)
      : '0.0';

  const filteredRiskDiffRows = useMemo(
    () =>
      riskDiffRows.filter((row) => {
        if (riskTrendFilter === 'worse' && row.delta_total <= 0) return false;
        if (riskTrendFilter === 'improve' && row.delta_total >= 0) return false;
        return Math.abs(row.delta_total) >= riskMinDelta;
      }),
    [riskDiffRows, riskMinDelta, riskTrendFilter]
  );

  const filteredRiskDiffCurrentTotal = filteredRiskDiffRows.reduce(
    (sum, row) => sum + row.current_total,
    0
  );
  const filteredRiskDiffTargetTotal = filteredRiskDiffRows.reduce(
    (sum, row) => sum + row.target_total,
    0
  );
  const filteredRiskDiffDeltaTotal = filteredRiskDiffTargetTotal - filteredRiskDiffCurrentTotal;

  return {
    navigate,
    plans,
    selectedPlanId,
    setSelectedPlanId,
    compareTargetPlanId,
    setCompareTargetPlanId,
    versions,
    logs,
    loadingVersions,
    loadingLogs,
    rollbackingId,
    exportingReport,
    exportPreviewOpen,
    setExportPreviewOpen,
    loadingExportPreview,
    exportLogsCount,
    exportLogsCapped,
    loadingSequenceDiff,
    exportingSequenceDiff,
    sequenceMoveFilter,
    setSequenceMoveFilter,
    sequenceMinDelta,
    setSequenceMinDelta,
    loadingRiskDiff,
    riskTrendFilter,
    setRiskTrendFilter,
    riskMinDelta,
    setRiskMinDelta,
    // 派生
    currentPlan,
    selectedVersion,
    compareTargetVersion,
    reportVersionCount,
    reportDeltaCount,
    reportLogsEstimate,
    reportEstimatedRows,
    versionDeltaPreview,
    reportPreviewSummary,
    filteredSequenceDiffRows,
    sequenceDiffRows,
    sequenceDiffAvgMove,
    filteredRiskDiffRows,
    riskDiffRows,
    filteredRiskDiffCurrentTotal,
    filteredRiskDiffTargetTotal,
    filteredRiskDiffDeltaTotal,
    // 操作
    loadVersions,
    loadLogs,
    handleRollback,
    handleCompareVersions,
    handleExportSequenceDiff,
    openExportPreview,
    handleExportHistoryReport,
  };
}

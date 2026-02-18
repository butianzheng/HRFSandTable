import { invoke } from '@tauri-apps/api/core';
import { clearInvokeCache, invokeDeduped } from './requestCache';
import type {
  SchedulePlan,
  ScheduleItem,
  CreatePlanInput,
  ScheduleResult,
  ScheduleIdleGapSummary,
  UndoRedoResult,
  RiskAnalysis,
  ApplyRiskSuggestionResult,
  IgnoredRiskEntry,
  PlanComparisonResult,
  MultiPlanComparisonResult,
  PlanVersionItem,
  OperationLogEntry,
  OperationLogFilter,
  OperationLogEstimate,
  CleanupEstimate,
  ExportTemplate,
  CreateExportTemplateInput,
  UpdateExportTemplateInput,
  ExportResult,
  MaterialStats,
  BackupFileInfo,
  WaitingForecastItem,
  WaitingForecastDetailItem,
} from '../types/schedule';

interface PlanFilter {
  status?: string;
  period_type?: string;
}

const CACHE_TTL_MS = {
  short: 3000,
  normal: 5000,
  long: 10000,
} as const;

async function invokeWithCacheClear<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  const result = await invoke<T>(command, args);
  clearInvokeCache();
  return result;
}

export const scheduleApi = {
  createPlan: (input: CreatePlanInput) =>
    invokeWithCacheClear<SchedulePlan>('create_plan', { input }),

  getPlan: (id: number) => invokeDeduped<SchedulePlan>('get_plan', { id }, CACHE_TTL_MS.normal),

  getPlans: (filter?: PlanFilter) =>
    invokeDeduped<SchedulePlan[]>('get_plans', { filter: filter ?? null }, CACHE_TTL_MS.long),

  savePlan: (id: number) => invokeWithCacheClear<SchedulePlan>('save_plan', { id }),

  deletePlan: (id: number) => invokeWithCacheClear<void>('delete_plan', { id }),

  updatePlanStatus: (id: number, status: string) =>
    invokeWithCacheClear<SchedulePlan>('update_plan_status', { id, status }),

  autoSchedule: (planId: number, strategyId: number) =>
    invokeWithCacheClear<ScheduleResult>('auto_schedule', { planId, strategyId }),

  analyzeScheduleIdleGaps: (planId: number, thresholdMinutes?: number) =>
    invokeDeduped<ScheduleIdleGapSummary>(
      'analyze_schedule_idle_gaps',
      { planId, thresholdMinutes: thresholdMinutes ?? null },
      CACHE_TTL_MS.short
    ),

  addToSchedule: (planId: number, materialIds: number[], position?: number) =>
    invokeWithCacheClear<ScheduleItem[]>('add_to_schedule', {
      planId,
      materialIds,
      position: position ?? null,
    }),

  removeFromSchedule: (planId: number, itemIds: number[]) =>
    invokeWithCacheClear<number>('remove_from_schedule', { planId, itemIds }),

  moveScheduleItem: (planId: number, itemId: number, newPosition: number) =>
    invokeWithCacheClear<void>('move_schedule_item', { planId, itemId, newPosition }),

  lockScheduleItems: (planId: number, itemIds: number[], locked: boolean) =>
    invokeWithCacheClear<number>('lock_schedule_items', { planId, itemIds, locked }),

  getScheduleItems: (planId: number) =>
    invokeDeduped<ScheduleItem[]>('get_schedule_items', { planId }, CACHE_TTL_MS.short),

  // Undo/Redo
  pushUndo: (planId: number, actionType: string, beforeState: string, afterState: string) =>
    invokeWithCacheClear<void>('push_undo', { planId, actionType, beforeState, afterState }),

  undoAction: (planId: number) => invokeWithCacheClear<UndoRedoResult>('undo_action', { planId }),

  redoAction: (planId: number) => invokeWithCacheClear<UndoRedoResult>('redo_action', { planId }),

  getUndoRedoCount: (planId: number) =>
    invokeDeduped<[number, number]>('get_undo_redo_count', { planId }, CACHE_TTL_MS.short),

  clearUndoStack: (planId?: number) =>
    invokeWithCacheClear<number>('clear_undo_stack', { planId: planId ?? null }),

  // Risk Analysis
  getRiskAnalysis: (planId: number) =>
    invokeDeduped<RiskAnalysis>('get_risk_analysis', { planId }, CACHE_TTL_MS.normal),

  evaluateRisks: (planId: number) =>
    invokeWithCacheClear<RiskAnalysis>('evaluate_risks', { planId }),

  applyRiskSuggestion: (planId: number, riskId: string) =>
    invokeWithCacheClear<ApplyRiskSuggestionResult>('apply_risk_suggestion', { planId, riskId }),

  ignoreRisk: (planId: number, constraintType: string, materialId: number) =>
    invokeWithCacheClear<IgnoredRiskEntry[]>('ignore_risk', { planId, constraintType, materialId }),

  unignoreRisk: (planId: number, constraintType: string, materialId: number) =>
    invokeWithCacheClear<IgnoredRiskEntry[]>('unignore_risk', {
      planId,
      constraintType,
      materialId,
    }),

  getWaitingForecast: (forecastDays?: number) =>
    invokeDeduped<WaitingForecastItem[]>(
      'get_waiting_forecast',
      {
        forecastDays: forecastDays ?? null,
      },
      CACHE_TTL_MS.normal
    ),

  getWaitingForecastDetails: (readyDate: string) =>
    invokeDeduped<WaitingForecastDetailItem[]>(
      'get_waiting_forecast_details',
      {
        readyDate,
      },
      CACHE_TTL_MS.short
    ),

  // Plan Comparison
  comparePlans: (planAId: number, planBId: number) =>
    invokeDeduped<PlanComparisonResult>('compare_plans', { planAId, planBId }, CACHE_TTL_MS.long),

  exportCompareSequenceCsv: (planAId: number, planBId: number, filePath: string) =>
    invoke<number>('export_compare_sequence_csv', { planAId, planBId, filePath }),

  exportCompareSequenceExcel: (planAId: number, planBId: number, filePath: string) =>
    invoke<number>('export_compare_sequence_excel', { planAId, planBId, filePath }),

  comparePlansMulti: (planIds: number[]) =>
    invokeDeduped<MultiPlanComparisonResult>('compare_plans_multi', { planIds }, CACHE_TTL_MS.long),

  // Plan History
  getPlanVersions: (planId: number) =>
    invokeDeduped<PlanVersionItem[]>('get_plan_versions', { planId }, CACHE_TTL_MS.normal),

  rollbackPlanVersion: (planId: number, targetPlanId: number) =>
    invokeWithCacheClear<SchedulePlan>('rollback_plan_version', { planId, targetPlanId }),

  getOperationLogs: (filter?: OperationLogFilter) =>
    invokeDeduped<OperationLogEntry[]>(
      'get_operation_logs',
      { filter: filter ?? null },
      CACHE_TTL_MS.short
    ),

  getOperationLogEstimate: (filter?: OperationLogFilter, cap?: number) =>
    invokeDeduped<OperationLogEstimate>(
      'get_operation_log_estimate',
      {
        filter: filter ?? null,
        cap: cap ?? null,
      },
      CACHE_TTL_MS.short
    ),

  getCleanupEstimate: (olderThanDays?: number) =>
    invokeDeduped<CleanupEstimate>(
      'get_cleanup_estimate',
      {
        olderThanDays: olderThanDays ?? null,
      },
      CACHE_TTL_MS.short
    ),

  exportLogs: (filePath: string, filter?: OperationLogFilter) =>
    invoke<number>('export_logs', {
      filePath,
      filter: filter ?? null,
    }),

  exportLogsExcel: (filePath: string, filter?: OperationLogFilter) =>
    invoke<number>('export_logs_excel', {
      filePath,
      filter: filter ?? null,
    }),

  exportPlanHistoryReport: (planId: number, filePath: string) =>
    invoke<number>('export_plan_history_report', { planId, filePath }),

  // Export
  getExportTemplates: () =>
    invokeDeduped<ExportTemplate[]>('get_export_templates', undefined, CACHE_TTL_MS.long),

  createExportTemplate: (input: CreateExportTemplateInput) =>
    invokeWithCacheClear<ExportTemplate>('create_export_template', { input }),

  updateExportTemplate: (id: number, input: UpdateExportTemplateInput) =>
    invokeWithCacheClear<ExportTemplate>('update_export_template', { id, input }),

  deleteExportTemplate: (id: number) =>
    invokeWithCacheClear<void>('delete_export_template', { id }),

  exportPlanExcel: (planId: number, filePath: string, templateId?: number) =>
    invoke<ExportResult>('export_plan_excel', { planId, filePath, templateId: templateId ?? null }),

  exportPlanCsv: (planId: number, filePath: string, templateId?: number) =>
    invoke<ExportResult>('export_plan_csv', { planId, filePath, templateId: templateId ?? null }),

  exportMaterialsExcel: (filePath: string, status?: string) =>
    invoke<ExportResult>('export_materials_excel', { filePath, status: status ?? null }),

  getMaterialStats: () =>
    invokeDeduped<MaterialStats>('get_material_stats', undefined, CACHE_TTL_MS.normal),

  backupDatabase: () => invokeWithCacheClear<BackupFileInfo>('backup_database'),

  getBackups: () => invokeDeduped<BackupFileInfo[]>('get_backups', undefined, CACHE_TTL_MS.long),

  restoreDatabase: (filePath: string) =>
    invokeWithCacheClear<void>('restore_database', { filePath }),

  deleteBackup: (filePath: string) => invokeWithCacheClear<void>('delete_backup', { filePath }),

  clearLogs: (keepDays?: number) =>
    invokeWithCacheClear<number>('clear_logs', { keepDays: keepDays ?? null }),

  cleanHistoryPlans: (olderThanDays?: number) =>
    invokeWithCacheClear<number>('clean_history_plans', { olderThanDays: olderThanDays ?? null }),

  cleanMaterials: (olderThanDays?: number) =>
    invokeWithCacheClear<number>('clean_materials', { olderThanDays: olderThanDays ?? null }),
};

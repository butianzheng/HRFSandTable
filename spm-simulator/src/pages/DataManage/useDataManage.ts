import { useState, useEffect, useCallback, useMemo } from 'react';
import { Form, message } from 'antd';
import dayjs from 'dayjs';

import { materialApi } from '../../services/materialApi';
import { scheduleApi } from '../../services/scheduleApi';
import type { Material, MaterialFilter } from '../../types/material';
import type {
  MaterialStats,
  SchedulePlan,
  ScheduleItem,
  BackupFileInfo,
  ExportTemplate,
  CleanupEstimate,
} from '../../types/schedule';
import { getErrorMessage } from '../../utils/error';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  type ExportTemplateFormValues,
  type ExportColumnItem,
  type FormatRuleItem,
  parseColumnItems,
  parseFormatRuleItems,
  buildColumnsJson,
  buildFormatRulesJson,
  collectDuplicateValues,
  parseColumnKeysFromColumnsConfig,
  parseTemplateColumnOptions,
  parseTemplateColumnOptionsFromItems,
} from './exportTemplateUtils';

export function useDataManage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<MaterialStats | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 过滤
  const [statusFilter, setStatusFilter] = useState('');
  const [tempFilter, setTempFilter] = useState('');
  const [keyword, setKeyword] = useState('');
  const debouncedKeyword = useDebouncedValue(keyword, 300);
  const [planManageKeyword, setPlanManageKeyword] = useState('');
  const [planManageStatusFilter, setPlanManageStatusFilter] = useState('');
  const [selectedPlanIds, setSelectedPlanIds] = useState<number[]>([]);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupEstimate, setCleanupEstimate] = useState<CleanupEstimate | null>(null);
  const [cleanupEstimateLoading, setCleanupEstimateLoading] = useState(false);
  const [deletingPlanIds, setDeletingPlanIds] = useState<number[]>([]);
  const [deletingPlanBatch, setDeletingPlanBatch] = useState(false);

  // 方案筛选（排程状态派生）
  const [planFilterId, setPlanFilterId] = useState<number | null>(null);
  const [planScheduleItems, setPlanScheduleItems] = useState<ScheduleItem[]>([]);
  const [planScheduleLoading, setPlanScheduleLoading] = useState(false);
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<'' | 'in_plan' | 'not_in_plan'>('');

  // 导出相关
  const [plans, setPlans] = useState<SchedulePlan[]>([]);
  const [exportPlanId, setExportPlanId] = useState<number | null>(null);
  const [exportTemplateId, setExportTemplateId] = useState<number | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [backupModalOpen, setBackupModalOpen] = useState(false);
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [backupLoading, setBackupLoading] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [templateFormOpen, setTemplateFormOpen] = useState(false);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSubmitting, setTemplateSubmitting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [dragColumnIndex, setDragColumnIndex] = useState<number | null>(null);
  const [dragOverColumnIndex, setDragOverColumnIndex] = useState<number | null>(null);
  const [dragRuleIndex, setDragRuleIndex] = useState<number | null>(null);
  const [dragOverRuleIndex, setDragOverRuleIndex] = useState<number | null>(null);
  const [templateForm] = Form.useForm<ExportTemplateFormValues>();
  const watchedColumnItems = Form.useWatch('column_items', templateForm);
  const watchedTemplateColumns = Form.useWatch('columns', templateForm);
  const watchedRuleItems = Form.useWatch('format_rule_items', templateForm);

  // ─── 模板表单派生状态 ───
  const columnsPreview = useMemo(() => buildColumnsJson(watchedColumnItems), [watchedColumnItems]);
  const visualColumnOptions = useMemo(
    () => parseTemplateColumnOptionsFromItems(watchedColumnItems),
    [watchedColumnItems]
  );
  const formatFieldOptions = useMemo(
    () =>
      visualColumnOptions.length > 0
        ? visualColumnOptions
        : parseTemplateColumnOptions(watchedTemplateColumns),
    [visualColumnOptions, watchedTemplateColumns]
  );
  const formatRulesPreview = useMemo(
    () => buildFormatRulesJson(watchedRuleItems),
    [watchedRuleItems]
  );
  const visualColumnValidation = useMemo(() => {
    const items = Array.isArray(watchedColumnItems) ? watchedColumnItems : [];
    const emptyIndexes: number[] = [];
    const keys: string[] = [];
    let enabledCount = 0;

    items.forEach((item: ExportColumnItem, index: number) => {
      const key = item?.key?.trim() || '';
      if (!key) {
        emptyIndexes.push(index + 1);
      } else {
        keys.push(key);
      }
      if (item?.enabled !== false && key) {
        enabledCount += 1;
      }
    });

    return {
      hasItems: items.length > 0,
      emptyIndexes,
      duplicateKeys: collectDuplicateValues(keys),
      enabledCount,
    };
  }, [watchedColumnItems]);
  const visualRuleValidation = useMemo(() => {
    const ruleItems = Array.isArray(watchedRuleItems) ? watchedRuleItems : [];
    const columnItems = Array.isArray(watchedColumnItems) ? watchedColumnItems : [];
    const emptyIndexes: number[] = [];
    const fields: string[] = [];

    ruleItems.forEach((item: FormatRuleItem, index: number) => {
      const field = item?.field?.trim() || '';
      if (!field) {
        emptyIndexes.push(index + 1);
        return;
      }
      fields.push(field);
    });

    const enabledColumnSet = new Set(
      columnItems
        .filter((item: ExportColumnItem) => item?.enabled !== false)
        .map((item: ExportColumnItem) => item?.key?.trim() || '')
        .filter((key: string) => key.length > 0)
    );
    const outOfRangeFields = Array.from(
      new Set(fields.filter((field) => enabledColumnSet.size > 0 && !enabledColumnSet.has(field)))
    );

    return {
      hasItems: ruleItems.length > 0,
      emptyIndexes,
      duplicateFields: collectDuplicateValues(fields),
      outOfRangeFields,
    };
  }, [watchedColumnItems, watchedRuleItems]);
  const columnConflictMessages = useMemo(() => {
    const messages: string[] = [];
    if (visualColumnValidation.emptyIndexes.length > 0) {
      messages.push(`第 ${visualColumnValidation.emptyIndexes.join(', ')} 项字段为空`);
    }
    if (visualColumnValidation.duplicateKeys.length > 0) {
      messages.push(`存在重复字段: ${visualColumnValidation.duplicateKeys.join(', ')}`);
    }
    if (visualColumnValidation.hasItems && visualColumnValidation.enabledCount === 0) {
      messages.push('当前所有列均为未启用状态');
    }
    return messages;
  }, [visualColumnValidation]);
  const ruleConflictMessages = useMemo(() => {
    const messages: string[] = [];
    if (visualRuleValidation.emptyIndexes.length > 0) {
      messages.push(`第 ${visualRuleValidation.emptyIndexes.join(', ')} 条规则字段为空`);
    }
    if (visualRuleValidation.duplicateFields.length > 0) {
      messages.push(`存在重复规则字段: ${visualRuleValidation.duplicateFields.join(', ')}`);
    }
    if (visualRuleValidation.outOfRangeFields.length > 0) {
      messages.push(`规则字段不在启用列中: ${visualRuleValidation.outOfRangeFields.join(', ')}`);
    }
    return messages;
  }, [visualRuleValidation]);

  // ─── 数据加载 ───
  const loadMaterials = useCallback(
    async (keywordOverride?: string) => {
      try {
        setLoading(true);
        const filter: MaterialFilter = {};
        if (statusFilter) filter.status = statusFilter;
        if (tempFilter) filter.temp_status = tempFilter;
        const keywordValue = (keywordOverride ?? debouncedKeyword).trim();
        if (keywordValue) filter.keyword = keywordValue;

        const result = await materialApi.getMaterials(filter, { page, page_size: pageSize });
        setMaterials(result.items);
        setTotal(result.total);
      } catch (error: unknown) {
        message.error(`加载材料数据失败: ${getErrorMessage(error)}`);
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, tempFilter, debouncedKeyword, page, pageSize]
  );

  const loadStats = useCallback(async () => {
    try {
      const data = await scheduleApi.getMaterialStats();
      setStats(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadPlans = useCallback(async () => {
    try {
      const data = await scheduleApi.getPlans();
      setPlans(data);
    } catch {
      /* ignore */
    }
  }, []);

  const loadBackups = useCallback(async () => {
    try {
      setBackupLoading(true);
      const data = await scheduleApi.getBackups();
      setBackups(data);
    } catch (error: unknown) {
      message.error(`加载备份列表失败: ${getErrorMessage(error)}`);
    } finally {
      setBackupLoading(false);
    }
  }, []);

  const loadCleanupEstimate = useCallback(async (days: number) => {
    try {
      setCleanupEstimateLoading(true);
      const data = await scheduleApi.getCleanupEstimate(days);
      setCleanupEstimate(data);
    } catch {
      setCleanupEstimate(null);
    } finally {
      setCleanupEstimateLoading(false);
    }
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplateLoading(true);
      const data = await scheduleApi.getExportTemplates();
      setTemplates(data);
    } catch (error: unknown) {
      message.error(`加载导出模板失败: ${getErrorMessage(error)}`);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  const loadPlanScheduleItems = useCallback(async (planId: number) => {
    try {
      setPlanScheduleLoading(true);
      const items = await scheduleApi.getScheduleItems(planId);
      setPlanScheduleItems(items);
    } catch {
      setPlanScheduleItems([]);
    } finally {
      setPlanScheduleLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);
  useEffect(() => {
    loadStats();
    loadPlans();
    loadBackups();
  }, [loadStats, loadPlans, loadBackups]);
  useEffect(() => {
    loadCleanupEstimate(cleanupDays);
  }, [cleanupDays, loadCleanupEstimate]);
  useEffect(() => {
    if (!templateModalOpen && !exportModalOpen) return;
    loadTemplates();
  }, [templateModalOpen, exportModalOpen, loadTemplates]);
  useEffect(() => {
    if (!exportModalOpen || exportTemplateId !== null || templates.length === 0) return;
    const defaultTemplate = templates.find((item) => item.is_default);
    setExportTemplateId(defaultTemplate?.id ?? null);
  }, [exportModalOpen, exportTemplateId, templates]);

  // 方案筛选变化时加载 schedule_items
  useEffect(() => {
    if (planFilterId) {
      loadPlanScheduleItems(planFilterId);
    } else {
      setPlanScheduleItems([]);
      setScheduleStatusFilter('');
    }
  }, [planFilterId, loadPlanScheduleItems]);

  // ─── 方案筛选派生数据 ───
  const scheduledMaterialIds = useMemo(
    () => new Set(planScheduleItems.map((item) => item.material_id)),
    [planScheduleItems]
  );

  const planFilteredPlan = useMemo(
    () => plans.find((p) => p.id === planFilterId) ?? null,
    [plans, planFilterId]
  );

  const planChildCountMap = useMemo(() => {
    const map = new Map<number, number>();
    plans.forEach((plan) => {
      if (!plan.parent_id) return;
      map.set(plan.parent_id, (map.get(plan.parent_id) ?? 0) + 1);
    });
    return map;
  }, [plans]);

  const filteredPlans = useMemo(() => {
    const keywordNormalized = planManageKeyword.trim().toLowerCase();
    return plans.filter((plan) => {
      if (planManageStatusFilter && (plan.status ?? '') !== planManageStatusFilter) {
        return false;
      }
      if (!keywordNormalized) return true;
      const searchText = [
        plan.plan_no,
        plan.name,
        plan.status ?? '',
        plan.remarks ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return searchText.includes(keywordNormalized);
    });
  }, [plans, planManageKeyword, planManageStatusFilter]);

  const planStats = useMemo(() => {
    if (!planFilterId) return null;
    return { inPlan: planScheduleItems.length };
  }, [planFilterId, planScheduleItems]);

  const displayMaterials = useMemo(() => {
    if (!planFilterId || !scheduleStatusFilter) return materials;
    if (scheduleStatusFilter === 'in_plan') {
      return materials.filter((m) => scheduledMaterialIds.has(m.id));
    }
    return materials.filter((m) => !scheduledMaterialIds.has(m.id));
  }, [materials, planFilterId, scheduleStatusFilter, scheduledMaterialIds]);

  // ─── 操作处理 ───
  const handleRefreshTemper = async () => {
    try {
      setLoading(true);
      const result = await materialApi.refreshTemperStatus();
      message.success(`适温刷新完成: ${result.tempered}已适温, ${result.waiting}等待中`);
      loadMaterials();
      loadStats();
    } catch (error: unknown) {
      message.error(`刷新失败: ${getErrorMessage(error)}`);
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      const count = await materialApi.deleteMaterials(selectedIds);
      message.success(`成功删除 ${count} 条材料`);
      setSelectedIds([]);
      loadMaterials();
      loadStats();
    } catch (error: unknown) {
      message.error(`删除失败: ${getErrorMessage(error)}`);
    }
  };

  const handleExportMaterials = async () => {
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const filePath = await save({
        defaultPath: `材料清单_${dayjs().format('YYYYMMDD')}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      });
      if (!filePath) return;

      setExporting(true);
      const result = await scheduleApi.exportMaterialsExcel(filePath, statusFilter || undefined);
      message.success(`导出成功: ${result.row_count} 条材料`);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes('plugin-dialog') || errorMsg.includes('import')) {
        message.error('无法打开文件保存对话框，请确保应用运行在 Tauri 环境中');
      } else {
        message.error(`导出失败: ${errorMsg}`);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleExportPlan = async (format: 'excel' | 'csv') => {
    if (!exportPlanId) {
      message.warning('请选择要导出的方案');
      return;
    }
    try {
      const { save } = await import('@tauri-apps/plugin-dialog');
      const ext = format === 'excel' ? 'xlsx' : 'csv';
      const plan = plans.find((p) => p.id === exportPlanId);
      const name = plan ? plan.plan_no : String(exportPlanId);
      const filePath = await save({
        defaultPath: `排程方案_${name}_${dayjs().format('YYYYMMDD')}.${ext}`,
        filters: [{ name: format === 'excel' ? 'Excel' : 'CSV', extensions: [ext] }],
      });
      if (!filePath) return;

      setExporting(true);
      const result =
        format === 'excel'
          ? await scheduleApi.exportPlanExcel(exportPlanId, filePath, exportTemplateId || undefined)
          : await scheduleApi.exportPlanCsv(exportPlanId, filePath, exportTemplateId || undefined);
      message.success(`导出成功: ${result.row_count} 条排程`);
      setExportModalOpen(false);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes('plugin-dialog') || errorMsg.includes('import')) {
        message.error('无法打开文件保存对话框，请确保应用运行在 Tauri 环境中');
      } else {
        message.error(`导出失败: ${errorMsg}`);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleBackupDatabase = async () => {
    try {
      setBackupLoading(true);
      const backup = await scheduleApi.backupDatabase();
      message.success(`备份成功: ${backup.file_name}`);
      await loadBackups();
    } catch (error: unknown) {
      message.error(`备份失败: ${getErrorMessage(error)}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreBackup = async (filePath: string) => {
    try {
      setBackupLoading(true);
      await scheduleApi.restoreDatabase(filePath);
      message.success('数据库恢复成功');
      await loadMaterials();
      await loadStats();
      await loadPlans();
      await loadBackups();
    } catch (error: unknown) {
      message.error(`恢复失败: ${getErrorMessage(error)}`);
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestoreFromFile = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const filePath = await open({
        multiple: false,
        filters: [{ name: '数据库备份', extensions: ['db'] }],
      });
      if (!filePath || Array.isArray(filePath)) {
        return;
      }
      handleRestoreBackup(filePath);
    } catch (error: unknown) {
      const errorMsg = getErrorMessage(error);
      if (errorMsg.includes('plugin-dialog') || errorMsg.includes('import')) {
        message.error('无法打开文件选择对话框，请确保应用运行在 Tauri 环境中');
      } else {
        message.error(`选择备份文件失败: ${errorMsg}`);
      }
    }
  };

  const handleClearLogs = async () => {
    try {
      const count = await scheduleApi.clearLogs(cleanupDays);
      message.success(`日志清理完成: ${count} 条`);
      loadCleanupEstimate(cleanupDays);
    } catch (error: unknown) {
      message.error(`清理日志失败: ${getErrorMessage(error)}`);
    }
  };

  const handleCleanHistoryPlans = async () => {
    try {
      const count = await scheduleApi.cleanHistoryPlans(cleanupDays);
      message.success(`历史方案清理完成: ${count} 条`);
      loadPlans();
      loadCleanupEstimate(cleanupDays);
    } catch (error: unknown) {
      message.error(`清理历史方案失败: ${getErrorMessage(error)}`);
    }
  };

  const handleCleanMaterials = async () => {
    try {
      const count = await scheduleApi.cleanMaterials(cleanupDays);
      message.success(`材料清理完成: ${count} 条`);
      loadMaterials();
      loadStats();
      loadCleanupEstimate(cleanupDays);
    } catch (error: unknown) {
      message.error(`清理材料失败: ${getErrorMessage(error)}`);
    }
  };

  const handleClearUndoStack = async () => {
    try {
      const count = await scheduleApi.clearUndoStack();
      message.success(`撤销栈清理完成: ${count} 条`);
    } catch (error: unknown) {
      message.error(`清理撤销栈失败: ${getErrorMessage(error)}`);
    }
  };

  const syncAfterPlanDeletion = useCallback(
    async (deletedIds: number[]) => {
      if (deletedIds.length === 0) return;
      const deletedSet = new Set(deletedIds);
      setSelectedPlanIds((prev) => prev.filter((id) => !deletedSet.has(id)));
      if (exportPlanId && deletedSet.has(exportPlanId)) {
        setExportPlanId(null);
      }
      if (planFilterId && deletedSet.has(planFilterId)) {
        setPlanFilterId(null);
        setPlanScheduleItems([]);
        setScheduleStatusFilter('');
      }
      await loadPlans();
      await loadCleanupEstimate(cleanupDays);
    },
    [
      cleanupDays,
      exportPlanId,
      loadCleanupEstimate,
      loadPlans,
      planFilterId,
      setPlanFilterId,
      setPlanScheduleItems,
      setScheduleStatusFilter,
    ]
  );

  const handleDeletePlan = async (planId: number) => {
    const plan = plans.find((item) => item.id === planId);
    const childCount = planChildCountMap.get(planId) ?? 0;
    if (childCount > 0) {
      message.warning(`方案 ${plan?.plan_no ?? planId} 存在 ${childCount} 个子版本，请先删除子版本`);
      return;
    }
    try {
      setDeletingPlanIds((prev) => (prev.includes(planId) ? prev : [...prev, planId]));
      await scheduleApi.deletePlan(planId);
      await syncAfterPlanDeletion([planId]);
      message.success(`方案已删除: ${plan?.name ?? plan?.plan_no ?? planId}`);
    } catch (error: unknown) {
      message.error(`删除方案失败: ${getErrorMessage(error)}`);
    } finally {
      setDeletingPlanIds((prev) => prev.filter((id) => id !== planId));
    }
  };

  const handleBatchDeletePlans = async () => {
    if (selectedPlanIds.length === 0) return;
    const planMap = new Map(plans.map((plan) => [plan.id, plan]));
    const depthCache = new Map<number, number>();
    const calcDepth = (planId: number): number => {
      if (depthCache.has(planId)) return depthCache.get(planId) ?? 0;
      const parentId = planMap.get(planId)?.parent_id;
      if (!parentId || !planMap.has(parentId)) {
        depthCache.set(planId, 0);
        return 0;
      }
      const depth = calcDepth(parentId) + 1;
      depthCache.set(planId, depth);
      return depth;
    };

    const orderedIds = [...selectedPlanIds].sort((a, b) => {
      const depthDiff = calcDepth(b) - calcDepth(a);
      if (depthDiff !== 0) return depthDiff;
      return b - a;
    });

    const deletedIds: number[] = [];
    const failed: Array<{ id: number; message: string }> = [];

    try {
      setDeletingPlanBatch(true);
      for (const planId of orderedIds) {
        try {
          await scheduleApi.deletePlan(planId);
          deletedIds.push(planId);
        } catch (error: unknown) {
          failed.push({ id: planId, message: getErrorMessage(error) });
        }
      }

      await syncAfterPlanDeletion(deletedIds);

      if (deletedIds.length > 0) {
        message.success(`已删除 ${deletedIds.length} 个方案`);
      }
      if (failed.length > 0) {
        const failedSummary = failed
          .slice(0, 3)
          .map((item) => `${planMap.get(item.id)?.plan_no ?? item.id}: ${item.message}`)
          .join('；');
        message.warning(`有 ${failed.length} 个方案删除失败：${failedSummary}`);
      }
      if (deletedIds.length === 0 && failed.length === 0) {
        message.info('未执行删除');
      }
    } finally {
      setDeletingPlanBatch(false);
      const failedSet = new Set(failed.map((item) => item.id));
      setSelectedPlanIds((prev) => prev.filter((id) => failedSet.has(id)));
    }
  };

  const handleDeleteBackup = async (filePath: string) => {
    try {
      setBackupLoading(true);
      await scheduleApi.deleteBackup(filePath);
      message.success('备份删除成功');
      await loadBackups();
    } catch (error: unknown) {
      message.error(`删除备份失败: ${getErrorMessage(error)}`);
    } finally {
      setBackupLoading(false);
    }
  };

  // ─── 模板操作 ───
  const openCreateTemplateForm = () => {
    const defaultColumns = JSON.stringify(
      ['coil_id', 'steel_grade', 'width', 'thickness', 'weight'],
      null,
      2
    );
    setEditingTemplate(null);
    templateForm.setFieldsValue({
      name: '',
      description: '',
      columns: defaultColumns,
      column_items: parseColumnItems(defaultColumns),
      format_rules: '',
      format_rule_items: [],
      is_default: false,
    });
    setTemplateFormOpen(true);
  };

  const openEditTemplateForm = (template: ExportTemplate) => {
    const rawColumns = template.columns || '';
    const rawRules = template.format_rules || '';
    setEditingTemplate(template);
    templateForm.setFieldsValue({
      name: template.name,
      description: template.description || '',
      columns: rawColumns,
      column_items: parseColumnItems(rawColumns),
      format_rules: rawRules,
      format_rule_items: parseFormatRuleItems(rawRules),
      is_default: template.is_default ?? false,
    });
    setTemplateFormOpen(true);
  };

  const closeTemplateForm = () => {
    setTemplateFormOpen(false);
    setEditingTemplate(null);
    setDragColumnIndex(null);
    setDragOverColumnIndex(null);
    setDragRuleIndex(null);
    setDragOverRuleIndex(null);
    templateForm.resetFields();
  };

  const handleSaveTemplate = async () => {
    try {
      const values = await templateForm.validateFields();
      const name = values.name.trim();
      const columnsRaw = (values.columns || '').trim();
      const visualColumnItems = Array.isArray(values.column_items) ? values.column_items : [];
      const columnsVisual = buildColumnsJson(values.column_items);
      let finalColumns = columnsVisual;
      const description = values.description?.trim();
      const formatRulesRaw = values.format_rules?.trim();
      const visualRuleItems = Array.isArray(values.format_rule_items)
        ? values.format_rule_items
        : [];
      const formatRulesVisual = buildFormatRulesJson(values.format_rule_items);
      let finalFormatRules = formatRulesVisual;

      if (!name) {
        message.warning('模板名称不能为空');
        return;
      }

      const emptyColumnCount = visualColumnItems.filter(
        (item: ExportColumnItem) => !item.key?.trim()
      ).length;
      if (visualColumnItems.length > 0 && emptyColumnCount > 0) {
        message.warning('可视化列配置存在空字段，请先补全');
        return;
      }

      const visualColumnKeys = visualColumnItems
        .map((item: ExportColumnItem) => item.key?.trim() || '')
        .filter((key: string) => key.length > 0);
      const duplicatedColumnKeys = collectDuplicateValues(visualColumnKeys);
      if (duplicatedColumnKeys.length > 0) {
        message.warning(`可视化列配置存在重复字段: ${duplicatedColumnKeys.join(', ')}`);
        return;
      }

      if (visualColumnItems.length > 0 && !columnsVisual) {
        message.warning('可视化列配置中未启用任何列');
        return;
      }

      if (!finalColumns) {
        try {
          JSON.parse(columnsRaw);
          finalColumns = columnsRaw;
        } catch (error: unknown) {
          message.error(`导出列配置JSON无效: ${getErrorMessage(error)}`);
          return;
        }
      }

      if (!finalColumns) {
        message.warning('请至少选择一个导出列');
        return;
      }

      let enabledColumnKeys = visualColumnItems
        .filter((item: ExportColumnItem) => item.enabled !== false)
        .map((item: ExportColumnItem) => item.key?.trim() || '')
        .filter((key: string) => key.length > 0);
      if (enabledColumnKeys.length === 0) {
        enabledColumnKeys = parseColumnKeysFromColumnsConfig(finalColumns);
      }

      const duplicatedRuleFields = collectDuplicateValues(
        visualRuleItems
          .map((item: FormatRuleItem) => item.field?.trim() || '')
          .filter((field: string) => field.length > 0)
      );
      if (duplicatedRuleFields.length > 0) {
        message.warning(`可视化规则存在重复字段: ${duplicatedRuleFields.join(', ')}`);
        return;
      }

      if (enabledColumnKeys.length > 0 && visualRuleItems.length > 0) {
        const enabledSet = new Set(enabledColumnKeys);
        const invalidRuleFields = Array.from(
          new Set(
            visualRuleItems
              .map((item: FormatRuleItem) => item.field?.trim() || '')
              .filter((field: string) => field.length > 0 && !enabledSet.has(field))
          )
        );
        if (invalidRuleFields.length > 0) {
          message.warning(`规则字段不在启用列中: ${invalidRuleFields.join(', ')}`);
          return;
        }
      }

      if (!finalFormatRules && formatRulesRaw) {
        try {
          JSON.parse(formatRulesRaw);
          finalFormatRules = formatRulesRaw;
        } catch (error: unknown) {
          message.error(`格式规则JSON无效: ${getErrorMessage(error)}`);
          return;
        }
      }

      setTemplateSubmitting(true);
      const payload = {
        name,
        description: description || undefined,
        columns: finalColumns,
        format_rules: finalFormatRules || undefined,
        is_default: values.is_default ?? false,
      };

      if (editingTemplate) {
        await scheduleApi.updateExportTemplate(editingTemplate.id, payload);
        message.success('导出模板更新成功');
      } else {
        await scheduleApi.createExportTemplate(payload);
        message.success('导出模板创建成功');
      }

      closeTemplateForm();
      await loadTemplates();
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'errorFields' in error) {
        return;
      }
      message.error(`保存导出模板失败: ${getErrorMessage(error)}`);
    } finally {
      setTemplateSubmitting(false);
    }
  };

  const handleSetDefaultTemplate = async (template: ExportTemplate) => {
    if (template.is_default) return;
    try {
      setTemplateLoading(true);
      await scheduleApi.updateExportTemplate(template.id, { is_default: true });
      message.success(`已设为默认模板: ${template.name}`);
      await loadTemplates();
    } catch (error: unknown) {
      message.error(`设置默认模板失败: ${getErrorMessage(error)}`);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDeleteTemplate = async (id: number) => {
    try {
      setTemplateLoading(true);
      await scheduleApi.deleteExportTemplate(id);
      message.success('导出模板删除成功');
      await loadTemplates();
    } catch (error: unknown) {
      message.error(`删除导出模板失败: ${getErrorMessage(error)}`);
    } finally {
      setTemplateLoading(false);
    }
  };

  return {
    // 材料数据
    materials,
    total,
    loading,
    stats,
    selectedIds,
    setSelectedIds,
    page,
    setPage,
    pageSize,
    setPageSize,
    // 过滤
    statusFilter,
    setStatusFilter,
    tempFilter,
    setTempFilter,
    keyword,
    setKeyword,
    planManageKeyword,
    setPlanManageKeyword,
    planManageStatusFilter,
    setPlanManageStatusFilter,
    selectedPlanIds,
    setSelectedPlanIds,
    cleanupDays,
    setCleanupDays,
    cleanupEstimate,
    cleanupEstimateLoading,
    deletingPlanIds,
    deletingPlanBatch,
    // 方案筛选
    planFilterId,
    setPlanFilterId,
    planScheduleLoading,
    scheduledMaterialIds,
    planFilteredPlan,
    planStats,
    scheduleStatusFilter,
    setScheduleStatusFilter,
    displayMaterials,
    filteredPlans,
    planChildCountMap,
    // 导出
    plans,
    exportPlanId,
    setExportPlanId,
    exportTemplateId,
    setExportTemplateId,
    exportModalOpen,
    setExportModalOpen,
    exporting,
    // 备份
    backupModalOpen,
    setBackupModalOpen,
    backups,
    backupLoading,
    // 模板
    templateModalOpen,
    setTemplateModalOpen,
    templateFormOpen,
    templateForm,
    templates,
    templateLoading,
    templateSubmitting,
    editingTemplate,
    dragColumnIndex,
    setDragColumnIndex,
    dragOverColumnIndex,
    setDragOverColumnIndex,
    dragRuleIndex,
    setDragRuleIndex,
    dragOverRuleIndex,
    setDragOverRuleIndex,
    columnsPreview,
    formatFieldOptions,
    formatRulesPreview,
    columnConflictMessages,
    ruleConflictMessages,
    // 操作
    loadMaterials,
    loadStats,
    loadPlans,
    loadBackups,
    loadCleanupEstimate,
    loadTemplates,
    handleRefreshTemper,
    handleDelete,
    handleExportMaterials,
    handleExportPlan,
    handleBackupDatabase,
    handleRestoreBackup,
    handleRestoreFromFile,
    handleClearLogs,
    handleCleanHistoryPlans,
    handleCleanMaterials,
    handleClearUndoStack,
    handleDeletePlan,
    handleBatchDeletePlans,
    handleDeleteBackup,
    openCreateTemplateForm,
    openEditTemplateForm,
    closeTemplateForm,
    handleSaveTemplate,
    handleSetDefaultTemplate,
    handleDeleteTemplate,
  };
}

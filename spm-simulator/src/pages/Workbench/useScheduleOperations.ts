import { useCallback } from 'react';
import { message, Modal } from 'antd';
import type { FormInstance } from 'antd';
import dayjs from 'dayjs';

import { scheduleApi } from '../../services/scheduleApi';
import { materialApi } from '../../services/materialApi';
import type { ScheduleResult, SchedulePlan } from '../../types/schedule';
import type { Material, ConflictMode } from '../../types/material';
import { getErrorMessage, isFormValidateError } from '../../utils/error';
import type { ScheduleRow } from './types';

export interface UseScheduleOperationsParams {
  currentPlan: SchedulePlan | null;
  scheduleItems: ScheduleRow[];
  undoCount: number;
  redoCount: number;
  selectedMaterialIds: number[];
  selectedItemIds: number[];
  materials: Material[];
  strategies: { id: number; name: string; is_default?: boolean }[];
  plans: SchedulePlan[];
  exportTemplateId: number | null;

  // Data loading functions
  loadScheduleItems: (planId: number) => Promise<void>;
  loadUndoRedoCount: (planId: number) => Promise<void>;
  loadMaterials: () => Promise<void>;
  loadStrategies: () => Promise<void>;

  // State setters
  setScheduling: (v: boolean) => void;
  setCurrentPlan: (p: SchedulePlan | null) => void;
  setPlans: React.Dispatch<React.SetStateAction<SchedulePlan[]>>;
  setExportTemplateId: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedMaterialIds: React.Dispatch<React.SetStateAction<number[]>>;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<number[]>>;

  // Modal setters
  setAddModalOpen: (v: boolean) => void;
  setInsertPosition: (v: number | null) => void;
  setScheduleModalOpen: (v: boolean) => void;
  setExportModalOpen: (v: boolean) => void;
  setImportModalOpen: (v: boolean) => void;
  setImporting: (v: boolean) => void;
  setExporting: (v: boolean) => void;
  setImportFilePath: (v: string) => void;
  setSelectedMappingId: (v: number | null) => void;
  setCreateModalOpen: (v: boolean) => void;
  setCreateModalMode: (v: 'create' | 'save_as') => void;
  setMaterialDetail: (v: Material | null) => void;
  setMaterialDetailOpen: (v: boolean) => void;
  setPriorityModalOpen: (v: boolean) => void;
  setSelectedStrategyId: (v: number | null) => void;

  // Form & import state
  createForm: FormInstance;
  createModalMode: 'create' | 'save_as';
  importFilePath: string;
  selectedMappingId: number | null;
  selectedStrategyId: number | null;
  conflictMode: ConflictMode;
  setConflictMode: (v: ConflictMode) => void;
}

export function useScheduleOperations(params: UseScheduleOperationsParams) {
  const {
    currentPlan,
    scheduleItems,
    undoCount,
    redoCount,
    selectedMaterialIds,
    selectedItemIds,
    materials,
    strategies,
    exportTemplateId,
    loadScheduleItems,
    loadUndoRedoCount,
    loadMaterials,
    loadStrategies,
    setScheduling,
    setCurrentPlan,
    setPlans,
    setSelectedMaterialIds,
    setSelectedItemIds,
    setAddModalOpen,
    setInsertPosition,
    setScheduleModalOpen,
    setExportModalOpen,
    setImporting,
    setExporting,
    setImportFilePath,
    setSelectedMappingId,
    setCreateModalOpen,
    setCreateModalMode,
    createForm,
    createModalMode,
    importFilePath,
    selectedMappingId,
    selectedStrategyId,
    setSelectedStrategyId,
    setPriorityModalOpen,
  } = params;

  const { conflictMode, setConflictMode } = params;

  const refreshAfterMutation = useCallback(async () => {
    if (!currentPlan) return;
    await loadScheduleItems(currentPlan.id);
    await loadUndoRedoCount(currentPlan.id);
  }, [currentPlan, loadScheduleItems, loadUndoRedoCount]);

  const handleUndo = useCallback(async () => {
    if (!currentPlan || undoCount <= 0) return;
    try {
      await scheduleApi.undoAction(currentPlan.id);
      await refreshAfterMutation();
    } catch (error: unknown) {
      message.error(`撤销失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, undoCount, refreshAfterMutation]);

  const handleRedo = useCallback(async () => {
    if (!currentPlan || redoCount <= 0) return;
    try {
      await scheduleApi.redoAction(currentPlan.id);
      await refreshAfterMutation();
    } catch (error: unknown) {
      message.error(`重做失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, redoCount, refreshAfterMutation]);

  const handleSavePlan = useCallback(async () => {
    if (!currentPlan || currentPlan.status === 'confirmed') return;
    try {
      await scheduleApi.savePlan(currentPlan.id);
      const updatedPlan = await scheduleApi.getPlan(currentPlan.id);
      setCurrentPlan(updatedPlan);
      message.success('方案已保存');
    } catch (error: unknown) {
      message.error(`保存失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, setCurrentPlan]);

  const handleConfirmPlan = useCallback(async () => {
    if (!currentPlan) return;
    if (currentPlan.status === 'confirmed' || currentPlan.status === 'archived') return;
    try {
      const updatedPlan = await scheduleApi.updatePlanStatus(currentPlan.id, 'confirmed');
      setCurrentPlan(updatedPlan);
      setPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));
      message.success('方案已确认生效');
    } catch (error: unknown) {
      message.error(`确认生效失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, setCurrentPlan, setPlans]);

  const handleArchivePlan = useCallback(async () => {
    if (!currentPlan) return;
    if (currentPlan.status === 'archived') return;
    try {
      const updatedPlan = await scheduleApi.updatePlanStatus(currentPlan.id, 'archived');
      setCurrentPlan(updatedPlan);
      setPlans((prev) => prev.map((p) => (p.id === updatedPlan.id ? updatedPlan : p)));
      message.success('方案已归档');
    } catch (error: unknown) {
      message.error(`归档失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, setCurrentPlan, setPlans]);

  const handleRefreshTemper = useCallback(async () => {
    try {
      const result = await materialApi.refreshTemperStatus();
      message.success(`适温刷新完成: ${result.tempered} 条适温, ${result.waiting} 条待温`);
      await loadMaterials();
      if (currentPlan) await loadScheduleItems(currentPlan.id);
    } catch (error: unknown) {
      message.error(`刷新适温失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, loadMaterials, loadScheduleItems]);

  const handleAddToSchedule = useCallback(
    async (position?: number) => {
      if (!currentPlan) return;
      const readyPendingIds = selectedMaterialIds.filter((id) => {
        const m = materials.find((mat) => mat.id === id);
        return (
          m && (m.status ?? 'pending') !== 'frozen' && (m.temp_status ?? 'waiting') === 'ready'
        );
      });
      if (readyPendingIds.length === 0) return;
      try {
        const beforeJson = JSON.stringify(scheduleItems.map((r) => r.id));
        await scheduleApi.addToSchedule(currentPlan.id, readyPendingIds, position);
        await scheduleApi.pushUndo(
          currentPlan.id,
          'add_materials',
          beforeJson,
          JSON.stringify(readyPendingIds)
        );
        setSelectedMaterialIds([]);
        setAddModalOpen(false);
        setInsertPosition(null);
        await refreshAfterMutation();
        message.success(`已添加 ${readyPendingIds.length} 块材料`);
      } catch (error: unknown) {
        message.error(`添加失败: ${getErrorMessage(error)}`);
      }
    },
    [
      currentPlan,
      selectedMaterialIds,
      materials,
      scheduleItems,
      refreshAfterMutation,
      setSelectedMaterialIds,
      setAddModalOpen,
      setInsertPosition,
    ]
  );

  const handleMoveItem = useCallback(
    async (itemId: number, direction: 'up' | 'down') => {
      if (!currentPlan) return;
      const item = scheduleItems.find((r) => r.id === itemId);
      if (!item) return;
      const newSeq = direction === 'up' ? item.sequence - 1 : item.sequence + 1;
      if (newSeq < 1 || newSeq > scheduleItems.length) return;
      try {
        const beforeJson = JSON.stringify(scheduleItems.map((r) => r.id));
        await scheduleApi.moveScheduleItem(currentPlan.id, itemId, newSeq);
        await scheduleApi.pushUndo(
          currentPlan.id,
          'move_item',
          beforeJson,
          JSON.stringify({ itemId, newSeq })
        );
        await refreshAfterMutation();
      } catch (error: unknown) {
        message.error(`移动失败: ${getErrorMessage(error)}`);
      }
    },
    [currentPlan, scheduleItems, refreshAfterMutation]
  );

  const handleRemoveItems = useCallback(async () => {
    if (!currentPlan || selectedItemIds.length === 0) return;
    try {
      const beforeJson = JSON.stringify(scheduleItems.map((r) => r.id));
      await scheduleApi.removeFromSchedule(currentPlan.id, selectedItemIds);
      await scheduleApi.pushUndo(
        currentPlan.id,
        'remove_items',
        beforeJson,
        JSON.stringify(selectedItemIds)
      );
      setSelectedItemIds([]);
      await refreshAfterMutation();
    } catch (error: unknown) {
      message.error(`移除失败: ${getErrorMessage(error)}`);
    }
  }, [currentPlan, selectedItemIds, scheduleItems, refreshAfterMutation, setSelectedItemIds]);

  const handleLockItems = useCallback(
    async (locked: boolean) => {
      if (!currentPlan || selectedItemIds.length === 0) return;
      try {
        await scheduleApi.lockScheduleItems(currentPlan.id, selectedItemIds, locked);
        await refreshAfterMutation();
      } catch (error: unknown) {
        message.error(`${locked ? '锁定' : '解锁'}失败: ${getErrorMessage(error)}`);
      }
    },
    [currentPlan, selectedItemIds, refreshAfterMutation]
  );

  const handleAutoSchedule = useCallback(async () => {
    if (!currentPlan || !selectedStrategyId) return;
    try {
      setScheduling(true);
      const beforeJson = JSON.stringify(scheduleItems.map((r) => r.id));
      const result: ScheduleResult = await scheduleApi.autoSchedule(
        currentPlan.id,
        selectedStrategyId
      );
      await scheduleApi.pushUndo(
        currentPlan.id,
        'auto_schedule',
        beforeJson,
        JSON.stringify(result)
      );
      setScheduleModalOpen(false);
      const updatedPlan = await scheduleApi.getPlan(currentPlan.id);
      setCurrentPlan(updatedPlan);
      await refreshAfterMutation();
      let gapMsg = '';
      try {
        const gapSummary = await scheduleApi.analyzeScheduleIdleGaps(currentPlan.id, 30);
        if (gapSummary.over_threshold_count > 0) {
          gapMsg = `; 空档>${gapSummary.threshold_minutes}m ${gapSummary.over_threshold_count}处(最大${gapSummary.max_gap_minutes}m)`;
        }
      } catch {
        // 空档分析失败不影响主流程
      }
      const futureMsg = result.future_ready_count
        ? ` (含${result.future_ready_count}块滚动适温)`
        : '';
      const modeLabelMap: Record<string, string> = {
        beam: 'Beam',
        hybrid: '混合',
        greedy: '贪心',
        none: '无',
      };
      const modeLabel = result.scheduler_mode_used
        ? modeLabelMap[result.scheduler_mode_used] ?? result.scheduler_mode_used
        : '';
      const modeMsg = modeLabel
        ? ` [${modeLabel}${result.fallback_triggered ? '+兜底' : ''}]`
        : '';
      message.success(`排程完成: ${result.total_count} 块${futureMsg}${modeMsg}${gapMsg}`);
    } catch (error: unknown) {
      message.error(`排程失败: ${getErrorMessage(error)}`);
    } finally {
      setScheduling(false);
    }
  }, [
    currentPlan,
    selectedStrategyId,
    scheduleItems,
    refreshAfterMutation,
    setScheduling,
    setScheduleModalOpen,
    setCurrentPlan,
  ]);

  const handlePickImportFile = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
      });
      if (typeof selected === 'string') {
        params.setImportFilePath(selected);
      }
    } catch (error: unknown) {
      console.error('Failed to open file dialog:', error);
      message.error('无法打开文件选择对话框，请确保应用运行在 Tauri 环境中');
    }
  }, [params]);

  const handleImportMaterials = useCallback(async () => {
    if (!importFilePath) {
      message.warning('请先选择文件');
      return;
    }
    try {
      setImporting(true);

      if (conflictMode === 'replace_all') {
        const result = await materialApi.replaceAllMaterials(
          importFilePath,
          selectedMappingId ?? undefined
        );
        params.setImportModalOpen(false);
        setImportFilePath('');
        setSelectedMappingId(null);
        setConflictMode('skip');
        await loadMaterials();
        const r = result.import;
        Modal.success({
          title: '全量替换完成',
          content: `已清除材料: ${result.cleared_material_count} 条，排程项: ${result.cleared_schedule_item_count} 条\n新导入: 共 ${r.total} 条，成功 ${r.success}，失败 ${r.failed}${r.errors.length > 0 ? '\n错误: ' + r.errors.slice(0, 5).join('; ') + (r.errors.length > 5 ? ` ...等${r.errors.length}条` : '') : ''}`,
        });
      } else {
        const result = await materialApi.importMaterials(
          importFilePath,
          selectedMappingId ?? undefined,
          conflictMode
        );
        params.setImportModalOpen(false);
        setImportFilePath('');
        setSelectedMappingId(null);
        setConflictMode('skip');
        await loadMaterials();
        Modal.success({
          title: '导入完成',
          content: `总计: ${result.total} 条\n成功: ${result.success}，跳过: ${result.skipped}，覆盖: ${result.overwritten}，失败: ${result.failed}${result.errors.length > 0 ? '\n错误: ' + result.errors.slice(0, 5).join('; ') + (result.errors.length > 5 ? ` ...等${result.errors.length}条` : '') : ''}`,
        });
      }
    } catch (error: unknown) {
      message.error(`导入失败: ${getErrorMessage(error)}`);
    } finally {
      setImporting(false);
    }
  }, [
    importFilePath,
    selectedMappingId,
    conflictMode,
    loadMaterials,
    setImporting,
    setImportFilePath,
    setSelectedMappingId,
    setConflictMode,
    params,
  ]);

  const handleLoadImportBatches = useCallback(async () => {
    try {
      return await materialApi.getImportBatches();
    } catch (error: unknown) {
      message.error(`加载导入批次失败: ${getErrorMessage(error)}`);
      return [];
    }
  }, []);

  const handleDeleteImportBatch = useCallback(
    async (batchId: number) => {
      try {
        const result = await materialApi.deleteImportBatch(batchId);
        message.success(
          `批次已删除: 移除 ${result.deleted_materials} 条材料, 保留 ${result.kept_materials} 条`
        );
        await loadMaterials();
        return result;
      } catch (error: unknown) {
        message.error(`删除批次失败: ${getErrorMessage(error)}`);
        return null;
      }
    },
    [loadMaterials]
  );

  const handleExportPlan = useCallback(
    async (format: 'excel' | 'csv') => {
      if (!currentPlan) return;
      try {
        const { save } = await import('@tauri-apps/plugin-dialog');
        const ext = format === 'excel' ? 'xlsx' : 'csv';
        const filePath = await save({
          filters: [{ name: format === 'excel' ? 'Excel' : 'CSV', extensions: [ext] }],
          defaultPath: `${currentPlan.name}.${ext}`,
        });
        if (!filePath) return;
        try {
          setExporting(true);
          if (format === 'excel') {
            await scheduleApi.exportPlanExcel(
              currentPlan.id,
              filePath,
              exportTemplateId ?? undefined
            );
          } else {
            await scheduleApi.exportPlanCsv(currentPlan.id, filePath, exportTemplateId ?? undefined);
          }
          setExportModalOpen(false);
          message.success(`导出成功: ${filePath}`);
        } catch (error: unknown) {
          message.error(`导出失败: ${getErrorMessage(error)}`);
        } finally {
          setExporting(false);
        }
      } catch (error: unknown) {
        console.error('Failed to open save dialog:', error);
        message.error('无法打开文件保存对话框，请确保应用运行在 Tauri 环境中');
      }
    },
    [currentPlan, exportTemplateId, setExporting, setExportModalOpen]
  );

  const handleBatchUpdatePriority = useCallback(async () => {
    setPriorityModalOpen(false);
  }, [setPriorityModalOpen]);

  const handleCreatePlan = useCallback(async () => {
    try {
      const values = await createForm.validateFields();
      const [startDate, endDate] = values.dates;
      const newPlan = await scheduleApi.createPlan({
        name: values.name,
        period_type: values.period_type,
        start_date: startDate.format('YYYY-MM-DD'),
        end_date: endDate.format('YYYY-MM-DD'),
        strategy_id: values.strategy_id,
        parent_id: createModalMode === 'save_as' ? currentPlan?.id : values.parent_id,
        remarks: values.remarks,
      });
      setPlans((prev) => [...prev, newPlan]);
      setCurrentPlan(newPlan);
      setCreateModalOpen(false);
      setCreateModalMode('create');
      createForm.resetFields();
    } catch (error: unknown) {
      if (isFormValidateError(error)) return;
      message.error(`创建失败: ${getErrorMessage(error)}`);
    }
  }, [
    currentPlan,
    createModalMode,
    createForm,
    setPlans,
    setCurrentPlan,
    setCreateModalOpen,
    setCreateModalMode,
  ]);

  const handleOpenSaveAs = useCallback(() => {
    if (!currentPlan) return;
    setCreateModalMode('save_as');
    createForm.setFieldsValue({
      name: `${currentPlan.name}_副本`,
      period_type: currentPlan.period_type,
      dates: [dayjs(currentPlan.start_date), dayjs(currentPlan.end_date)],
    });
    setCreateModalOpen(true);
  }, [currentPlan, createForm, setCreateModalMode, setCreateModalOpen]);

  const handleOpenScheduleModal = useCallback(async () => {
    await loadStrategies();
    const def = strategies.find((s) => s.is_default);
    setSelectedStrategyId(def?.id ?? null);
    setScheduleModalOpen(true);
  }, [strategies, loadStrategies, setSelectedStrategyId, setScheduleModalOpen]);

  return {
    refreshAfterMutation,
    handleUndo,
    handleRedo,
    handleSavePlan,
    handleConfirmPlan,
    handleArchivePlan,
    handleRefreshTemper,
    handleAddToSchedule,
    handleMoveItem,
    handleRemoveItems,
    handleLockItems,
    handleAutoSchedule,
    handlePickImportFile,
    handleImportMaterials,
    handleLoadImportBatches,
    handleDeleteImportBatch,
    handleExportPlan,
    handleBatchUpdatePriority,
    handleCreatePlan,
    handleOpenSaveAs,
    handleOpenScheduleModal,
  };
}

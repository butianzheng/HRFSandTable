/**
 * Workbench 弹窗状态管理
 * 将 16 个弹窗相关 useState 合并为单一 useReducer，
 * 降低主组件状态碎片化程度。
 */
import { useReducer, useCallback } from 'react';
import type { Material, ConflictMode } from '../../types/material';

export interface ModalState {
  createModalOpen: boolean;
  createModalMode: 'create' | 'save_as';
  scheduleModalOpen: boolean;
  selectedStrategyId: number | null;
  importModalOpen: boolean;
  importing: boolean;
  selectedMappingId: number | null;
  importFilePath: string;
  conflictMode: ConflictMode;
  exportModalOpen: boolean;
  exporting: boolean;
  addModalOpen: boolean;
  insertPosition: number | null;
  priorityModalOpen: boolean;
  priorityValue: number;
  materialDetailOpen: boolean;
  materialDetail: Material | null;
}

const initialModalState: ModalState = {
  createModalOpen: false,
  createModalMode: 'create',
  scheduleModalOpen: false,
  selectedStrategyId: null,
  importModalOpen: false,
  importing: false,
  selectedMappingId: null,
  importFilePath: '',
  conflictMode: 'skip' as ConflictMode,
  exportModalOpen: false,
  exporting: false,
  addModalOpen: false,
  insertPosition: null,
  priorityModalOpen: false,
  priorityValue: 5,
  materialDetailOpen: false,
  materialDetail: null,
};

function modalReducer(state: ModalState, action: Partial<ModalState>): ModalState {
  return { ...state, ...action };
}

export function useWorkbenchModals() {
  const [state, dispatch] = useReducer(modalReducer, initialModalState);

  const setCreateModalOpen = useCallback((v: boolean) => dispatch({ createModalOpen: v }), []);
  const setCreateModalMode = useCallback(
    (v: 'create' | 'save_as') => dispatch({ createModalMode: v }),
    []
  );
  const setScheduleModalOpen = useCallback((v: boolean) => dispatch({ scheduleModalOpen: v }), []);
  const setSelectedStrategyId = useCallback(
    (v: number | null) => dispatch({ selectedStrategyId: v }),
    []
  );
  const setImportModalOpen = useCallback((v: boolean) => dispatch({ importModalOpen: v }), []);
  const setImporting = useCallback((v: boolean) => dispatch({ importing: v }), []);
  const setSelectedMappingId = useCallback(
    (v: number | null) => dispatch({ selectedMappingId: v }),
    []
  );
  const setImportFilePath = useCallback((v: string) => dispatch({ importFilePath: v }), []);
  const setConflictMode = useCallback(
    (v: ConflictMode) => dispatch({ conflictMode: v }),
    []
  );
  const setExportModalOpen = useCallback((v: boolean) => dispatch({ exportModalOpen: v }), []);
  const setExporting = useCallback((v: boolean) => dispatch({ exporting: v }), []);
  const setAddModalOpen = useCallback((v: boolean) => dispatch({ addModalOpen: v }), []);
  const setInsertPosition = useCallback((v: number | null) => dispatch({ insertPosition: v }), []);
  const setPriorityModalOpen = useCallback((v: boolean) => dispatch({ priorityModalOpen: v }), []);
  const setPriorityValue = useCallback((v: number) => dispatch({ priorityValue: v }), []);
  const setMaterialDetailOpen = useCallback(
    (v: boolean) => dispatch({ materialDetailOpen: v }),
    []
  );
  const setMaterialDetail = useCallback(
    (v: Material | null) => dispatch({ materialDetail: v }),
    []
  );

  return {
    ...state,
    patchModals: dispatch,
    setCreateModalOpen,
    setCreateModalMode,
    setScheduleModalOpen,
    setSelectedStrategyId,
    setImportModalOpen,
    setImporting,
    setSelectedMappingId,
    setImportFilePath,
    setConflictMode,
    setExportModalOpen,
    setExporting,
    setAddModalOpen,
    setInsertPosition,
    setPriorityModalOpen,
    setPriorityValue,
    setMaterialDetailOpen,
    setMaterialDetail,
  };
}

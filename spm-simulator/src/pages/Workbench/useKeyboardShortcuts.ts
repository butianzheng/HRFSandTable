import { useEffect } from 'react';

import type { InputRef } from 'antd';
import { message } from 'antd';
import type { Material } from '../../types/material';
import type { SchedulePlan } from '../../types/schedule';
import type { ScheduleRow } from './types';

export interface UseKeyboardShortcutsParams {
  activePanel: 'materials' | 'schedule';
  currentPlan: SchedulePlan | null;
  undoCount: number;
  redoCount: number;
  availableMaterials: Material[];
  scheduleItems: ScheduleRow[];
  selectedItemIds: number[];
  setSelectedMaterialIds: React.Dispatch<React.SetStateAction<number[]>>;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<number[]>>;
  setActivePanel: (v: 'materials' | 'schedule') => void;
  materialSearchRef: React.RefObject<InputRef | null>;
  handleUndo: () => Promise<void>;
  handleRedo: () => Promise<void>;
  handleSavePlan: () => Promise<void>;
  handleRefreshTemper: () => Promise<void>;
  handleLockItems: (locked: boolean) => Promise<void>;
  handleMoveItem: (itemId: number, direction: 'up' | 'down') => Promise<void>;
  handleRemoveItems: () => Promise<void>;
}

export function useKeyboardShortcuts(params: UseKeyboardShortcutsParams): void {
  const {
    activePanel,
    currentPlan,
    undoCount,
    redoCount,
    availableMaterials,
    scheduleItems,
    selectedItemIds,
    setSelectedMaterialIds,
    setSelectedItemIds,
    setActivePanel,
    materialSearchRef,
    handleUndo,
    handleRedo,
    handleSavePlan,
    handleRefreshTemper,
    handleLockItems,
    handleMoveItem,
    handleRemoveItems,
  } = params;

  useEffect(() => {
    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
      if (target.isContentEditable) return true;
      return Boolean(
        target.closest('.ant-input') ||
        target.closest('.ant-select') ||
        target.closest('.ant-picker')
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const typing = isTypingTarget(event.target);
      if (typing) return;

      if (event.ctrlKey && key === 'z') {
        event.preventDefault();
        if (currentPlan && undoCount > 0) void handleUndo();
        return;
      }
      if (event.ctrlKey && key === 'y') {
        event.preventDefault();
        if (currentPlan && redoCount > 0) void handleRedo();
        return;
      }
      if (event.ctrlKey && key === 's') {
        event.preventDefault();
        if (currentPlan && currentPlan.status !== 'confirmed') void handleSavePlan();
        return;
      }
      if (event.ctrlKey && key === 'f') {
        event.preventDefault();
        setActivePanel('materials');
        materialSearchRef.current?.focus();
        return;
      }
      if (event.key === 'F5') {
        event.preventDefault();
        void handleRefreshTemper();
        return;
      }
      if (event.ctrlKey && key === 'a') {
        event.preventDefault();
        if (activePanel === 'materials') {
          const readyIds = availableMaterials
            .filter(
              (m) =>
                (m.temp_status ?? 'waiting') === 'ready' && (m.status ?? 'pending') !== 'frozen'
            )
            .map((m) => m.id);
          setSelectedMaterialIds(readyIds);
        } else {
          setSelectedItemIds(scheduleItems.map((item) => item.id));
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        if (activePanel === 'materials') {
          setSelectedMaterialIds([]);
        } else {
          setSelectedItemIds([]);
        }
        return;
      }

      if (activePanel !== 'schedule') return;

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (selectedItemIds.length !== 1) {
          message.warning('请只选择一条排程记录再用方向键调整');
          return;
        }
        const direction = event.key === 'ArrowUp' ? 'up' : 'down';
        void handleMoveItem(selectedItemIds[0], direction);
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        if (selectedItemIds.length === 0) return;
        const selectedSet = new Set(selectedItemIds);
        const selectedRows = scheduleItems.filter((item) => selectedSet.has(item.id));
        const shouldUnlock =
          selectedRows.length > 0 && selectedRows.every((item) => item.is_locked === true);
        void handleLockItems(!shouldUnlock);
        return;
      }

      if (event.key === 'Delete') {
        event.preventDefault();
        if (selectedItemIds.length > 0) {
          void handleRemoveItems();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activePanel,
    availableMaterials,
    currentPlan,
    handleLockItems,
    handleMoveItem,
    handleRedo,
    handleRefreshTemper,
    handleRemoveItems,
    handleSavePlan,
    handleUndo,
    materialSearchRef,
    redoCount,
    scheduleItems,
    selectedItemIds,
    setActivePanel,
    setSelectedItemIds,
    setSelectedMaterialIds,
    undoCount,
  ]);
}

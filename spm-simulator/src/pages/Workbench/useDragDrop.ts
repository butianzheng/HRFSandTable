import { useState, useCallback } from 'react';
import { message } from 'antd';

import { scheduleApi } from '../../services/scheduleApi';
import type { SchedulePlan } from '../../types/schedule';
import { getErrorMessage } from '../../utils/error';
import type { ScheduleRow } from './types';

export interface UseDragDropParams {
  currentPlan: SchedulePlan | null;
  scheduleItems: ScheduleRow[];
  refreshAfterMutation: () => Promise<void>;
  setSelectedItemIds: React.Dispatch<React.SetStateAction<number[]>>;
}

export function useDragDrop(params: UseDragDropParams) {
  const { currentPlan, scheduleItems, refreshAfterMutation, setSelectedItemIds } = params;

  const [draggingScheduleItemId, setDraggingScheduleItemId] = useState<number | null>(null);
  const [dragOverScheduleItemId, setDragOverScheduleItemId] = useState<number | null>(null);
  const [dragOverSchedulePlacement, setDragOverSchedulePlacement] = useState<'above' | 'below'>(
    'below'
  );

  const handleDragDrop = useCallback(
    async (targetItemId: number, e: React.DragEvent) => {
      e.preventDefault();
      setDragOverScheduleItemId(null);
      setDraggingScheduleItemId(null);
      if (!currentPlan) return;
      const sourceId = Number(e.dataTransfer.getData('text/plain'));
      if (!Number.isFinite(sourceId) || sourceId <= 0) return;
      const sourceItem = scheduleItems.find((r) => r.id === sourceId);
      const targetItem = scheduleItems.find((r) => r.id === targetItemId);
      if (!sourceItem || !targetItem || sourceItem.is_locked || targetItem.is_locked) return;
      try {
        const beforeJson = JSON.stringify(scheduleItems.map((r) => r.id));
        await scheduleApi.moveScheduleItem(currentPlan.id, sourceId, targetItem.sequence);
        await scheduleApi.pushUndo(
          currentPlan.id,
          'move_item',
          beforeJson,
          JSON.stringify({ itemId: sourceId, newSeq: targetItem.sequence })
        );
        await refreshAfterMutation();
      } catch (error: unknown) {
        message.error(`移动失败: ${getErrorMessage(error)}`);
      }
    },
    [currentPlan, scheduleItems, refreshAfterMutation]
  );

  const handleDragStart = useCallback(
    (itemId: number, e: React.DragEvent) => {
      const item = scheduleItems.find((r) => r.id === itemId);
      if (item?.is_locked) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('text/plain', String(itemId));
      e.dataTransfer.effectAllowed = 'move';
      setDraggingScheduleItemId(itemId);
    },
    [scheduleItems]
  );

  const handleDragOver = useCallback((itemId: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOverScheduleItemId(itemId);
    setDragOverSchedulePlacement(e.clientY < rect.top + rect.height / 2 ? 'above' : 'below');
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverScheduleItemId(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingScheduleItemId(null);
    setDragOverScheduleItemId(null);
  }, []);

  const handleGanttClick = useCallback(
    (itemId: number, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setSelectedItemIds((prev) =>
          prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
        );
      } else {
        setSelectedItemIds([itemId]);
      }
    },
    [setSelectedItemIds]
  );

  return {
    draggingScheduleItemId,
    dragOverScheduleItemId,
    dragOverSchedulePlacement,
    handleDragStart,
    handleDragOver,
    handleDragDrop,
    handleDragLeave,
    handleDragEnd,
    handleGanttClick,
  };
}

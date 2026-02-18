import type { ScheduleItem } from '../../types/schedule';
import type { Material } from '../../types/material';
import type { PriorityHitMaterial } from '../../utils/priorityHit';
export type { DueBucket } from '../../constants/schedule';

// ─── ScheduleItem + Material 联合行 ───
export interface ScheduleRow extends ScheduleItem {
  material?: Material;
}

export interface PriorityHitChip {
  key: string;
  label: string;
  count: number;
  color?: string;
}

// ─── 甘特图分组模式 ───
export type GanttGroupBy = 'none' | 'date' | 'date+product' | 'date+grade';

export type PriorityHitWorkerMaterial = PriorityHitMaterial;

export interface PriorityHitWorkerResponse {
  id: number;
  counts: Array<[string, number]>;
}

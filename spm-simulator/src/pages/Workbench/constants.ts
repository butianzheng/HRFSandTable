export {
  planStatusColorMap as statusColorMap,
  planStatusLabelMap as statusLabelMap,
} from '../../constants/schedule';
export { deliveryCodeLabelMap, contractCodeLabelMap } from '../../constants/schedule';
export type { DueBucket } from '../../constants/schedule';

export const GANTT_ZOOM_STORAGE_KEY = 'spm.workbench.gantt_zoom';
export const GANTT_GROUP_BY_STORAGE_KEY = 'spm.workbench.gantt_group_by';
export const GANTT_GROUP_BY_OPTIONS = [
  { label: '不分组', value: 'none' },
  { label: '按日期', value: 'date' },
  { label: '日期+产品', value: 'date+product' },
  { label: '日期+钢种', value: 'date+grade' },
] as const;
export const PRIORITY_HIT_WORKER_THRESHOLD = 3000;

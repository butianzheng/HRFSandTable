/**
 * 材料状态常量
 * - 材料状态标签/颜色映射
 * - 适温状态标签/颜色映射
 * - 排程状态标签/颜色映射（方案级，派生）
 */

// ─── 材料状态 (pending / completed / frozen) ───
export const materialStatusLabelMap: Record<string, string> = {
  pending: '待排',
  completed: '完成',
  frozen: '冻结',
};
export const materialStatusColorMap: Record<string, string> = {
  pending: 'default',
  completed: 'success',
  frozen: 'warning',
};

// ─── 适温状态 (ready / waiting) ───
export const tempStatusLabelMap: Record<string, string> = {
  ready: '已适温',
  waiting: '等待中',
};
export const tempStatusColorMap: Record<string, string> = {
  ready: 'success',
  waiting: 'warning',
};

// ─── 排程状态（方案级，派生） ───
export const scheduleStatusLabelMap: Record<string, string> = {
  in_plan: '已排程',
  not_in_plan: '未排程',
};
export const scheduleStatusColorMap: Record<string, string> = {
  in_plan: 'processing',
  not_in_plan: 'default',
};

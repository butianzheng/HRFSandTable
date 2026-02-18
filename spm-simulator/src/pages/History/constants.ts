import type { ReactNode } from 'react';
import { createElement } from 'react';
import { PlusCircleOutlined, EditOutlined, DeleteOutlined, SyncOutlined } from '@ant-design/icons';

export const actionIconMap: Record<string, ReactNode> = {
  create: createElement(PlusCircleOutlined, { style: { color: '#52c41a' } }),
  update: createElement(EditOutlined, { style: { color: '#1677ff' } }),
  delete: createElement(DeleteOutlined, { style: { color: '#ff4d4f' } }),
  schedule: createElement(SyncOutlined, { style: { color: '#722ed1' } }),
  import: createElement(PlusCircleOutlined, { style: { color: '#13c2c2' } }),
};

export const actionLabelMap: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  schedule: '排程',
  import: '导入',
  export: '导出',
  export_logs: '导出日志',
  save: '保存',
  confirm: '确认',
  archive: '归档',
  auto_schedule: '自动排程',
  apply_risk_suggestion: '应用风险建议',
  add_material: '添加材料',
  remove_material: '移除材料',
  move_item: '调序',
  lock: '锁定',
  unlock: '解锁',
  update_shift_config: '更新班次配置',
  clear_logs: '清理日志',
  clean_history_plans: '清理历史方案',
  clear_undo_stack: '清理撤销栈',
  clean_materials: '清理材料',
  delete_backup: '删除备份',
  rollback_version: '版本回滚',
  export_history_report: '导出追溯报告',
  export_compare_sequence_csv: '导出顺序差异CSV',
  export_compare_sequence_excel: '导出顺序差异Excel',
  undo: '撤销',
  redo: '重做',
};

export const deltaColor = (v: number) => {
  if (v > 0) return '#52c41a';
  if (v < 0) return '#ff4d4f';
  return '#8c8c8c';
};

export const riskDeltaColor = (v: number) => {
  if (v > 0) return '#ff4d4f';
  if (v < 0) return '#52c41a';
  return '#8c8c8c';
};

export const sequenceMoveLabel = (delta: number) => {
  if (delta > 0) return `目标后移 +${delta}`;
  if (delta < 0) return `目标前移 ${Math.abs(delta)}`;
  return '无变化';
};

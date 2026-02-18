/**
 * 操作日志常量
 * - 操作类型标签映射
 */

export const actionLabelMap: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  schedule: '排程',
  import: '导入',
  save: '保存',
  confirm: '确认',
  archive: '归档',
  export: '导出',
  auto_schedule: '自动排程',
  add_material: '添加材料',
  remove_material: '移除材料',
  move_item: '调序',
  lock: '锁定',
  unlock: '解锁',
  apply_risk_suggestion: '应用风险建议',
  update_shift_config: '更新班次配置',
  clear_logs: '清理日志',
  clean_history_plans: '清理历史方案',
  clear_undo_stack: '清理撤销栈',
  clean_materials: '清理材料',
  delete_backup: '删除备份',
  rollback_version: '版本回滚',
  export_history_report: '导出追溯报告',
  export_logs: '导出日志',
  export_compare_sequence_csv: '导出顺序差异CSV',
  export_compare_sequence_excel: '导出顺序差异Excel',
  export_logs_excel: '导出日志Excel',
  undo: '撤销',
  redo: '重做',
};

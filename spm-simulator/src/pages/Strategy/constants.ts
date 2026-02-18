import type { TemperRules } from '../../types/config';

export const fieldLabels: Record<string, string> = {
  temp_status: '适温状态',
  width: '宽度',
  priority: '优先级',
  hardness_level: '硬度等级',
  thickness: '厚度',
  surface_level: '表面等级',
  product_type: '产品大类',
  storage_days: '库龄',
  steel_grade: '钢种',
};

export const evalLabels: Record<string, string> = {
  width_jump_count: '宽度跳跃次数',
  roll_change_count: '换辊次数',
  capacity_utilization: '产能利用率',
  tempered_ratio: '适温材料比例',
  urgent_completion: '紧急订单完成率',
};

export const seasonLabels: Record<string, string> = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
};

export const seasonOrder = ['spring', 'summer', 'autumn', 'winter'] as const;

export const createDefaultTemperRules = (): TemperRules => ({
  enabled: true,
  description: '按季节计算最小待温天数',
  seasons: {
    spring: { months: [3, 4, 5], min_days: 3, description: '春季待温规则' },
    summer: { months: [6, 7, 8], min_days: 4, description: '夏季待温规则' },
    autumn: { months: [9, 10, 11], min_days: 4, description: '秋季待温规则' },
    winter: { months: [12, 1, 2], min_days: 3, description: '冬季待温规则' },
  },
});

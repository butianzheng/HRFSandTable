-- 默认系统配置
INSERT OR IGNORE INTO system_config (config_group, config_key, config_value, value_type, description) VALUES
('temp', 'enabled', 'true', 'boolean', '是否启用适温筛选'),
('temp', 'spring_months', '3,4,5', 'string', '春季月份'),
('temp', 'summer_months', '6,7,8', 'string', '夏季月份'),
('temp', 'autumn_months', '9,10,11', 'string', '秋季月份'),
('temp', 'winter_months', '12,1,2', 'string', '冬季月份'),
('temp', 'spring_days', '3', 'number', '春季适温天数'),
('temp', 'summer_days', '4', 'number', '夏季适温天数'),
('temp', 'autumn_days', '4', 'number', '秋季适温天数'),
('temp', 'winter_days', '3', 'number', '冬季适温天数'),
('capacity', 'shift_capacity', '1200', 'number', '单班产能上限(吨)'),
('capacity', 'daily_target', '2400', 'number', '日产能目标(吨)'),
('capacity', 'avg_rhythm', '3.5', 'number', '平均轧制节奏(分钟/卷)'),
('shift', 'day_start', '08:00', 'string', '白班开始时间'),
('shift', 'day_end', '20:00', 'string', '白班结束时间'),
('shift', 'night_start', '20:00', 'string', '夜班开始时间'),
('shift', 'night_end', '08:00', 'string', '夜班结束时间'),
('scheduler', 'mode', 'hybrid', 'string', '排程模式: hybrid/beam/greedy'),
('scheduler', 'beam_width', '10', 'number', 'Beam宽度'),
('scheduler', 'beam_lookahead', '3', 'number', 'Beam前瞻步数'),
('scheduler', 'beam_top_k', '40', 'number', 'Beam候选截断数量'),
('scheduler', 'time_budget_ms', '120000', 'number', 'Beam求解时间预算(ms)'),
('scheduler', 'max_nodes', '200000', 'number', 'Beam最大扩展节点数'),
('scheduler', 'fallback_enabled', 'true', 'boolean', 'Beam超限后启用贪心兜底'),
('warning', 'capacity_yellow', '85', 'number', '产能利用率黄灯(%)'),
('warning', 'capacity_red', '70', 'number', '产能利用率红灯(%)'),
('warning', 'due_warn_days', '3', 'number', '交期预警天数'),
('warning', 'storage_warn_days', '7', 'number', '库龄预警天数'),
('warning', 'storage_critical_days', '14', 'number', '库龄严重预警天数'),
('undo', 'max_steps', '50', 'number', '最大撤销步数');

-- 清理已归并到策略配置的历史系统参数（幂等）
DELETE FROM system_config
WHERE (config_group = 'roll' AND config_key IN ('tonnage_threshold', 'change_duration', 'finish_last_coil'))
   OR (config_group = 'constraint' AND config_key IN ('max_width_jump', 'max_thickness_jump'));

-- 备份配置
INSERT OR IGNORE INTO system_config (config_group, config_key, config_value, value_type, description) VALUES
('backup', 'enabled', 'false', 'boolean', '是否启用自动备份（启动时检查）'),
('backup', 'period', 'daily', 'string', '自动备份周期：daily/weekly'),
('backup', 'path', '', 'string', '备份目录路径（留空使用默认路径）'),
('backup', 'keep_days', '30', 'number', '备份保留天数（<=0 表示不自动清理）');

-- 默认优先级权重配置
INSERT OR IGNORE INTO priority_weight_config (dimension_type, dimension_name, weight, sort_order, description) VALUES
('assessment', '合同考核', 1.0, 1, '考核/非考核'),
('delivery', '交期属性', 0.9, 2, 'D+0/D+7/前欠等'),
('contract', '合同属性', 0.5, 3, '出口/期货/现货等'),
('customer', '客户优先级', 0.6, 4, 'VIP/重点/普通'),
('batch', '集批优先级', 0.4, 5, '紧急/计划/普通'),
('product_type', '产品大类', 0.5, 6, '优先产品类别');

-- 默认交期属性维度
INSERT OR IGNORE INTO priority_dimension_config (dimension_type, dimension_code, dimension_name, score, sort_order, description) VALUES
('delivery', 'D+0', 'D+0', 1000, 1, '当天必交'),
('delivery', 'D+7', 'D+7', 900, 2, '7天内必交'),
('delivery', 'super_overdue', '超级前欠', 800, 3, '逾期超过30天'),
('delivery', 'double_overdue', '双前欠', 700, 4, '逾期超过60天'),
('delivery', 'overdue', '前欠', 600, 5, '已逾期'),
('delivery', 'current_period', '本期', 500, 6, '本月到期'),
('delivery', 'current_delayed', '本月延期', 400, 7, '本月延后'),
('delivery', 'next_period', '次月本期', 300, 8, '次月到期'),
('delivery', 'next_delayed', '次月延期', 200, 9, '次月延后'),
('delivery', 'no_requirement', '无要求', 0, 10, '无交期约束');

-- 默认合同属性维度
INSERT OR IGNORE INTO priority_dimension_config (dimension_type, dimension_code, dimension_name, score, sort_order, description) VALUES
('contract', 'export_contract', '出口合同', 100, 1, '出口订单合同'),
('contract', 'futures_contract', '期货合同', 90, 2, '期货合同'),
('contract', 'spot_contract', '现货合同', 80, 3, '现货合同'),
('contract', 'transition_contract', '过渡材合同', 70, 4, '过渡材料合同'),
('contract', 'other', '其他', 0, 5, '其他合同类型');

-- 默认策略模板
INSERT OR IGNORE INTO strategy_template (name, description, is_default, is_system, sort_weights, constraints, soft_constraints, eval_weights, temper_rules) VALUES
('标准排序策略', '系统默认排程策略模板', 1, 1,
'{"priorities":[{"field":"temp_status","order":"desc","weight":100,"enabled":true,"group":false,"description":"适温状态优先","sort_map":{"ready":1,"waiting":0},"is_prerequisite":true},{"field":"width","order":"desc","weight":95,"enabled":true,"group":true,"description":"宽度优先，宽→窄"},{"field":"priority","order":"desc","weight":90,"enabled":true,"group":false,"description":"人工干预优先级"},{"field":"hardness_level","order":"asc","weight":85,"enabled":true,"group":true,"description":"硬度等级，软→硬","sort_map":{"软":1,"中":2,"硬":3}},{"field":"thickness","order":"asc","weight":80,"enabled":true,"group":false,"description":"厚度"},{"field":"surface_level","order":"desc","weight":75,"enabled":true,"group":false,"description":"表面等级","sort_map":{"FA":4,"FB":3,"FC":2,"FD":1}},{"field":"product_type","order":"asc","weight":65,"enabled":true,"group":true,"description":"产品大类"},{"field":"storage_days","order":"desc","weight":60,"enabled":true,"group":false,"description":"库龄，久→新"},{"field":"steel_grade","order":"asc","weight":55,"enabled":true,"group":true,"description":"钢种"}]}',
'{"constraints":[{"type":"temp_status_filter","name":"适温材料筛选","enabled":true,"description":"只有适温材料才可进入排程队列"},{"type":"width_jump","name":"宽度跳跃限制","max_value":100,"unit":"mm","enabled":true,"error_message":"相邻材料宽度差超过{max_value}mm限制"},{"type":"roll_change_tonnage","name":"换辊吨位阈值","max_value":800,"unit":"吨","enabled":true,"finish_last_coil":true,"description":"达到阈值后当前卷完成后换辊"},{"type":"shift_capacity","name":"班次产能上限","max_value":1200,"unit":"吨","enabled":true},{"type":"roll_change_duration","name":"换辊时长","value":30,"unit":"分钟","enabled":true},{"type":"overdue_priority","name":"超期材料强制优先","max_days":0,"enabled":true,"description":"超期材料必须优先安排"}]}',
'{"constraints":[{"type":"steel_grade_switch","name":"钢种切换惩罚","penalty":10,"enabled":true},{"type":"thickness_jump","name":"厚度跳跃惩罚","threshold":1.0,"penalty":5,"unit":"mm","enabled":true},{"type":"surface_after_roll_change","name":"高表面等级换辊后优先","target_levels":["FA","FB"],"within_coils":5,"bonus":20,"enabled":true},{"type":"contract_grouping","name":"合同材料集中","bonus":10,"enabled":true}]}',
'{"weights":{"width_jump_count":{"weight":30,"description":"宽度跳跃次数"},"roll_change_count":{"weight":25,"description":"换辊次数"},"capacity_utilization":{"weight":20,"description":"产能利用率"},"tempered_ratio":{"weight":15,"description":"适温材料比例"},"urgent_completion":{"weight":10,"description":"紧急订单完成率"}}}',
'{"enabled":true,"description":"适温材料判定规则","seasons":{"spring":{"months":[3,4,5],"min_days":3,"description":"春季：3天及以上为适温"},"summer":{"months":[6,7,8],"min_days":4,"description":"夏季：4天及以上为适温"},"autumn":{"months":[9,10,11],"min_days":4,"description":"秋季：4天及以上为适温"},"winter":{"months":[12,1,2],"min_days":3,"description":"冬季：3天及以上为适温"}}}')

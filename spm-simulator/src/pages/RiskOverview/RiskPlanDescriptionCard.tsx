import { memo, useEffect, useMemo, useState } from 'react';
import { Card, Space, Tag, Typography } from 'antd';

import { configApi } from '../../services/configApi';
import type {
  StrategyTemplate,
  SortPriority,
  HardConstraint,
  SoftConstraint,
} from '../../types/config';
import type { RiskAnalysis, SchedulePlan } from '../../types/schedule';
import { planStatusColorMap, planStatusLabelMap } from '../../constants/schedule';
import { fieldLabels, evalLabels } from '../Strategy/constants';

const { Text } = Typography;

interface RiskPlanDescriptionCardProps {
  plan: SchedulePlan | null;
  analysis: RiskAnalysis | null;
}

type EvalWeightMap = Record<string, { weight?: number; description?: string }>;

function safeParse<T>(json: string | undefined, fallback: T): T {
  try {
    return JSON.parse(json || '') ?? fallback;
  } catch {
    return fallback;
  }
}

function formatHardConstraintValue(item: HardConstraint): string {
  if (typeof item.max_value === 'number') return `${item.max_value}${item.unit ?? ''}`;
  if (typeof item.value === 'number') return `${item.value}${item.unit ?? ''}`;
  if (typeof item.max_days === 'number') return `${item.max_days}天`;
  if (typeof item.finish_last_coil === 'boolean')
    return item.finish_last_coil ? '收尾保护' : '关闭';
  return '启用';
}

function formatSoftConstraintValue(item: SoftConstraint): string {
  const parts: string[] = [];
  if (typeof item.bonus === 'number' && item.bonus > 0) parts.push(`奖励+${item.bonus}`);
  if (typeof item.penalty === 'number' && item.penalty > 0) parts.push(`惩罚-${item.penalty}`);
  if (typeof item.threshold === 'number') parts.push(`阈值${item.threshold}${item.unit ?? ''}`);
  return parts.length > 0 ? parts.join(' / ') : '启用';
}

export default memo(function RiskPlanDescriptionCard({
  plan,
  analysis,
}: RiskPlanDescriptionCardProps) {
  const [strategyTemplates, setStrategyTemplates] = useState<StrategyTemplate[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadTemplates = async () => {
      try {
        const templates = await configApi.getStrategyTemplates();
        if (mounted) setStrategyTemplates(templates);
      } catch {
        if (mounted) setStrategyTemplates([]);
      }
    };
    void loadTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  const strategyId = plan?.strategy_id ?? null;
  const strategy = useMemo(() => {
    if (!strategyId) return null;
    return strategyTemplates.find((item) => item.id === strategyId) ?? null;
  }, [strategyId, strategyTemplates]);

  const enabledPriorities = useMemo(() => {
    if (!strategy) return [] as SortPriority[];
    const parsed = safeParse<{ priorities?: SortPriority[] }>(strategy.sort_weights, {
      priorities: [],
    });
    return (parsed.priorities ?? [])
      .filter((item) => item.enabled !== false)
      .sort((a, b) => b.weight - a.weight);
  }, [strategy]);

  const enabledHardConstraints = useMemo(() => {
    if (!strategy) return [] as HardConstraint[];
    const parsed = safeParse<{ constraints?: HardConstraint[] }>(strategy.constraints, {
      constraints: [],
    });
    return (parsed.constraints ?? []).filter((item) => item.enabled);
  }, [strategy]);

  const enabledSoftConstraints = useMemo(() => {
    if (!strategy) return [] as SoftConstraint[];
    const parsed = safeParse<{ constraints?: SoftConstraint[] }>(strategy.soft_constraints, {
      constraints: [],
    });
    return (parsed.constraints ?? []).filter((item) => item.enabled);
  }, [strategy]);

  const evalWeightEntries = useMemo(() => {
    if (!strategy) return [] as Array<{ key: string; weight: number }>;
    const parsed = safeParse<{ weights?: EvalWeightMap }>(strategy.eval_weights, { weights: {} });
    return Object.entries(parsed.weights ?? {})
      .map(([key, value]) => ({
        key,
        weight: typeof value?.weight === 'number' ? value.weight : 0,
      }))
      .sort((a, b) => b.weight - a.weight);
  }, [strategy]);

  const tendencyTags = useMemo(() => {
    const tags: string[] = [];
    const topPriority = enabledPriorities[0];
    const topEval = evalWeightEntries[0];
    if (topPriority) {
      const priorityMap: Record<string, string> = {
        temp_status: '适温排序优先',
        priority: '订单优先级优先',
        storage_days: '库龄优先',
        width: '宽度连续性优先',
        thickness: '厚度连续性优先',
        steel_grade: '钢种连续性优先',
      };
      if (priorityMap[topPriority.field]) tags.push(priorityMap[topPriority.field]);
      if (topPriority.group) tags.push('分组排序倾向明显');
    }
    if (topEval) {
      const evalMap: Record<string, string> = {
        urgent_completion: '交付导向',
        capacity_utilization: '产能导向',
        tempered_ratio: '适温安全导向',
        width_jump_count: '宽度稳定导向',
        roll_change_count: '少换辊导向',
      };
      if (evalMap[topEval.key]) tags.push(evalMap[topEval.key]);
    }
    if (enabledHardConstraints.some((item) => item.type === 'temp_status_filter')) {
      tags.push('适温约束偏严格');
    }
    if (enabledHardConstraints.some((item) => item.type === 'overdue_priority')) {
      tags.push('交期约束偏严格');
    }
    if (enabledSoftConstraints.some((item) => (item.bonus ?? 0) > (item.penalty ?? 0))) {
      tags.push('软约束激励驱动');
    }
    return Array.from(new Set(tags)).slice(0, 4);
  }, [enabledHardConstraints, enabledPriorities, enabledSoftConstraints, evalWeightEntries]);

  if (!plan) return null;

  const status = plan.status ? planStatusLabelMap[plan.status] || plan.status : '未标记';
  const statusColor = plan.status ? planStatusColorMap[plan.status] || 'default' : 'default';
  const strategyLabel = strategy
    ? strategy.name
    : plan.strategy_id
      ? `策略#${plan.strategy_id}`
      : '未绑定策略';

  return (
    <Card title="方案描述" size="small" style={{ marginBottom: 12 }}>
      <Space orientation="vertical" size={6} style={{ width: '100%' }}>
        <Text>
          当前方案 <Text strong>{plan.name}</Text>（{plan.plan_no}），周期 {plan.start_date} ~{' '}
          {plan.end_date}
        </Text>

        <Space wrap size={[8, 4]}>
          <Tag color={statusColor}>状态: {status}</Tag>
          {plan.score_overall != null && <Tag color="green">综合评分: {plan.score_overall}</Tag>}
          <Tag color="geekblue">{strategyLabel}</Tag>
          {analysis && (
            <Tag color="blue">
              风险高/中/低: {analysis.risk_high}/{analysis.risk_medium}/{analysis.risk_low}
            </Tag>
          )}
        </Space>

        {strategy?.description && <Text type="secondary">{strategy.description}</Text>}

        <div>
          <Text type="secondary">参数配置：</Text>
          <Space wrap size={[6, 6]} style={{ marginTop: 4 }}>
            {enabledPriorities.slice(0, 3).map((item) => (
              <Tag key={`sort-${item.field}`}>
                排序 {fieldLabels[item.field] || item.field} (
                {item.order === 'desc' ? '降序' : '升序'}·{item.weight})
              </Tag>
            ))}
            {enabledHardConstraints.slice(0, 2).map((item) => (
              <Tag key={`hard-${item.type}`}>
                约束 {item.name || item.type} {formatHardConstraintValue(item)}
              </Tag>
            ))}
            {enabledSoftConstraints.slice(0, 2).map((item) => (
              <Tag key={`soft-${item.type}`}>
                软约束 {item.name || item.type} {formatSoftConstraintValue(item)}
              </Tag>
            ))}
            {evalWeightEntries.slice(0, 2).map((item) => (
              <Tag key={`eval-${item.key}`}>
                评分 {evalLabels[item.key] || item.key} {item.weight}
              </Tag>
            ))}
            {strategy && enabledPriorities.length === 0 && enabledHardConstraints.length === 0 && (
              <Tag>未识别到可展示参数</Tag>
            )}
            {!strategy && <Tag>未读取到策略参数</Tag>}
          </Space>
        </div>

        <div>
          <Text type="secondary">策略倾向：</Text>
          <Space wrap size={[6, 6]} style={{ marginTop: 4 }}>
            {tendencyTags.map((item) => (
              <Tag key={item} color="gold">
                {item}
              </Tag>
            ))}
            {tendencyTags.length === 0 && <Tag>倾向待判定</Tag>}
          </Space>
        </div>
      </Space>
    </Card>
  );
});

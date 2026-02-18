import { memo } from 'react';
import { Card, Space, Select, Input, Button, Tag, Switch } from 'antd';

import type { SchedulePlan, RiskAnalysis } from '../../types/schedule';
import { constraintLabelMap, scoreColor } from '../../constants/schedule';

interface RiskToolbarProps {
  plans: SchedulePlan[];
  selectedPlanId: number | null;
  onPlanChange: (id: number | null) => void;
  forecastDays: number;
  onForecastDaysChange: (days: number) => void;
  riskSeverityFilter: 'all' | 'high' | 'medium' | 'low';
  onSeverityChange: (value: 'all' | 'high' | 'medium' | 'low') => void;
  riskConstraintFilter: string;
  riskConstraintOptions: string[];
  onConstraintChange: (value: string) => void;
  riskDueFilter: 'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none';
  onDueChange: (value: 'all' | 'overdue' | 'in3' | 'in7' | 'later' | 'none') => void;
  riskKeyword: string;
  onKeywordChange: (value: string) => void;
  applyingRiskBatch: boolean;
  highRiskFilteredCount: number;
  onApplyTopHighRisk: () => void;
  analysis: RiskAnalysis | null;
  showIgnored: boolean;
  onShowIgnoredChange: (value: boolean) => void;
  ignoredCount: number;
}

export default memo(function RiskToolbar({
  plans,
  selectedPlanId,
  onPlanChange,
  forecastDays,
  onForecastDaysChange,
  riskSeverityFilter,
  onSeverityChange,
  riskConstraintFilter,
  riskConstraintOptions,
  onConstraintChange,
  riskDueFilter,
  onDueChange,
  riskKeyword,
  onKeywordChange,
  applyingRiskBatch,
  highRiskFilteredCount,
  onApplyTopHighRisk,
  analysis,
  showIgnored,
  onShowIgnoredChange,
  ignoredCount,
}: RiskToolbarProps) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space wrap>
        <span style={{ fontWeight: 500 }}>选择方案:</span>
        <Select
          style={{ width: 320 }}
          value={selectedPlanId}
          onChange={(v) => onPlanChange(v)}
          placeholder="选择排程方案"
          options={plans.map((p) => ({
            value: p.id,
            label: `${p.name} (${p.plan_no}) ${p.score_overall != null ? `[${p.score_overall}分]` : ''}`,
          }))}
        />
        <span style={{ color: '#666' }}>预测天数:</span>
        <Select
          style={{ width: 120 }}
          value={forecastDays}
          onChange={onForecastDaysChange}
          options={[
            { value: 7, label: '7天' },
            { value: 14, label: '14天' },
            { value: 30, label: '30天' },
          ]}
        />
        <Select
          style={{ width: 110 }}
          value={riskSeverityFilter}
          onChange={onSeverityChange}
          options={[
            { value: 'all', label: '风险:全部' },
            { value: 'high', label: '仅高风险' },
            { value: 'medium', label: '仅中风险' },
            { value: 'low', label: '仅低风险' },
          ]}
        />
        <Select
          style={{ width: 150 }}
          value={riskConstraintFilter}
          onChange={onConstraintChange}
          options={[
            { value: 'all', label: '类型:全部' },
            ...riskConstraintOptions.map((item) => ({
              value: item,
              label: constraintLabelMap[item] || item,
            })),
          ]}
        />
        <Select
          style={{ width: 132 }}
          value={riskDueFilter}
          onChange={onDueChange}
          options={[
            { value: 'all', label: '交期:全部' },
            { value: 'overdue', label: '已超期' },
            { value: 'in3', label: '3天内' },
            { value: 'in7', label: '7天内' },
            { value: 'later', label: '7天后' },
            { value: 'none', label: '无交期' },
          ]}
        />
        <Input.Search
          allowClear
          style={{ width: 220 }}
          placeholder="筛选卷号/描述"
          value={riskKeyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
        <Button
          loading={applyingRiskBatch}
          disabled={!selectedPlanId || highRiskFilteredCount === 0}
          onClick={onApplyTopHighRisk}
        >
          一键处理高风险
        </Button>
        <Space size={4}>
          <Switch
            size="small"
            checked={showIgnored}
            onChange={onShowIgnoredChange}
          />
          <span style={{ fontSize: 12, color: '#666' }}>显示已忽略</span>
          {ignoredCount > 0 && (
            <Tag color="default" style={{ margin: 0 }}>
              {ignoredCount}项已忽略
            </Tag>
          )}
        </Space>
        {analysis && (
          <Tag
            color={
              scoreColor(analysis.score_overall) === '#52c41a'
                ? 'green'
                : scoreColor(analysis.score_overall) === '#faad14'
                  ? 'orange'
                  : 'red'
            }
          >
            {analysis.plan_name}
          </Tag>
        )}
      </Space>
    </Card>
  );
});

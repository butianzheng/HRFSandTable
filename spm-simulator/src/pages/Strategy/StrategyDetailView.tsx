import { memo } from 'react';
import { Card, Button, Tabs, Alert } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import type {
  StrategyTemplate,
  SortPriority,
  HardConstraint,
  SoftConstraint,
  TemperRules,
} from '../../types/config';
import type { EvalWeight } from './types';
import SortWeightsEditor from './SortWeightsEditor';
import HardConstraintsEditor from './HardConstraintsEditor';
import SoftConstraintsEditor from './SoftConstraintsEditor';
import EvalWeightsViewer from './EvalWeightsViewer';
import TemperRulesViewer from './TemperRulesViewer';

export interface StrategyDetailViewProps {
  selected: StrategyTemplate | null;
  sortWeights: SortPriority[];
  hardConstraints: HardConstraint[];
  softConstraints: SoftConstraint[];
  evalWeights: Record<string, EvalWeight>;
  temperRules: TemperRules | null;
  onEdit: (t: StrategyTemplate) => void;
}

export default memo(function StrategyDetailView({
  selected,
  sortWeights,
  hardConstraints,
  softConstraints,
  evalWeights,
  temperRules,
  onEdit,
}: StrategyDetailViewProps) {
  return (
    <Card
      title={selected ? `策略详情 — ${selected.name}` : '策略详情'}
      size="small"
      style={{ height: 'calc(100vh - 130px)', overflow: 'auto' }}
      extra={
        selected && !selected.is_system ? (
          <Button size="small" icon={<EditOutlined />} onClick={() => onEdit(selected)}>
            编辑
          </Button>
        ) : null
      }
    >
      {selected ? (
        <Tabs
          defaultActiveKey="sort"
          items={[
            {
              key: 'sort',
              label: '排序权重',
              children: <SortWeightsEditor value={sortWeights} onChange={() => {}} readOnly />,
            },
            {
              key: 'hard',
              label: '硬约束',
              children: (
                <HardConstraintsEditor value={hardConstraints} onChange={() => {}} readOnly />
              ),
            },
            {
              key: 'soft',
              label: '软约束',
              children: (
                <SoftConstraintsEditor value={softConstraints} onChange={() => {}} readOnly />
              ),
            },
            {
              key: 'eval',
              label: '评估权重',
              children: <EvalWeightsViewer evalWeights={evalWeights} />,
            },
            {
              key: 'temper',
              label: '适温规则',
              children: (
                <div>
                  <Alert
                    showIcon
                    type="info"
                    style={{ marginBottom: 8 }}
                    title="适温参数已归并到设置中心 > 适温参数，策略配置中仅展示。"
                  />
                  <TemperRulesViewer temperRules={temperRules} />
                </div>
              ),
            },
          ]}
        />
      ) : (
        <div style={{ color: '#999', textAlign: 'center', paddingTop: 80 }}>
          请从左侧选择一个策略模板查看详情
        </div>
      )}
    </Card>
  );
});

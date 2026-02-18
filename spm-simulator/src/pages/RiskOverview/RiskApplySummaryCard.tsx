import { memo } from 'react';
import { Card, Space, Tag, Button } from 'antd';

import { riskApplyReasonLabelMap } from '../../constants/schedule';
import type { RiskApplySummary } from './types';

interface RiskApplySummaryCardProps {
  summary: RiskApplySummary;
  riskApplyReasonFilter: string;
  onToggleApplyReasonFilter: (reasonCode: string) => void;
  onClearReasonFilter: () => void;
}

export default memo(function RiskApplySummaryCard({
  summary,
  riskApplyReasonFilter,
  onToggleApplyReasonFilter,
  onClearReasonFilter,
}: RiskApplySummaryCardProps) {
  return (
    <Card
      size="small"
      style={{ marginBottom: 12 }}
      title={`风险处理摘要（${summary.mode === 'batch' ? '批量' : '单条'}）`}
    >
      <Space wrap size={[8, 8]}>
        <Tag color="processing" style={{ margin: 0 }}>
          尝试 {summary.requested}
        </Tag>
        <Tag color={summary.changed > 0 ? 'success' : 'warning'} style={{ margin: 0 }}>
          生效 {summary.changed}
        </Tag>
        <Tag color="default" style={{ margin: 0 }}>
          时间 {summary.at.slice(0, 19).replace('T', ' ')}
        </Tag>
        <Tag color="blue" style={{ margin: 0 }}>
          高风险 {summary.before.high} → {summary.after.high}
        </Tag>
        <Tag color="gold" style={{ margin: 0 }}>
          中风险 {summary.before.medium} → {summary.after.medium}
        </Tag>
        <Tag color="cyan" style={{ margin: 0 }}>
          低风险 {summary.before.low} → {summary.after.low}
        </Tag>
        <Tag color="purple" style={{ margin: 0 }}>
          总违规 {summary.before.total} → {summary.after.total}
        </Tag>
      </Space>
      {Object.keys(summary.blockedReasons).length > 0 && (
        <Space wrap size={[6, 6]} style={{ marginTop: 8 }}>
          <Tag color="warning" style={{ margin: 0 }}>
            未生效原因
          </Tag>
          {Object.entries(summary.blockedReasons).map(([reasonCode, count]) => (
            <Tag
              key={reasonCode}
              color={riskApplyReasonFilter === reasonCode ? 'processing' : 'default'}
              style={{ margin: 0, cursor: 'pointer' }}
              onClick={() => onToggleApplyReasonFilter(reasonCode)}
            >
              {riskApplyReasonLabelMap[reasonCode] || reasonCode} {count}
            </Tag>
          ))}
          {riskApplyReasonFilter !== 'all' && (
            <Button type="link" size="small" onClick={onClearReasonFilter}>
              清除原因筛选
            </Button>
          )}
        </Space>
      )}
      {summary.notes.length > 0 && (
        <div style={{ marginTop: 8, color: '#595959', fontSize: 12 }}>
          {summary.notes.slice(0, 3).map((note, idx) => (
            <div key={`${idx}-${note}`}>
              {idx + 1}. {note}
            </div>
          ))}
          {summary.notes.length > 3 && <div>... 其余 {summary.notes.length - 3} 条已省略</div>}
        </div>
      )}
    </Card>
  );
});

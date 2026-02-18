import { useMemo } from 'react';
import { Card, Empty, Timeline, Space, Tag } from 'antd';
import dayjs from 'dayjs';
import type { PlanVersionItem } from '../../types/schedule';
import {
  planStatusLabelMap as statusLabelMap,
  planStatusColorMap as statusColorMap,
} from '../../constants/schedule';

interface VersionTimelineCardProps {
  versions: PlanVersionItem[];
  selectedPlanId: number | null;
  onSelectVersion: (planId: number) => void;
}

export default function VersionTimelineCard({
  versions,
  selectedPlanId,
  onSelectVersion,
}: VersionTimelineCardProps) {
  const timelineItems = useMemo(
    () =>
      versions.map((row) => ({
        color: row.plan_id === selectedPlanId ? 'blue' : 'gray',
        children: (
          <div onClick={() => onSelectVersion(row.plan_id)} style={{ cursor: 'pointer' }}>
            <Space size={6} wrap>
              <Tag
                color={row.plan_id === selectedPlanId ? 'blue' : 'default'}
                style={{ margin: 0 }}
              >
                {`v${row.version}${row.plan_id === selectedPlanId ? ' 当前' : ''}`}
              </Tag>
              <Tag color={statusColorMap[row.status] || 'default'} style={{ margin: 0 }}>
                {statusLabelMap[row.status] || row.status}
              </Tag>
              <span style={{ color: '#999', fontSize: 12 }}>
                {row.created_at ? dayjs(row.created_at).format('MM-DD HH:mm') : '-'}
              </span>
            </Space>
            <div style={{ color: '#595959', marginTop: 2 }}>
              {`${row.name} | 评分 ${row.score_overall} | 排程 ${row.total_count} | 风险 ${row.risk_high}/${row.risk_medium}/${row.risk_low}`}
            </div>
          </div>
        ),
      })),
    [selectedPlanId, versions, onSelectVersion]
  );

  return (
    <Card size="small" title="版本时间线" style={{ marginBottom: 12 }}>
      {timelineItems.length > 0 ? (
        <div style={{ maxHeight: 220, overflow: 'auto' }}>
          <Timeline items={timelineItems} />
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无版本时间线"
          style={{ padding: 8 }}
        />
      )}
    </Card>
  );
}

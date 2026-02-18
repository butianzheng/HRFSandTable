import { Row, Col, Statistic, Tag, Progress, Button, Popconfirm, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, MinusOutlined, CheckCircleOutlined, InboxOutlined } from '@ant-design/icons';
import type { PlanComparisonSide } from '../../types/schedule';
import {
  planStatusLabelMap as statusLabelMap,
  planStatusColorMap as statusColorMap,
  scoreColor,
} from '../../constants/schedule';

export function DiffValue({
  a,
  b,
  suffix,
  precision,
}: {
  a: number;
  b: number;
  suffix?: string;
  precision?: number;
}) {
  const diff = b - a;
  const formatted = precision != null ? diff.toFixed(precision) : String(diff);
  if (diff > 0) {
    return (
      <span style={{ color: '#52c41a', fontWeight: 500 }}>
        <ArrowUpOutlined /> +{formatted}
        {suffix}
      </span>
    );
  }
  if (diff < 0) {
    return (
      <span style={{ color: '#ff4d4f', fontWeight: 500 }}>
        <ArrowDownOutlined /> {formatted}
        {suffix}
      </span>
    );
  }
  return (
    <span style={{ color: '#999' }}>
      <MinusOutlined /> 0{suffix}
    </span>
  );
}

export function ScoreSideCard({
  side,
  recommended,
  reason,
  onConfirm,
  onArchive,
}: {
  side: PlanComparisonSide;
  recommended?: boolean;
  reason?: string;
  onConfirm?: (planId: number) => void;
  onArchive?: (planId: number) => void;
}) {
  const canConfirm = onConfirm && side.status !== 'confirmed' && side.status !== 'archived';
  const canArchive = onArchive && side.status === 'confirmed';

  return (
    <div style={{ textAlign: 'center' }}>
      <Progress
        type="circle"
        percent={side.score_overall}
        size={64}
        strokeColor={scoreColor(side.score_overall)}
        format={(p) => <span style={{ fontSize: 18, fontWeight: 700 }}>{p}</span>}
      />
      <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>{side.plan_name}</div>
      <Tag color={statusColorMap[side.status] || 'default'} style={{ marginTop: 4 }}>
        {statusLabelMap[side.status] || side.status}
      </Tag>
      {recommended && (
        <div style={{ marginTop: 6 }}>
          <Tag color="gold" style={{ margin: 0 }}>
            推荐方案
          </Tag>
        </div>
      )}
      {recommended && reason && (
        <div style={{ marginTop: 4, fontSize: 12, color: '#8c6d1f' }}>{reason}</div>
      )}
      <div style={{ marginTop: 8 }}>
        <Row gutter={4}>
          <Col span={8}>
            <Statistic
              title="序列"
              value={side.score_sequence}
              styles={{ content: { fontSize: 16, color: scoreColor(side.score_sequence) } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="交期"
              value={side.score_delivery}
              styles={{ content: { fontSize: 16, color: scoreColor(side.score_delivery) } }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="效率"
              value={side.score_efficiency}
              styles={{ content: { fontSize: 16, color: scoreColor(side.score_efficiency) } }}
            />
          </Col>
        </Row>
      </div>
      {(canConfirm || canArchive) && (
        <div style={{ marginTop: 10 }}>
          <Space size="small">
            {canConfirm && (
              <Popconfirm
                title="确认生效"
                description="方案确认后将不可编辑，是否继续？"
                onConfirm={() => onConfirm(side.plan_id)}
                okText="确认"
                cancelText="取消"
              >
                <Button size="small" type="primary" icon={<CheckCircleOutlined />}>
                  确认生效
                </Button>
              </Popconfirm>
            )}
            {canArchive && (
              <Popconfirm
                title="归档方案"
                description="归档后方案将标记为历史版本，是否继续？"
                onConfirm={() => onArchive(side.plan_id)}
                okText="确认"
                cancelText="取消"
              >
                <Button size="small" icon={<InboxOutlined />}>
                  归档
                </Button>
              </Popconfirm>
            )}
          </Space>
        </div>
      )}
    </div>
  );
}

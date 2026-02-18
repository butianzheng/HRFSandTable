import { Card, Row, Col, Statistic } from 'antd';
import type { SchedulePlan } from '../../types/schedule';
import { scoreColor } from '../../constants/schedule';

interface PlanOverviewCardProps {
  plan: SchedulePlan;
}

export default function PlanOverviewCard({ plan }: PlanOverviewCardProps) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Row gutter={8}>
        <Col span={6}>
          <Statistic
            title="综合评分"
            value={plan.score_overall || 0}
            styles={{ content: { color: scoreColor(plan.score_overall || 0), fontSize: 22 } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="版本"
            value={plan.version || 1}
            prefix="v"
            styles={{ content: { fontSize: 18 } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="排程数"
            value={plan.total_count || 0}
            suffix="块"
            styles={{ content: { fontSize: 18 } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="总重量"
            value={plan.total_weight || 0}
            precision={0}
            suffix="t"
            styles={{ content: { fontSize: 18 } }}
          />
        </Col>
      </Row>
    </Card>
  );
}

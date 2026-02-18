/**
 * 评分概览行 —— 综合评分 + 4 维子评分 + 统计数据
 */
import { memo } from 'react';
import { Card, Row, Col, Statistic, Progress } from 'antd';
import type { RiskAnalysis } from '../../types/schedule';
import { scoreColor } from '../../constants/schedule';

export interface RiskScoreOverviewProps {
  analysis: RiskAnalysis;
}

export default memo(function RiskScoreOverview({ analysis }: RiskScoreOverviewProps) {
  return (
    <Row gutter={12} style={{ marginBottom: 12 }}>
      <Col span={4}>
        <Card size="small" styles={{ body: { textAlign: 'center', padding: '12px 8px' } }}>
          <Progress
            type="circle"
            percent={analysis.score_overall}
            size={72}
            strokeColor={scoreColor(analysis.score_overall)}
            format={(p) => <span style={{ fontSize: 20, fontWeight: 700 }}>{p}</span>}
          />
          <div style={{ marginTop: 6, fontSize: 13, color: '#666' }}>综合评分</div>
        </Card>
      </Col>
      <Col span={5}>
        <Card size="small" styles={{ body: { padding: '12px' } }}>
          <Statistic
            title="序列合理性"
            value={analysis.score_sequence}
            suffix="/ 100"
            styles={{ content: { fontSize: 22, color: scoreColor(analysis.score_sequence) } }}
          />
          <Progress
            percent={analysis.score_sequence}
            size="small"
            showInfo={false}
            strokeColor={scoreColor(analysis.score_sequence)}
          />
        </Card>
      </Col>
      <Col span={5}>
        <Card size="small" styles={{ body: { padding: '12px' } }}>
          <Statistic
            title="交期满足度"
            value={analysis.score_delivery}
            suffix="/ 100"
            styles={{ content: { fontSize: 22, color: scoreColor(analysis.score_delivery) } }}
          />
          <Progress
            percent={analysis.score_delivery}
            size="small"
            showInfo={false}
            strokeColor={scoreColor(analysis.score_delivery)}
          />
        </Card>
      </Col>
      <Col span={5}>
        <Card size="small" styles={{ body: { padding: '12px' } }}>
          <Statistic
            title="产能效率"
            value={analysis.score_efficiency}
            suffix="/ 100"
            styles={{ content: { fontSize: 22, color: scoreColor(analysis.score_efficiency) } }}
          />
          <Progress
            percent={analysis.score_efficiency}
            size="small"
            showInfo={false}
            strokeColor={scoreColor(analysis.score_efficiency)}
          />
        </Card>
      </Col>
      <Col span={5}>
        <Card size="small" styles={{ body: { padding: '12px' } }}>
          <Row gutter={8}>
            <Col span={12}>
              <Statistic
                title="排程数"
                value={analysis.total_count}
                suffix="块"
                styles={{ content: { fontSize: 18 } }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="总重量"
                value={analysis.total_weight}
                precision={0}
                suffix="t"
                styles={{ content: { fontSize: 18 } }}
              />
            </Col>
          </Row>
          <Row gutter={8} style={{ marginTop: 4 }}>
            <Col span={12}>
              <Statistic
                title="换辊"
                value={analysis.roll_change_count}
                suffix="次"
                styles={{ content: { fontSize: 16 } }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="钢种切换"
                value={analysis.steel_grade_switches}
                suffix="次"
                styles={{ content: { fontSize: 16 } }}
              />
            </Col>
          </Row>
        </Card>
      </Col>
    </Row>
  );
});

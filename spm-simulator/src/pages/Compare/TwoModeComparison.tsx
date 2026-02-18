import { memo } from 'react';
import { Card, Row, Col, Button, Table, Badge, Space, Descriptions, Divider } from 'antd';
import type { TableColumnsType } from 'antd';
import { CheckCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import type * as EChartsCore from 'echarts/core';
import type { PlanComparisonResult, SequenceChangeItem } from '../../types/schedule';
import DeferredEChart from '../../components/DeferredEChart';
import { DiffValue, ScoreSideCard } from './constants';

export interface TwoModeComparisonProps {
  echarts: typeof EChartsCore;
  result: PlanComparisonResult;
  planAId: number | null;
  planBId: number | null;
  radarOption: unknown;
  metricsBarOption: unknown;
  twoModeRecommendation: { recommendedId: number; reason: string } | null;
  coilColumns: TableColumnsType<{ coil_id: string; source: string }>;
  coilData: { coil_id: string; source: string }[];
  sequenceChangeColumns: TableColumnsType<SequenceChangeItem>;
  sequenceChangeData: SequenceChangeItem[];
  sequenceAvgMove: string;
  exportingSequence: boolean;
  onExportSequence: (planA: number, planB: number, label: string, format: 'excel' | 'csv') => void;
  onConfirmPlan?: (planId: number) => void;
  onArchivePlan?: (planId: number) => void;
}

export default memo(function TwoModeComparison({
  echarts,
  result,
  planAId,
  planBId,
  radarOption,
  metricsBarOption,
  twoModeRecommendation,
  coilColumns,
  coilData,
  sequenceChangeColumns,
  sequenceChangeData,
  sequenceAvgMove,
  exportingSequence,
  onExportSequence,
  onConfirmPlan,
  onArchivePlan,
}: TwoModeComparisonProps) {
  const enableCoilVirtual = coilData.length >= 200;
  const enableSequenceVirtual = sequenceChangeData.length >= 200;

  return (
    <>
      {/* Score comparison */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={5}>
          <Card size="small" styles={{ body: { padding: 12 } }}>
            <ScoreSideCard
              side={result.plan_a}
              recommended={twoModeRecommendation?.recommendedId === result.plan_a.plan_id}
              reason={
                twoModeRecommendation?.recommendedId === result.plan_a.plan_id
                  ? twoModeRecommendation.reason
                  : undefined
              }
              onConfirm={onConfirmPlan}
              onArchive={onArchivePlan}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card size="small" styles={{ body: { padding: 12, textAlign: 'center' } }}>
            <div style={{ fontSize: 13, color: '#999', marginBottom: 8 }}>差值 (B - A)</div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#999' }}>综合</div>
              <DiffValue
                a={result.plan_a.score_overall}
                b={result.plan_b.score_overall}
                suffix="分"
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#999' }}>序列</div>
              <DiffValue
                a={result.plan_a.score_sequence}
                b={result.plan_b.score_sequence}
                suffix="分"
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#999' }}>交期</div>
              <DiffValue
                a={result.plan_a.score_delivery}
                b={result.plan_b.score_delivery}
                suffix="分"
              />
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#999' }}>效率</div>
              <DiffValue
                a={result.plan_a.score_efficiency}
                b={result.plan_b.score_efficiency}
                suffix="分"
              />
            </div>
          </Card>
        </Col>
        <Col span={5}>
          <Card size="small" styles={{ body: { padding: 12 } }}>
            <ScoreSideCard
              side={result.plan_b}
              recommended={twoModeRecommendation?.recommendedId === result.plan_b.plan_id}
              reason={
                twoModeRecommendation?.recommendedId === result.plan_b.plan_id
                  ? twoModeRecommendation.reason
                  : undefined
              }
              onConfirm={onConfirmPlan}
              onArchive={onArchivePlan}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="评分雷达对比" size="small" styles={{ body: { height: 240, padding: 4 } }}>
            <DeferredEChart echarts={echarts} option={radarOption} style={{ height: '100%' }} />
          </Card>
        </Col>
      </Row>

      {/* Metrics comparison */}
      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={14}>
          <Card title="关键指标对比" size="small" styles={{ body: { height: 260, padding: 4 } }}>
            <DeferredEChart
              echarts={echarts}
              option={metricsBarOption}
              style={{ height: '100%' }}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="指标差异明细" size="small" styles={{ body: { padding: '8px 16px' } }}>
            <Descriptions column={1} size="small" labelStyle={{ width: 110 }}>
              <Descriptions.Item label="排程数">
                <Space>
                  <span>{result.plan_a.total_count}</span>
                  <span style={{ color: '#999' }}>vs</span>
                  <span>{result.plan_b.total_count}</span>
                  <DiffValue
                    a={result.plan_a.total_count}
                    b={result.plan_b.total_count}
                    suffix="块"
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="总重量">
                <Space>
                  <span>{result.plan_a.total_weight.toFixed(1)}t</span>
                  <span style={{ color: '#999' }}>vs</span>
                  <span>{result.plan_b.total_weight.toFixed(1)}t</span>
                  <DiffValue
                    a={result.plan_a.total_weight}
                    b={result.plan_b.total_weight}
                    suffix="t"
                    precision={1}
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="换辊次数">
                <Space>
                  <span>{result.plan_a.roll_change_count}</span>
                  <span style={{ color: '#999' }}>vs</span>
                  <span>{result.plan_b.roll_change_count}</span>
                  <DiffValue
                    a={result.plan_a.roll_change_count}
                    b={result.plan_b.roll_change_count}
                    suffix="次"
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="钢种切换">
                <Space>
                  <span>{result.plan_a.steel_grade_switches}</span>
                  <span style={{ color: '#999' }}>vs</span>
                  <span>{result.plan_b.steel_grade_switches}</span>
                  <DiffValue
                    a={result.plan_a.steel_grade_switches}
                    b={result.plan_b.steel_grade_switches}
                    suffix="次"
                  />
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="高风险">
                <Space>
                  <span style={{ color: '#ff4d4f' }}>{result.plan_a.risk_high}</span>
                  <span style={{ color: '#999' }}>vs</span>
                  <span style={{ color: '#ff4d4f' }}>{result.plan_b.risk_high}</span>
                  <DiffValue a={result.plan_a.risk_high} b={result.plan_b.risk_high} />
                </Space>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* Material overlap */}
      <Row gutter={12}>
        <Col span={6}>
          <Card size="small" styles={{ body: { padding: 12, textAlign: 'center' } }}>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>材料重叠分析</div>
            <Row gutter={8}>
              <Col span={8}>
                <Badge color="#52c41a" text="共有" />
                <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>
                  {result.common_count}
                </div>
              </Col>
              <Col span={8}>
                <Badge color="#1677ff" text="仅A" />
                <div style={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}>
                  {result.only_a_count}
                </div>
              </Col>
              <Col span={8}>
                <Badge color="#ff4d4f" text="仅B" />
                <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>
                  {result.only_b_count}
                </div>
              </Col>
            </Row>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ fontSize: 12, color: '#999' }}>
              重叠率:{' '}
              {(
                (result.common_count /
                  Math.max(result.common_count + result.only_a_count + result.only_b_count, 1)) *
                100
              ).toFixed(1)}
              %
            </div>
          </Card>
        </Col>
        <Col span={18}>
          <Card
            title={
              <Space>
                <CheckCircleOutlined />
                <span>材料清单 ({coilData.length}卷)</span>
              </Space>
            }
            size="small"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              size="small"
              dataSource={coilData}
              columns={coilColumns}
              rowKey="coil_id"
              pagination={{ pageSize: 10, size: 'small' }}
              virtual={enableCoilVirtual}
              scroll={{ y: 280 }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Card
            title={
              <Space wrap>
                <span>{`顺序变化明细 (${sequenceChangeData.length}卷，平均位移 ${sequenceAvgMove})`}</span>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={exportingSequence}
                  disabled={!planAId || !planBId}
                  onClick={() => {
                    if (planAId && planBId)
                      void onExportSequence(planAId, planBId, `${planAId}_vs_${planBId}`, 'excel');
                  }}
                >
                  导出Excel
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={exportingSequence}
                  disabled={!planAId || !planBId}
                  onClick={() => {
                    if (planAId && planBId)
                      void onExportSequence(planAId, planBId, `${planAId}_vs_${planBId}`, 'csv');
                  }}
                >
                  导出CSV
                </Button>
              </Space>
            }
            size="small"
            styles={{ body: { padding: 0 } }}
          >
            <Table
              size="small"
              dataSource={sequenceChangeData}
              columns={sequenceChangeColumns}
              rowKey="coil_id"
              pagination={{ pageSize: 8, size: 'small' }}
              virtual={enableSequenceVirtual}
              scroll={{ x: 520, y: 260 }}
              locale={{ emptyText: '两方案共同材料顺序无变化' }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
});

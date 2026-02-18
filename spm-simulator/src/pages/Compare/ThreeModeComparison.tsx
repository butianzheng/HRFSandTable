import { memo } from 'react';
import { Card, Row, Col, Select, Button, Table, Space } from 'antd';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type * as EChartsCore from 'echarts/core';
import type { MultiPlanComparisonResult, SequenceChangeItem } from '../../types/schedule';
import type { ThreeModeSequencePair } from './types';
import DeferredEChart from '../../components/DeferredEChart';
import { ScoreSideCard } from './constants';

export interface ThreeModeComparisonProps {
  echarts: typeof EChartsCore;
  multiResult: MultiPlanComparisonResult;
  radarOptionMulti: unknown;
  metricsBarOptionMulti: unknown;
  threeModeRecommendation: { recommendedId: number; reason: string } | null;
  multiMetricRows: Record<string, string | number>[];
  multiMetricColumns: TableColumnsType<Record<string, string | number>>;
  overlapData: {
    key: string;
    plan_pair: string;
    common_count: number;
    only_a_count: number;
    only_b_count: number;
  }[];
  overlapColumns: TableColumnsType<{
    key: string;
    plan_pair: string;
    common_count: number;
    only_a_count: number;
    only_b_count: number;
  }>;
  threeModePairs: ThreeModeSequencePair[];
  selectedThreeModePair: ThreeModeSequencePair | null;
  selectedThreeModeAvgMove: string;
  threeModeSequenceColumns: TableColumnsType<SequenceChangeItem>;
  onThreeModePairKeyChange: (key: string) => void;
  exportingSequence: boolean;
  onExportSequence: (planA: number, planB: number, label: string, format: 'excel' | 'csv') => void;
  onConfirmPlan?: (planId: number) => void;
  onArchivePlan?: (planId: number) => void;
}

export default memo(function ThreeModeComparison({
  echarts,
  multiResult,
  radarOptionMulti,
  metricsBarOptionMulti,
  threeModeRecommendation,
  multiMetricRows,
  multiMetricColumns,
  overlapData,
  overlapColumns,
  threeModePairs,
  selectedThreeModePair,
  selectedThreeModeAvgMove,
  threeModeSequenceColumns,
  onThreeModePairKeyChange,
  exportingSequence,
  onExportSequence,
  onConfirmPlan,
  onArchivePlan,
}: ThreeModeComparisonProps) {
  const enableThreeModeSequenceVirtual = (selectedThreeModePair?.changes.length ?? 0) >= 200;

  return (
    <>
      <Row gutter={12} style={{ marginBottom: 12 }}>
        {multiResult.plans.map((side) => (
          <Col span={8} key={side.plan_id}>
            <Card size="small" styles={{ body: { padding: 12 } }}>
              <ScoreSideCard
                side={side}
                recommended={threeModeRecommendation?.recommendedId === side.plan_id}
                reason={
                  threeModeRecommendation?.recommendedId === side.plan_id
                    ? threeModeRecommendation.reason
                    : undefined
                }
                onConfirm={onConfirmPlan}
                onArchive={onArchivePlan}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={12} style={{ marginBottom: 12 }}>
        <Col span={12}>
          <Card
            title="评分雷达对比(三方案)"
            size="small"
            styles={{ body: { height: 280, padding: 4 } }}
          >
            <DeferredEChart
              echarts={echarts}
              option={radarOptionMulti}
              style={{ height: '100%' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="关键指标柱状对比(三方案)"
            size="small"
            styles={{ body: { height: 280, padding: 4 } }}
          >
            <DeferredEChart
              echarts={echarts}
              option={metricsBarOptionMulti}
              style={{ height: '100%' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={12}>
        <Col span={16}>
          <Card title="多方案指标明细" size="small" styles={{ body: { padding: 0 } }}>
            <Table
              size="small"
              rowKey="key"
              dataSource={multiMetricRows}
              columns={multiMetricColumns}
              pagination={false}
              scroll={{ x: 680, y: 300 }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card title="方案成对重叠统计" size="small" styles={{ body: { padding: 0 } }}>
            <Table
              size="small"
              rowKey="key"
              dataSource={overlapData}
              columns={overlapColumns}
              pagination={false}
              scroll={{ y: 300 }}
            />
          </Card>
        </Col>
      </Row>
      <Row gutter={12} style={{ marginTop: 12 }}>
        <Col span={24}>
          <Card
            title={
              <Space wrap>
                <span>成对顺序变化明细</span>
                <Select
                  size="small"
                  style={{ width: 360 }}
                  value={selectedThreeModePair?.key}
                  options={threeModePairs.map((item) => ({
                    value: item.key,
                    label: `${item.label} (${item.changes.length}卷)`,
                  }))}
                  onChange={(value) => onThreeModePairKeyChange(value)}
                />
                <span style={{ color: '#999', fontSize: 12 }}>
                  平均位移 {selectedThreeModeAvgMove}
                </span>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={exportingSequence}
                  disabled={!selectedThreeModePair}
                  onClick={() => {
                    if (!selectedThreeModePair) return;
                    void onExportSequence(
                      selectedThreeModePair.plan_a_id,
                      selectedThreeModePair.plan_b_id,
                      selectedThreeModePair.key.replace('-', '_vs_'),
                      'excel'
                    );
                  }}
                >
                  导出Excel
                </Button>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  loading={exportingSequence}
                  disabled={!selectedThreeModePair}
                  onClick={() => {
                    if (!selectedThreeModePair) return;
                    void onExportSequence(
                      selectedThreeModePair.plan_a_id,
                      selectedThreeModePair.plan_b_id,
                      selectedThreeModePair.key.replace('-', '_vs_'),
                      'csv'
                    );
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
              rowKey="coil_id"
              dataSource={selectedThreeModePair?.changes ?? []}
              columns={threeModeSequenceColumns}
              pagination={{ pageSize: 8, size: 'small' }}
              virtual={enableThreeModeSequenceVirtual}
              scroll={{ x: 620, y: 260 }}
              locale={{ emptyText: '该成对方案共同材料顺序无变化' }}
            />
          </Card>
        </Col>
      </Row>
    </>
  );
});

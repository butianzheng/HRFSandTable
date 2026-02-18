/**
 * 交期风险分布 + 待温预测趋势 + 预测明细
 */
import { memo } from 'react';
import { Card, Row, Col, Table, Empty, Tooltip, Button } from 'antd';
import type { TableColumnsType } from 'antd';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';

import type { RiskAnalysis, WaitingForecastItem } from '../../types/schedule';
import DeferredEChart from '../../components/DeferredEChart';

export interface WaitingForecastRowProps {
  analysis: RiskAnalysis;
  waitingForecast: WaitingForecastItem[];
  forecastDays: number;
  duePieOption: EChartsOption;
  duePieEvents: Record<string, (params: never) => void>;
  waitingForecastOption: EChartsOption;
  waitingForecastEvents: Record<string, (params: never) => void>;
  onViewDetail: (readyDate: string) => void;
}

export default memo(function WaitingForecastRow({
  analysis,
  waitingForecast,
  forecastDays,
  duePieOption,
  duePieEvents,
  waitingForecastOption,
  waitingForecastEvents,
  onViewDetail,
}: WaitingForecastRowProps) {
  const enableForecastVirtual = waitingForecast.length >= 200;

  const forecastColumns: TableColumnsType<WaitingForecastItem> = [
    { title: '日期', dataIndex: 'ready_date', width: 120 },
    { title: '卷数', dataIndex: 'count', width: 80, align: 'right' },
    {
      title: '预计重量',
      dataIndex: 'total_weight',
      width: 120,
      align: 'right',
      render: (v: number) => `${v.toFixed(1)} t`,
    },
    {
      title: '操作',
      key: 'action',
      width: 82,
      align: 'center',
      render: (_: unknown, row: WaitingForecastItem) => (
        <Button type="link" size="small" onClick={() => onViewDetail(row.ready_date)}>
          查看详情
        </Button>
      ),
    },
  ];

  const hasDueData =
    analysis.due_risk_distribution.overdue +
      analysis.due_risk_distribution.in3 +
      analysis.due_risk_distribution.in7 +
      analysis.due_risk_distribution.later >
    0;

  return (
    <Row gutter={12} style={{ marginBottom: 12 }}>
      <Col span={8}>
        <Card title="交期风险分布" size="small" styles={{ body: { height: 220, padding: 4 } }}>
          {hasDueData ? (
            <Tooltip title="点击扇区可联动筛选下方风险清单">
              <div style={{ height: '100%' }}>
                <DeferredEChart
                  echarts={echarts}
                  option={duePieOption}
                  style={{ height: '100%' }}
                  onEvents={duePieEvents}
                />
              </div>
            </Tooltip>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无交期数据" />
          )}
        </Card>
      </Col>
      <Col span={8}>
        <Card
          title={`未来${forecastDays}天待温转适温趋势`}
          size="small"
          styles={{ body: { height: 220, padding: 4 } }}
        >
          {waitingForecast.length > 0 ? (
            <Tooltip title="点击折线点位可查看对应日期明细并跳转工作台">
              <div style={{ height: '100%' }}>
                <DeferredEChart
                  echarts={echarts}
                  option={waitingForecastOption}
                  style={{ height: '100%' }}
                  onEvents={waitingForecastEvents}
                />
              </div>
            </Tooltip>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无预测数据" />
          )}
        </Card>
      </Col>
      <Col span={8}>
        <Card
          title={`待温预测明细 (${forecastDays}天)`}
          size="small"
          styles={{ body: { padding: 0 } }}
        >
          {waitingForecast.length > 0 ? (
            <Table
              size="small"
              rowKey="ready_date"
              dataSource={waitingForecast}
              columns={forecastColumns}
              pagination={false}
              virtual={enableForecastVirtual}
              scroll={{ y: 188 }}
            />
          ) : (
            <div style={{ padding: 28 }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无预测明细" />
            </div>
          )}
        </Card>
      </Col>
    </Row>
  );
});

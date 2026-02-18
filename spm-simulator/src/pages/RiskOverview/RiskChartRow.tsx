/**
 * 风险统计卡片 + 图表行 —— 高/中/低/逾期统计 + 风险饼图 + 适温饼图 + 班次柱状图
 */
import { memo } from 'react';
import { Card, Row, Col, Badge, Tooltip, Space, Empty } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';

import type { RiskAnalysis } from '../../types/schedule';
import DeferredEChart from '../../components/DeferredEChart';

export interface RiskChartRowProps {
  analysis: RiskAnalysis;
  riskSeverityFilter: 'all' | 'high' | 'medium' | 'low';
  riskDueFilter: string;
  toggleSeverityFilter: (target: 'high' | 'medium' | 'low') => void;
  toggleDueFilter: (target: 'overdue' | 'in3' | 'in7' | 'later') => void;
  riskPieOption: EChartsOption;
  riskPieEvents: Record<string, (params: never) => void>;
  tempPieOption: EChartsOption;
  shiftBarOption: EChartsOption;
}

export default memo(function RiskChartRow({
  analysis,
  riskSeverityFilter,
  riskDueFilter,
  toggleSeverityFilter,
  toggleDueFilter,
  riskPieOption,
  riskPieEvents,
  tempPieOption,
  shiftBarOption,
}: RiskChartRowProps) {
  return (
    <Row gutter={12} style={{ marginBottom: 12 }}>
      <Col span={4}>
        <Card size="small" styles={{ body: { padding: '12px' } }}>
          {(['high', 'medium', 'low'] as const).map((level) => {
            const colorMap = { high: '#ff4d4f', medium: '#faad14', low: '#1677ff' };
            const bgMap = { high: '#fff1f0', medium: '#fffbe6', low: '#e6f4ff' };
            const borderMap = { high: '#ffa39e', medium: '#ffe58f', low: '#91caff' };
            const labelMap = { high: '高风险', medium: '中风险', low: '低风险' };
            const countMap = {
              high: analysis.risk_high,
              medium: analysis.risk_medium,
              low: analysis.risk_low,
            };
            return (
              <div
                key={level}
                style={{
                  marginBottom: 8,
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: riskSeverityFilter === level ? bgMap[level] : undefined,
                  border:
                    riskSeverityFilter === level
                      ? `1px solid ${borderMap[level]}`
                      : '1px solid transparent',
                }}
                onClick={() => toggleSeverityFilter(level)}
              >
                <Badge
                  color={colorMap[level]}
                  text={<span style={{ fontSize: 13 }}>{labelMap[level]}</span>}
                />
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: colorMap[level], marginLeft: 14 }}
                >
                  {countMap[level]}
                </div>
              </div>
            );
          })}
          <div
            style={{
              padding: '4px 6px',
              borderRadius: 6,
              cursor: 'pointer',
              background: riskDueFilter === 'overdue' ? '#fff1f0' : undefined,
              border: riskDueFilter === 'overdue' ? '1px solid #ffa39e' : '1px solid transparent',
            }}
            onClick={() => toggleDueFilter('overdue')}
          >
            <Badge color="#d9d9d9" text={<span style={{ fontSize: 13 }}>逾期材料</span>} />
            <div style={{ fontSize: 24, fontWeight: 700, color: '#999', marginLeft: 14 }}>
              {analysis.overdue_count}
            </div>
          </div>
        </Card>
      </Col>
      <Col span={5}>
        <Card title="风险分布" size="small" styles={{ body: { height: 220, padding: 4 } }}>
          {analysis.risk_high + analysis.risk_medium + analysis.risk_low > 0 ? (
            <Tooltip title="点击扇区可联动筛选高/中/低风险">
              <div style={{ height: '100%' }}>
                <DeferredEChart
                  echarts={echarts}
                  option={riskPieOption}
                  style={{ height: '100%' }}
                  onEvents={riskPieEvents}
                />
              </div>
            </Tooltip>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
              }}
            >
              <Space direction="vertical" align="center">
                <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                <span style={{ color: '#52c41a' }}>无风险</span>
              </Space>
            </div>
          )}
        </Card>
      </Col>
      <Col span={5}>
        <Card title="适温分布" size="small" styles={{ body: { height: 220, padding: 4 } }}>
          <DeferredEChart echarts={echarts} option={tempPieOption} style={{ height: '100%' }} />
        </Card>
      </Col>
      <Col span={10}>
        <Card title="班次产能" size="small" styles={{ body: { height: 220, padding: 4 } }}>
          {analysis.shift_summary.length > 0 ? (
            <DeferredEChart echarts={echarts} option={shiftBarOption} style={{ height: '100%' }} />
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无班次数据" />
          )}
        </Card>
      </Col>
    </Row>
  );
});

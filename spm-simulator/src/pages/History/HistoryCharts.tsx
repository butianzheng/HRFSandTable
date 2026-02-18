import { useMemo, useCallback } from 'react';
import { Row, Col, Empty } from 'antd';
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { PlanVersionItem } from '../../types/schedule';
import DeferredEChart from '../../components/DeferredEChart';

echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

interface HistoryChartsProps {
  versions: PlanVersionItem[];
  onVersionClick: (planId: number) => void;
}

export default function HistoryCharts({ versions, onVersionClick }: HistoryChartsProps) {
  const versionLabels = useMemo(() => versions.map((row) => `v${row.version}`), [versions]);

  const handleChartPointClick = useCallback(
    (params: { dataIndex?: number }) => {
      const idx = params?.dataIndex;
      if (typeof idx !== 'number') return;
      const row = versions[idx];
      if (!row) return;
      onVersionClick(row.plan_id);
    },
    [versions, onVersionClick]
  );

  const scoreTrendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const },
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: versionLabels,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        min: 0,
        max: 100,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '综合评分',
          type: 'line',
          smooth: true,
          data: versions.map((row) => row.score_overall),
          itemStyle: { color: '#1677ff' },
          areaStyle: { color: 'rgba(22,119,255,0.14)' },
        },
      ],
    }),
    [versionLabels, versions]
  );

  const outputTrendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const },
      legend: {
        top: 0,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 44, right: 44, top: 30, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: versionLabels,
        axisLabel: { fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value' as const,
          name: '块数',
          minInterval: 1,
          axisLabel: { fontSize: 11 },
        },
        {
          type: 'value' as const,
          name: '吨位',
          axisLabel: {
            fontSize: 11,
            formatter: '{value}t',
          },
        },
      ],
      series: [
        {
          name: '排程块数',
          type: 'bar',
          barMaxWidth: 20,
          data: versions.map((row) => row.total_count),
          itemStyle: { color: '#13c2c2', borderRadius: [4, 4, 0, 0] },
        },
        {
          name: '总重量',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: versions.map((row) => Number(row.total_weight.toFixed(0))),
          itemStyle: { color: '#722ed1' },
        },
      ],
    }),
    [versionLabels, versions]
  );

  const rollTrendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const },
      grid: { left: 40, right: 16, top: 24, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: versionLabels,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        minInterval: 1,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '换辊次数',
          type: 'bar',
          barMaxWidth: 24,
          data: versions.map((row) => row.roll_change_count),
          itemStyle: { color: '#fa8c16', borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [versionLabels, versions]
  );

  const riskTrendOption = useMemo(
    () => ({
      tooltip: { trigger: 'axis' as const },
      legend: {
        top: 0,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 40, right: 16, top: 30, bottom: 28 },
      xAxis: {
        type: 'category' as const,
        data: versionLabels,
        axisLabel: { fontSize: 11 },
      },
      yAxis: {
        type: 'value' as const,
        minInterval: 1,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          name: '高风险',
          type: 'line',
          smooth: true,
          data: versions.map((row) => row.risk_high),
          itemStyle: { color: '#ff4d4f' },
        },
        {
          name: '中风险',
          type: 'line',
          smooth: true,
          data: versions.map((row) => row.risk_medium),
          itemStyle: { color: '#faad14' },
        },
        {
          name: '低风险',
          type: 'line',
          smooth: true,
          data: versions.map((row) => row.risk_low),
          itemStyle: { color: '#1677ff' },
        },
      ],
    }),
    [versionLabels, versions]
  );

  if (versions.length <= 1) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="至少需要2个版本才会生成统计趋势"
        style={{ padding: 8 }}
      />
    );
  }

  return (
    <Row gutter={[8, 8]}>
      <Col span={12}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
          排程量趋势（块数/吨位）
        </div>
        <DeferredEChart
          echarts={echarts}
          option={outputTrendOption}
          style={{ height: 190 }}
          onEvents={{ click: handleChartPointClick }}
          notMerge
          lazyUpdate
        />
      </Col>
      <Col span={12}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>综合评分趋势</div>
        <DeferredEChart
          echarts={echarts}
          option={scoreTrendOption}
          style={{ height: 190 }}
          onEvents={{ click: handleChartPointClick }}
          notMerge
          lazyUpdate
        />
      </Col>
      <Col span={12}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>换辊次数分布</div>
        <DeferredEChart
          echarts={echarts}
          option={rollTrendOption}
          style={{ height: 190 }}
          onEvents={{ click: handleChartPointClick }}
          notMerge
          lazyUpdate
        />
      </Col>
      <Col span={12}>
        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 4 }}>
          风险类型趋势（高/中/低）
        </div>
        <DeferredEChart
          echarts={echarts}
          option={riskTrendOption}
          style={{ height: 190 }}
          onEvents={{ click: handleChartPointClick }}
          notMerge
          lazyUpdate
        />
      </Col>
      <Col span={24}>
        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
          提示：点击图表数据点可快速切换到对应版本。
        </div>
      </Col>
    </Row>
  );
}

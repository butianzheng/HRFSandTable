import { useMemo } from 'react';
import type { EChartsOption } from 'echarts';

import type {
  RiskAnalysis,
  WidthJumpItem,
  ThicknessJumpItem,
  WaitingForecastItem,
} from '../../types/schedule';

export interface UseRiskChartsParams {
  analysis: RiskAnalysis | null;
  widthJumps?: WidthJumpItem[];
  thicknessJumps?: ThicknessJumpItem[];
  waitingForecast: WaitingForecastItem[];
  toggleSeverityFilter: (target: 'high' | 'medium' | 'low') => void;
  toggleDueFilter: (target: 'overdue' | 'in3' | 'in7' | 'later') => void;
  handleViewWaitingForecastDetail: (readyDate: string) => void;
  handleLocateWidthJump: (row: WidthJumpItem) => void;
  handleLocateThicknessJump: (row: ThicknessJumpItem) => void;
}

export function useRiskCharts({
  analysis,
  widthJumps,
  thicknessJumps,
  waitingForecast,
  toggleSeverityFilter,
  toggleDueFilter,
  handleViewWaitingForecastDetail,
  handleLocateWidthJump,
  handleLocateThicknessJump,
}: UseRiskChartsParams) {
  const chartWidthJumps = widthJumps ?? analysis?.width_jumps ?? [];
  const chartThicknessJumps = thicknessJumps ?? analysis?.thickness_jumps ?? [];

  // ─── ECharts: 温度分布饼图 ───
  const tempPieOption: EChartsOption = analysis
    ? {
        tooltip: { trigger: 'item' as const },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [
          {
            type: 'pie',
            radius: ['40%', '65%'],
            avoidLabelOverlap: true,
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}: {c}' },
            data: [
              {
                value: analysis.temp_distribution.ready,
                name: '适温',
                itemStyle: { color: '#52c41a' },
              },
              {
                value: analysis.temp_distribution.waiting,
                name: '待温',
                itemStyle: { color: '#faad14' },
              },
              {
                value: analysis.temp_distribution.unknown,
                name: '未知',
                itemStyle: { color: '#d9d9d9' },
              },
            ].filter((d) => d.value > 0),
          },
        ],
      }
    : ({} as EChartsOption);

  // ─── ECharts: 风险分布饼图 ───
  const riskPieOption: EChartsOption = analysis
    ? {
        tooltip: { trigger: 'item' as const },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [
          {
            type: 'pie',
            radius: ['40%', '65%'],
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}: {c}' },
            data: [
              { value: analysis.risk_high, name: '高风险', itemStyle: { color: '#ff4d4f' } },
              { value: analysis.risk_medium, name: '中风险', itemStyle: { color: '#faad14' } },
              { value: analysis.risk_low, name: '低风险', itemStyle: { color: '#1677ff' } },
            ].filter((d) => d.value > 0),
          },
        ],
      }
    : ({} as EChartsOption);

  // ─── ECharts: 交期风险分布饼图 ───
  const duePieOption: EChartsOption = analysis
    ? {
        tooltip: { trigger: 'item' as const },
        legend: { bottom: 0, textStyle: { fontSize: 11 } },
        series: [
          {
            type: 'pie',
            radius: ['40%', '65%'],
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { show: true, formatter: '{b}: {c}' },
            data: [
              {
                value: analysis.due_risk_distribution.overdue,
                name: '已超期',
                itemStyle: { color: '#ff4d4f' },
              },
              {
                value: analysis.due_risk_distribution.in3,
                name: '3天内',
                itemStyle: { color: '#faad14' },
              },
              {
                value: analysis.due_risk_distribution.in7,
                name: '7天内',
                itemStyle: { color: '#fadb14' },
              },
              {
                value: analysis.due_risk_distribution.later,
                name: '7天后',
                itemStyle: { color: '#52c41a' },
              },
            ].filter((d) => d.value > 0),
          },
        ],
      }
    : ({} as EChartsOption);

  // ─── ECharts: 班次产能柱状图 ───
  const shiftBarOption: EChartsOption =
    analysis && analysis.shift_summary.length > 0
      ? {
          tooltip: { trigger: 'axis' as const },
          grid: { left: 50, right: 20, top: 20, bottom: 40 },
          xAxis: {
            type: 'category' as const,
            data: analysis.shift_summary.map(
              (s) => `${s.shift_date.slice(5)} ${s.shift_type === 'day' ? '白' : '夜'}`
            ),
            axisLabel: { fontSize: 10, rotate: 30 },
          },
          yAxis: { type: 'value' as const, name: '重量(t)', nameTextStyle: { fontSize: 10 } },
          series: [
            {
              name: '产能',
              type: 'bar',
              data: analysis.shift_summary.map((s) => s.weight),
              itemStyle: { color: '#1677ff', borderRadius: [3, 3, 0, 0] },
              barMaxWidth: 30,
            },
          ],
        }
      : ({} as EChartsOption);

  // ─── ECharts: 宽度变化曲线 ───
  const widthLineOption: EChartsOption =
    chartWidthJumps.length > 0
      ? {
          tooltip: {
            trigger: 'axis' as const,
            formatter: (params: any) => {
              const points = Array.isArray(params) ? params : [params];
              const index =
                points.length > 0 && typeof points[0]?.dataIndex === 'number'
                  ? (points[0].dataIndex as number)
                  : -1;
              const jump = index >= 0 ? chartWidthJumps[index] : null;
              if (!jump) return '';
              const axisText = points[0]?.axisValueLabel ?? `#${jump.sequence}`;
              return [
                axisText,
                `宽度差: ${jump.width_diff.toFixed(0)} mm`,
                `换辊边界: ${jump.is_roll_change_boundary ? '是' : '否'}`,
              ].join('<br/>');
            },
          },
          grid: { left: 50, right: 20, top: 20, bottom: 30 },
          xAxis: {
            type: 'category' as const,
            data: chartWidthJumps.map((w) => `#${w.sequence}`),
            axisLabel: { fontSize: 10 },
          },
          yAxis: { type: 'value' as const, name: '宽度差(mm)', nameTextStyle: { fontSize: 10 } },
          series: [
            {
              name: '宽度差',
              type: 'bar',
              data: chartWidthJumps.map((w) => ({
                value: w.width_diff,
                itemStyle: { color: w.width_diff > 150 ? '#ff4d4f' : '#faad14' },
              })),
              barMaxWidth: 20,
            },
            {
              name: '换辊边界',
              type: 'scatter',
              data: chartWidthJumps.map((w) => (w.is_roll_change_boundary ? w.width_diff : null)),
              symbol: 'diamond',
              symbolSize: 10,
              itemStyle: { color: '#1677ff' },
              z: 5,
            },
          ],
        }
      : ({} as EChartsOption);

  // ─── ECharts: 厚度变化曲线 ───
  const thicknessLineOption: EChartsOption =
    chartThicknessJumps.length > 0
      ? {
          tooltip: {
            trigger: 'axis' as const,
            formatter: (params: any) => {
              const points = Array.isArray(params) ? params : [params];
              const index =
                points.length > 0 && typeof points[0]?.dataIndex === 'number'
                  ? (points[0].dataIndex as number)
                  : -1;
              const jump = index >= 0 ? chartThicknessJumps[index] : null;
              if (!jump) return '';
              const axisText = points[0]?.axisValueLabel ?? `#${jump.sequence}`;
              return [
                axisText,
                `厚度差: ${jump.thickness_diff.toFixed(2)} mm`,
                `换辊边界: ${jump.is_roll_change_boundary ? '是' : '否'}`,
              ].join('<br/>');
            },
          },
          grid: { left: 50, right: 20, top: 20, bottom: 30 },
          xAxis: {
            type: 'category' as const,
            data: chartThicknessJumps.map((w) => `#${w.sequence}`),
            axisLabel: { fontSize: 10 },
          },
          yAxis: { type: 'value' as const, name: '厚度差(mm)', nameTextStyle: { fontSize: 10 } },
          series: [
            {
              name: '厚度差',
              type: 'bar',
              data: chartThicknessJumps.map((w) => ({
                value: w.thickness_diff,
                itemStyle: { color: w.thickness_diff > 2 ? '#ff4d4f' : '#faad14' },
              })),
              barMaxWidth: 20,
            },
            {
              name: '换辊边界',
              type: 'scatter',
              data: chartThicknessJumps.map((w) =>
                w.is_roll_change_boundary ? w.thickness_diff : null
              ),
              symbol: 'diamond',
              symbolSize: 10,
              itemStyle: { color: '#1677ff' },
              z: 5,
            },
          ],
        }
      : ({} as EChartsOption);

  // ─── ECharts: 待温预测趋势 ───
  const waitingForecastOption: EChartsOption =
    waitingForecast.length > 0
      ? {
          tooltip: { trigger: 'axis' as const },
          grid: { left: 40, right: 20, top: 20, bottom: 30 },
          xAxis: {
            type: 'category' as const,
            data: waitingForecast.map((i) => i.ready_date.slice(5)),
            axisLabel: { fontSize: 10 },
          },
          yAxis: { type: 'value' as const, name: '卷数', nameTextStyle: { fontSize: 10 } },
          series: [
            {
              type: 'line',
              smooth: true,
              data: waitingForecast.map((i) => i.count),
              itemStyle: { color: '#1677ff' },
              areaStyle: { color: 'rgba(22,119,255,0.15)' },
            },
          ],
        }
      : ({} as EChartsOption);

  // ─── Chart events ───
  const riskPieEvents = useMemo(
    () => ({
      click: (params: { name?: string }) => {
        const name = params?.name;
        if (name === '高风险') {
          toggleSeverityFilter('high');
          return;
        }
        if (name === '中风险') {
          toggleSeverityFilter('medium');
          return;
        }
        if (name === '低风险') {
          toggleSeverityFilter('low');
        }
      },
    }),
    [toggleSeverityFilter]
  );

  const duePieEvents = useMemo(
    () => ({
      click: (params: { name?: string }) => {
        const name = params?.name;
        if (name === '已超期') {
          toggleDueFilter('overdue');
          return;
        }
        if (name === '3天内') {
          toggleDueFilter('in3');
          return;
        }
        if (name === '7天内') {
          toggleDueFilter('in7');
          return;
        }
        if (name === '7天后') {
          toggleDueFilter('later');
        }
      },
    }),
    [toggleDueFilter]
  );

  const waitingForecastEvents = useMemo(
    () => ({
      click: (params: { dataIndex?: number }) => {
        const idx = typeof params?.dataIndex === 'number' ? params.dataIndex : -1;
        if (idx < 0 || idx >= waitingForecast.length) return;
        handleViewWaitingForecastDetail(waitingForecast[idx].ready_date);
      },
    }),
    [handleViewWaitingForecastDetail, waitingForecast]
  );

  const widthJumpEvents = useMemo(
    () => ({
      click: (params: { dataIndex?: number }) => {
        const idx = typeof params?.dataIndex === 'number' ? params.dataIndex : -1;
        const target = idx >= 0 ? chartWidthJumps[idx] : undefined;
        if (!target) return;
        handleLocateWidthJump(target);
      },
    }),
    [chartWidthJumps, handleLocateWidthJump]
  );

  const thicknessJumpEvents = useMemo(
    () => ({
      click: (params: { dataIndex?: number }) => {
        const idx = typeof params?.dataIndex === 'number' ? params.dataIndex : -1;
        const target = idx >= 0 ? chartThicknessJumps[idx] : undefined;
        if (!target) return;
        handleLocateThicknessJump(target);
      },
    }),
    [chartThicknessJumps, handleLocateThicknessJump]
  );

  return {
    tempPieOption,
    riskPieOption,
    duePieOption,
    shiftBarOption,
    widthLineOption,
    thicknessLineOption,
    waitingForecastOption,
    riskPieEvents,
    duePieEvents,
    waitingForecastEvents,
    widthJumpEvents,
    thicknessJumpEvents,
  };
}

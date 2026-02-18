import { useMemo } from 'react';
import type { PlanComparisonResult, MultiPlanComparisonResult } from '../../types/schedule';

export interface UseCompareChartsParams {
  result: PlanComparisonResult | null;
  multiResult: MultiPlanComparisonResult | null;
}

export function useCompareCharts({ result, multiResult }: UseCompareChartsParams) {
  const radarOption = useMemo(
    () =>
      result
        ? {
            tooltip: {},
            legend: { bottom: 0, data: [result.plan_a.plan_name, result.plan_b.plan_name] },
            radar: {
              indicator: [
                { name: '综合评分', max: 100 },
                { name: '序列合理性', max: 100 },
                { name: '交期满足度', max: 100 },
                { name: '产能效率', max: 100 },
              ],
              radius: '60%',
            },
            series: [
              {
                type: 'radar',
                data: [
                  {
                    value: [
                      result.plan_a.score_overall,
                      result.plan_a.score_sequence,
                      result.plan_a.score_delivery,
                      result.plan_a.score_efficiency,
                    ],
                    name: result.plan_a.plan_name,
                    areaStyle: { opacity: 0.2 },
                    lineStyle: { color: '#1677ff' },
                    itemStyle: { color: '#1677ff' },
                  },
                  {
                    value: [
                      result.plan_b.score_overall,
                      result.plan_b.score_sequence,
                      result.plan_b.score_delivery,
                      result.plan_b.score_efficiency,
                    ],
                    name: result.plan_b.plan_name,
                    areaStyle: { opacity: 0.2 },
                    lineStyle: { color: '#ff4d4f' },
                    itemStyle: { color: '#ff4d4f' },
                  },
                ],
              },
            ],
          }
        : {},
    [result]
  );

  const radarOptionMulti = useMemo(
    () =>
      multiResult
        ? {
            tooltip: {},
            legend: { bottom: 0, data: multiResult.plans.map((p) => p.plan_name) },
            radar: {
              indicator: [
                { name: '综合评分', max: 100 },
                { name: '序列合理性', max: 100 },
                { name: '交期满足度', max: 100 },
                { name: '产能效率', max: 100 },
              ],
              radius: '60%',
            },
            series: [
              {
                type: 'radar',
                data: multiResult.plans.map((side, idx) => {
                  const palette = ['#1677ff', '#ff4d4f', '#52c41a'];
                  const color = palette[idx % palette.length];
                  return {
                    value: [
                      side.score_overall,
                      side.score_sequence,
                      side.score_delivery,
                      side.score_efficiency,
                    ],
                    name: side.plan_name,
                    areaStyle: { opacity: 0.2 },
                    lineStyle: { color },
                    itemStyle: { color },
                  };
                }),
              },
            ],
          }
        : {},
    [multiResult]
  );

  const metricsBarOption = useMemo(
    () =>
      result
        ? {
            tooltip: { trigger: 'axis' as const },
            legend: { bottom: 0, data: [result.plan_a.plan_name, result.plan_b.plan_name] },
            grid: { left: 60, right: 20, top: 20, bottom: 50 },
            xAxis: {
              type: 'category' as const,
              data: ['排程数', '总重量(t)', '换辊次数', '钢种切换', '高风险', '中风险', '低风险'],
              axisLabel: { fontSize: 10 },
            },
            yAxis: { type: 'value' as const },
            series: [
              {
                name: result.plan_a.plan_name,
                type: 'bar',
                data: [
                  result.plan_a.total_count,
                  result.plan_a.total_weight,
                  result.plan_a.roll_change_count,
                  result.plan_a.steel_grade_switches,
                  result.plan_a.risk_high,
                  result.plan_a.risk_medium,
                  result.plan_a.risk_low,
                ],
                itemStyle: { color: '#1677ff', borderRadius: [3, 3, 0, 0] },
                barMaxWidth: 24,
              },
              {
                name: result.plan_b.plan_name,
                type: 'bar',
                data: [
                  result.plan_b.total_count,
                  result.plan_b.total_weight,
                  result.plan_b.roll_change_count,
                  result.plan_b.steel_grade_switches,
                  result.plan_b.risk_high,
                  result.plan_b.risk_medium,
                  result.plan_b.risk_low,
                ],
                itemStyle: { color: '#ff4d4f', borderRadius: [3, 3, 0, 0] },
                barMaxWidth: 24,
              },
            ],
          }
        : {},
    [result]
  );

  const metricsBarOptionMulti = useMemo(
    () =>
      multiResult
        ? {
            tooltip: { trigger: 'axis' as const },
            legend: { bottom: 0, data: multiResult.plans.map((p) => p.plan_name) },
            grid: { left: 60, right: 20, top: 20, bottom: 50 },
            xAxis: {
              type: 'category' as const,
              data: ['排程数', '总重量(t)', '换辊次数', '钢种切换', '高风险', '中风险', '低风险'],
              axisLabel: { fontSize: 10 },
            },
            yAxis: { type: 'value' as const },
            series: multiResult.plans.map((side, idx) => {
              const palette = ['#1677ff', '#ff4d4f', '#52c41a'];
              return {
                name: side.plan_name,
                type: 'bar' as const,
                data: [
                  side.total_count,
                  side.total_weight,
                  side.roll_change_count,
                  side.steel_grade_switches,
                  side.risk_high,
                  side.risk_medium,
                  side.risk_low,
                ],
                itemStyle: { color: palette[idx % palette.length], borderRadius: [3, 3, 0, 0] },
                barMaxWidth: 20,
              };
            }),
          }
        : {},
    [multiResult]
  );

  return { radarOption, radarOptionMulti, metricsBarOption, metricsBarOptionMulti };
}

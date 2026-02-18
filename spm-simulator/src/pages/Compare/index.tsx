import { Card, Empty, Spin } from 'antd';
import * as echarts from 'echarts/core';
import { RadarChart, BarChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  RadarComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useCompareData } from './useCompareData';
import { useCompareCharts } from './useCompareCharts';
import ComparisonSelector from './ComparisonSelector';
import TwoModeComparison from './TwoModeComparison';
import ThreeModeComparison from './ThreeModeComparison';

echarts.use([
  RadarChart,
  BarChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  RadarComponent,
  CanvasRenderer,
]);

export default function Compare() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const d = useCompareData({ navigate, searchParams });
  const charts = useCompareCharts({ result: d.result, multiResult: d.multiResult });

  return (
    <div>
      <ComparisonSelector
        planAId={d.planAId}
        planBId={d.planBId}
        planCId={d.planCId}
        planOptions={d.planOptions}
        loading={d.loading}
        onPlanAChange={d.setPlanAId}
        onPlanBChange={d.setPlanBId}
        onPlanCChange={d.setPlanCId}
        onSwapAB={() => {
          const tmp = d.planAId;
          d.setPlanAId(d.planBId);
          d.setPlanBId(tmp);
        }}
        onCompare={d.handleCompare}
      />

      <Spin spinning={d.loading}>
        {d.isThreeMode ? (
          !d.multiResult ? (
            <Card>
              <Empty description="请选择三个不同方案进行对比" style={{ padding: 40 }} />
            </Card>
          ) : (
            <ThreeModeComparison
              echarts={echarts}
              multiResult={d.multiResult}
              radarOptionMulti={charts.radarOptionMulti}
              metricsBarOptionMulti={charts.metricsBarOptionMulti}
              threeModeRecommendation={d.threeModeRecommendation}
              multiMetricRows={d.multiMetricRows}
              multiMetricColumns={d.multiMetricColumns}
              overlapData={d.overlapData}
              overlapColumns={d.overlapColumns}
              threeModePairs={d.threeModePairs}
              selectedThreeModePair={d.selectedThreeModePair}
              selectedThreeModeAvgMove={d.selectedThreeModeAvgMove}
              threeModeSequenceColumns={d.threeModeSequenceColumns}
              onThreeModePairKeyChange={d.setThreeModePairKey}
              exportingSequence={d.exportingSequence}
              onExportSequence={d.handleExportSequence}
              onConfirmPlan={d.handleConfirmPlan}
              onArchivePlan={d.handleArchivePlan}
            />
          )
        ) : !d.result ? (
          <Card>
            <Empty description="请选择两个方案进行对比" style={{ padding: 40 }} />
          </Card>
        ) : (
          <TwoModeComparison
            echarts={echarts}
            result={d.result}
            planAId={d.planAId}
            planBId={d.planBId}
            radarOption={charts.radarOption}
            metricsBarOption={charts.metricsBarOption}
            twoModeRecommendation={d.twoModeRecommendation}
            coilColumns={d.coilColumns}
            coilData={d.coilData}
            sequenceChangeColumns={d.sequenceChangeColumns}
            sequenceChangeData={d.sequenceChangeData}
            sequenceAvgMove={d.sequenceAvgMove}
            exportingSequence={d.exportingSequence}
            onExportSequence={d.handleExportSequence}
            onConfirmPlan={d.handleConfirmPlan}
            onArchivePlan={d.handleArchivePlan}
          />
        )}
      </Spin>
    </div>
  );
}

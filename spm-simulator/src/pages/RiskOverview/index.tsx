import { useMemo, useRef, useState } from 'react';
import { Card, Row, Col, Empty, Spin } from 'antd';
import { useSearchParams, useNavigate } from 'react-router-dom';
import * as echarts from 'echarts/core';
import { PieChart, BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

import RiskScoreOverview from './RiskScoreOverview';
import RiskChartRow from './RiskChartRow';
import WidthJumpPanel from './WidthJumpPanel';
import ThicknessJumpPanel from './ThicknessJumpPanel';
import WaitingForecastRow from './WaitingForecastRow';
import RiskToolbar from './RiskToolbar';
import RiskApplySummaryCard from './RiskApplySummaryCard';
import RiskConfigHitCard from './RiskConfigHitCard';
import RiskPlanDescriptionCard from './RiskPlanDescriptionCard';
import RiskInventoryTable from './RiskInventoryTable';
import ViolationListPanel from './ViolationListPanel';
import { useRiskData } from './useRiskData';
import { useRiskCharts } from './useRiskCharts';

echarts.use([
  PieChart,
  BarChart,
  LineChart,
  ScatterChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  CanvasRenderer,
]);

export default function RiskOverview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const riskListCardRef = useRef<HTMLDivElement | null>(null);
  const [onlyNonRollWidthJumps, setOnlyNonRollWidthJumps] = useState(false);
  const [onlyNonRollThicknessJumps, setOnlyNonRollThicknessJumps] = useState(false);

  const d = useRiskData({ navigate, searchParams, riskListCardRef });
  const displayWidthJumps = useMemo(() => {
    const source = d.analysis?.width_jumps ?? [];
    if (!onlyNonRollWidthJumps) return source;
    return source.filter((item) => !item.is_roll_change_boundary);
  }, [d.analysis?.width_jumps, onlyNonRollWidthJumps]);
  const displayThicknessJumps = useMemo(() => {
    const source = d.analysis?.thickness_jumps ?? [];
    if (!onlyNonRollThicknessJumps) return source;
    return source.filter((item) => !item.is_roll_change_boundary);
  }, [d.analysis?.thickness_jumps, onlyNonRollThicknessJumps]);
  const selectedPlan = useMemo(
    () => d.plans.find((item) => item.id === d.selectedPlanId) ?? null,
    [d.plans, d.selectedPlanId]
  );

  const charts = useRiskCharts({
    analysis: d.analysis,
    widthJumps: displayWidthJumps,
    thicknessJumps: displayThicknessJumps,
    waitingForecast: d.waitingForecast,
    toggleSeverityFilter: d.toggleSeverityFilter,
    toggleDueFilter: d.toggleDueFilter,
    handleViewWaitingForecastDetail: d.handleViewWaitingForecastDetail,
    handleLocateWidthJump: d.handleLocateWidthJump,
    handleLocateThicknessJump: d.handleLocateThicknessJump,
  });

  return (
    <div>
      <RiskToolbar
        plans={d.plans}
        selectedPlanId={d.selectedPlanId}
        onPlanChange={d.setSelectedPlanId}
        forecastDays={d.forecastDays}
        onForecastDaysChange={d.setForecastDays}
        riskSeverityFilter={d.riskSeverityFilter}
        onSeverityChange={d.setRiskSeverityFilter}
        riskConstraintFilter={d.riskConstraintFilter}
        riskConstraintOptions={d.riskConstraintOptions}
        onConstraintChange={d.setRiskConstraintFilter}
        riskDueFilter={d.riskDueFilter}
        onDueChange={d.setRiskDueFilter}
        riskKeyword={d.riskKeyword}
        onKeywordChange={d.setRiskKeyword}
        applyingRiskBatch={d.applyingRiskBatch}
        highRiskFilteredCount={d.highRiskFilteredCount}
        onApplyTopHighRisk={d.handleApplyTopHighRiskSuggestions}
        analysis={d.analysis}
        showIgnored={d.showIgnored}
        onShowIgnoredChange={d.setShowIgnored}
        ignoredCount={d.ignoredCount}
      />

      <RiskPlanDescriptionCard plan={selectedPlan} analysis={d.analysis} />

      <RiskInventoryTable selectedPlanId={d.selectedPlanId} />

      <RiskConfigHitCard
        chips={d.riskConfigHitChips}
        riskConstraintFilter={d.riskConstraintFilter}
        riskDueFilter={d.riskDueFilter}
        onToggleFilter={d.toggleRiskConfigHitFilter}
        onResetFilters={d.resetRiskFilters}
      />

      {d.lastApplySummary && (
        <RiskApplySummaryCard
          summary={d.lastApplySummary}
          riskApplyReasonFilter={d.riskApplyReasonFilter}
          onToggleApplyReasonFilter={d.toggleApplyReasonFilter}
          onClearReasonFilter={() => d.setRiskApplyReasonFilter('all')}
        />
      )}

      <Spin spinning={d.loading}>
        {d.noData ? (
          <Card>
            <Empty description="请选择一个已完成排程的方案查看风险分析" style={{ padding: 40 }} />
          </Card>
        ) : (
          <>
            <RiskScoreOverview analysis={d.analysis!} />

            <RiskChartRow
              analysis={d.analysis!}
              riskSeverityFilter={d.riskSeverityFilter}
              riskDueFilter={d.riskDueFilter}
              toggleSeverityFilter={d.toggleSeverityFilter}
              toggleDueFilter={d.toggleDueFilter}
              riskPieOption={charts.riskPieOption}
              riskPieEvents={charts.riskPieEvents}
              tempPieOption={charts.tempPieOption}
              shiftBarOption={charts.shiftBarOption}
            />

            <WaitingForecastRow
              analysis={d.analysis!}
              waitingForecast={d.waitingForecast}
              forecastDays={d.forecastDays}
              duePieOption={charts.duePieOption}
              duePieEvents={charts.duePieEvents}
              waitingForecastOption={charts.waitingForecastOption}
              waitingForecastEvents={charts.waitingForecastEvents}
              onViewDetail={d.handleViewWaitingForecastDetail}
            />

            <Row gutter={12} style={{ marginBottom: 12 }}>
              <Col span={12}>
                <WidthJumpPanel
                  widthJumps={displayWidthJumps}
                  totalWidthJumpCount={d.analysis!.width_jumps.length}
                  onlyNonRollWidthJumps={onlyNonRollWidthJumps}
                  onOnlyNonRollWidthJumpsChange={setOnlyNonRollWidthJumps}
                  widthLineOption={charts.widthLineOption}
                  widthJumpEvents={charts.widthJumpEvents}
                  onLocate={d.handleLocateWidthJump}
                />
              </Col>
              <Col span={12}>
                <ThicknessJumpPanel
                  thicknessJumps={displayThicknessJumps}
                  totalThicknessJumpCount={(d.analysis!.thickness_jumps ?? []).length}
                  onlyNonRollThicknessJumps={onlyNonRollThicknessJumps}
                  onOnlyNonRollThicknessJumpsChange={setOnlyNonRollThicknessJumps}
                  thicknessLineOption={charts.thicknessLineOption}
                  thicknessJumpEvents={charts.thicknessJumpEvents}
                  onLocate={d.handleLocateThicknessJump}
                />
              </Col>
            </Row>

            <Row gutter={12}>
              <Col span={24}>
                <div ref={riskListCardRef}>
                  <ViolationListPanel
                    analysis={d.analysis!}
                    filteredViolations={d.filteredViolations}
                    columns={d.violationColumnsWithAction}
                    enableVirtual={d.enableRiskViolationVirtual}
                    activeFilterTags={d.activeRiskFilterTags}
                    onResetFilters={d.resetRiskFilters}
                    onLocateRisk={d.handleLocateRisk}
                  />
                </div>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}

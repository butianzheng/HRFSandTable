import { Card, Row, Col, Empty } from 'antd';

import { useHistoryData } from './useHistoryData';
import PlanSelectorToolbar from './PlanSelectorToolbar';
import PlanOverviewCard from './PlanOverviewCard';
import VersionTimelineCard from './VersionTimelineCard';
import HistoryCharts from './HistoryCharts';
import ExportReportModal from './ExportReportModal';
import ReportPreviewCard from './ReportPreviewCard';
import VersionHistoryTable from './VersionHistoryTable';
import OperationLogPanel from './OperationLogPanel';
import SequenceDiffPanel from './SequenceDiffPanel';
import RiskDiffPanel from './RiskDiffPanel';

export default function History() {
  const h = useHistoryData();

  return (
    <div>
      <PlanSelectorToolbar
        plans={h.plans}
        selectedPlanId={h.selectedPlanId}
        currentPlan={h.currentPlan}
        versions={h.versions}
        compareTargetPlanId={h.compareTargetPlanId}
        exportingReport={h.exportingReport}
        onPlanChange={h.setSelectedPlanId}
        onCompareVersions={h.handleCompareVersions}
        onOpenExportPreview={h.openExportPreview}
        onRefresh={() => {
          if (h.selectedPlanId) {
            h.loadVersions(h.selectedPlanId);
            h.loadLogs(h.selectedPlanId);
          }
        }}
      />

      <ExportReportModal
        open={h.exportPreviewOpen}
        currentPlan={h.currentPlan}
        reportVersionCount={h.reportVersionCount}
        reportDeltaCount={h.reportDeltaCount}
        reportLogsEstimate={h.reportLogsEstimate}
        reportEstimatedRows={h.reportEstimatedRows}
        loadingExportPreview={h.loadingExportPreview}
        exportingReport={h.exportingReport}
        exportLogsCapped={h.exportLogsCapped}
        onCancel={() => {
          if (!h.exportingReport && !h.loadingExportPreview) h.setExportPreviewOpen(false);
        }}
        onOk={h.handleExportHistoryReport}
      />

      {!h.selectedPlanId ? (
        <Card>
          <Empty description="请选择一个方案查看历史追溯" style={{ padding: 40 }} />
        </Card>
      ) : (
        <Row gutter={12}>
          {/* 左侧：版本历史 + 概览 */}
          <Col span={10}>
            {h.currentPlan && <PlanOverviewCard plan={h.currentPlan} />}

            <VersionTimelineCard
              versions={h.versions}
              selectedPlanId={h.selectedPlanId}
              onSelectVersion={h.setSelectedPlanId}
            />

            <ReportPreviewCard
              reportPreviewSummary={h.reportPreviewSummary}
              versionDeltaPreview={h.versionDeltaPreview}
            />

            <Card size="small" title="统计分析" style={{ marginBottom: 12 }}>
              <HistoryCharts
                versions={h.versions}
                onVersionClick={(planId) => h.setSelectedPlanId(planId)}
              />
            </Card>

            <SequenceDiffPanel
              selectedPlanId={h.selectedPlanId}
              compareTargetPlanId={h.compareTargetPlanId}
              selectedVersion={h.selectedVersion}
              compareTargetVersion={h.compareTargetVersion}
              sequenceDiffRows={h.sequenceDiffRows}
              filteredSequenceDiffRows={h.filteredSequenceDiffRows}
              sequenceDiffAvgMove={h.sequenceDiffAvgMove}
              sequenceMoveFilter={h.sequenceMoveFilter}
              sequenceMinDelta={h.sequenceMinDelta}
              loadingSequenceDiff={h.loadingSequenceDiff}
              exportingSequenceDiff={h.exportingSequenceDiff}
              onMoveFilterChange={h.setSequenceMoveFilter}
              onMinDeltaChange={h.setSequenceMinDelta}
              onExportSequenceDiff={h.handleExportSequenceDiff}
              onNavigate={h.navigate}
            />

            <RiskDiffPanel
              selectedPlanId={h.selectedPlanId}
              compareTargetPlanId={h.compareTargetPlanId}
              selectedVersion={h.selectedVersion}
              compareTargetVersion={h.compareTargetVersion}
              riskDiffRows={h.riskDiffRows}
              filteredRiskDiffRows={h.filteredRiskDiffRows}
              filteredRiskDiffCurrentTotal={h.filteredRiskDiffCurrentTotal}
              filteredRiskDiffTargetTotal={h.filteredRiskDiffTargetTotal}
              filteredRiskDiffDeltaTotal={h.filteredRiskDiffDeltaTotal}
              riskTrendFilter={h.riskTrendFilter}
              riskMinDelta={h.riskMinDelta}
              loadingRiskDiff={h.loadingRiskDiff}
              onTrendFilterChange={h.setRiskTrendFilter}
              onMinDeltaChange={h.setRiskMinDelta}
              onNavigate={h.navigate}
            />

            <VersionHistoryTable
              versions={h.versions}
              selectedPlanId={h.selectedPlanId}
              compareTargetPlanId={h.compareTargetPlanId}
              rollbackingId={h.rollbackingId}
              loadingVersions={h.loadingVersions}
              onSelectPlan={h.setSelectedPlanId}
              onSetCompareTarget={h.setCompareTargetPlanId}
              onRollback={h.handleRollback}
            />
          </Col>

          {/* 右侧：操作日志 */}
          <Col span={14}>
            <OperationLogPanel logs={h.logs} loadingLogs={h.loadingLogs} />
          </Col>
        </Row>
      )}
    </div>
  );
}

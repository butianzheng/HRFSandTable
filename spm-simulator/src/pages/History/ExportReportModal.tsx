import { memo } from 'react';
import { Modal, Space, Tag } from 'antd';

import type { SchedulePlan } from '../../types/schedule';

interface ExportReportModalProps {
  open: boolean;
  currentPlan: SchedulePlan | null;
  reportVersionCount: number;
  reportDeltaCount: number;
  reportLogsEstimate: number;
  reportEstimatedRows: number;
  loadingExportPreview: boolean;
  exportingReport: boolean;
  exportLogsCapped: boolean;
  onCancel: () => void;
  onOk: () => void;
}

export default memo(function ExportReportModal({
  open,
  currentPlan,
  reportVersionCount,
  reportDeltaCount,
  reportLogsEstimate,
  reportEstimatedRows,
  loadingExportPreview,
  exportingReport,
  exportLogsCapped,
  onCancel,
  onOk,
}: ExportReportModalProps) {
  return (
    <Modal
      title="确认导出追溯报告"
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={exportingReport}
      okText="选择路径并导出"
      cancelText="取消"
      okButtonProps={{ disabled: loadingExportPreview }}
      destroyOnHidden
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <strong>当前方案：</strong>
          {currentPlan ? `${currentPlan.name} (${currentPlan.plan_no})` : '-'}
        </div>
        <Space size={[8, 8]} wrap>
          <Tag color="blue">versions: {reportVersionCount}</Tag>
          <Tag color="cyan">version_stats: {reportVersionCount}</Tag>
          <Tag color="purple">version_delta: {reportDeltaCount}</Tag>
          <Tag color="magenta">sequence_diff: 动态生成</Tag>
          <Tag color="gold">risk_diff: 动态生成</Tag>
          <Tag color="green">
            {`logs${loadingExportPreview ? '(查询中)' : exportLogsCapped ? '(已触顶)' : ''}: ${loadingExportPreview ? '...' : reportLogsEstimate}`}
          </Tag>
        </Space>
        <div style={{ color: '#595959' }}>
          预计导出记录：<strong>{reportEstimatedRows}</strong>
        </div>
        <div style={{ color: '#8c8c8c', fontSize: 12 }}>
          说明：打开弹窗时会实时查询日志条数，后端导出日志上限 2000 条；`sequence_diff/risk_diff`
          行数由版本差异动态生成。
        </div>
      </Space>
    </Modal>
  );
});

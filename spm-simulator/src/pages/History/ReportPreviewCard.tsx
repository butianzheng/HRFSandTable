import { memo, useMemo } from 'react';
import { Card, Row, Col, Statistic, Space, Tag, Table, Empty } from 'antd';
import type { TableColumnsType } from 'antd';

import type { VersionDeltaPreviewItem } from './useHistoryData';
import { deltaColor } from './constants';

interface ReportPreviewCardProps {
  reportPreviewSummary: {
    versionCount: number;
    deltaCount: number;
    estimateRows: number;
    scoreTrend: number;
  };
  versionDeltaPreview: VersionDeltaPreviewItem[];
}

export default memo(function ReportPreviewCard({
  reportPreviewSummary,
  versionDeltaPreview,
}: ReportPreviewCardProps) {
  const deltaPreviewColumns = useMemo<TableColumnsType<VersionDeltaPreviewItem>>(
    () => [
      {
        title: '版本变更',
        width: 94,
        render: (_: unknown, row: VersionDeltaPreviewItem) => (
          <span>{`v${row.fromVersion} -> v${row.toVersion}`}</span>
        ),
      },
      {
        title: '评分Δ',
        dataIndex: 'scoreDelta',
        width: 68,
        align: 'right',
        render: (v: number) => (
          <span style={{ color: deltaColor(v), fontWeight: 600 }}>{v > 0 ? `+${v}` : v}</span>
        ),
      },
      {
        title: '排程Δ',
        dataIndex: 'totalCountDelta',
        width: 68,
        align: 'right',
        render: (v: number) => <span style={{ color: deltaColor(v) }}>{v > 0 ? `+${v}` : v}</span>,
      },
      {
        title: '重量Δ',
        dataIndex: 'totalWeightDelta',
        width: 86,
        align: 'right',
        render: (v: number) => (
          <span style={{ color: deltaColor(v) }}>{`${v > 0 ? '+' : ''}${v.toFixed(0)}t`}</span>
        ),
      },
      {
        title: '换辊Δ',
        dataIndex: 'rollChangeDelta',
        width: 68,
        align: 'right',
        render: (v: number) => <span style={{ color: deltaColor(v) }}>{v > 0 ? `+${v}` : v}</span>,
      },
      {
        title: '风险高/中/低Δ',
        width: 120,
        align: 'right',
        render: (_: unknown, row: VersionDeltaPreviewItem) => (
          <span
            style={{
              color: deltaColor(row.riskHighDelta + row.riskMediumDelta + row.riskLowDelta),
            }}
          >
            {`${row.riskHighDelta > 0 ? '+' : ''}${row.riskHighDelta}/`}
            {`${row.riskMediumDelta > 0 ? '+' : ''}${row.riskMediumDelta}/`}
            {`${row.riskLowDelta > 0 ? '+' : ''}${row.riskLowDelta}`}
          </span>
        ),
      },
    ],
    []
  );

  return (
    <Card size="small" title="报告摘要预览" style={{ marginBottom: 12 }}>
      <Row gutter={8} style={{ marginBottom: 8 }}>
        <Col span={6}>
          <Statistic
            title="版本数"
            value={reportPreviewSummary.versionCount}
            styles={{ content: { fontSize: 16 } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="变更段"
            value={reportPreviewSummary.deltaCount}
            styles={{ content: { fontSize: 16 } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="预计记录数"
            value={reportPreviewSummary.estimateRows}
            styles={{ content: { fontSize: 16 } }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="评分趋势"
            value={reportPreviewSummary.scoreTrend}
            styles={{
              content: { color: deltaColor(reportPreviewSummary.scoreTrend), fontSize: 16 },
            }}
            formatter={(value) => (Number(value) > 0 ? `+${value}` : value)}
          />
        </Col>
      </Row>
      <Space size={[6, 6]} wrap style={{ marginBottom: 8 }}>
        <Tag color="blue">versions</Tag>
        <Tag color="cyan">version_stats</Tag>
        <Tag color="purple">version_delta</Tag>
        <Tag color="magenta">sequence_diff</Tag>
        <Tag color="gold">risk_diff</Tag>
        <Tag color="green">logs</Tag>
      </Space>
      <div style={{ marginBottom: 8, color: '#8c8c8c', fontSize: 12 }}>
        预计记录数按当前加载日志估算；导出时日志上限为 2000 条。
      </div>
      {versionDeltaPreview.length > 0 ? (
        <Table
          size="small"
          rowKey="key"
          pagination={false}
          dataSource={versionDeltaPreview}
          columns={deltaPreviewColumns}
          scroll={{ y: 160, x: 520 }}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="至少需要2个版本才会生成版本差异"
          style={{ padding: 8 }}
        />
      )}
    </Card>
  );
});

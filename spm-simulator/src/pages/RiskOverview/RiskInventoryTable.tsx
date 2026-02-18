import { memo, useMemo } from 'react';
import { Card, Empty, Segmented, Space, Spin, Table, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';

import { useRiskInventory, stockBucketLabelMap, type InventoryColorMode } from './useRiskInventory';
import type { InventoryMetric, InventoryRow, StockBucketKey } from './useRiskInventory';

const { Text } = Typography;

interface RiskInventoryTableProps {
  selectedPlanId: number | null;
}

function formatWeight(weight: number): string {
  if (!Number.isFinite(weight) || weight <= 0) return '0';
  return weight >= 100 ? weight.toFixed(0) : weight.toFixed(1);
}

function toPercent(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0%';
  return `${(value * 100).toFixed(1)}%`;
}

function hexToRgba(hex: string, alpha: number): string {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return `rgba(22, 119, 255, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function renderCell(metric: InventoryMetric, row: InventoryRow, bucketLabel: string) {
  if (metric.totalCount === 0) return <span style={{ color: '#bfbfbf' }}>-</span>;

  const scheduledWeightRatio =
    metric.totalWeight > 0 ? metric.scheduledWeight / metric.totalWeight : 0;
  const scheduledCountRatio = metric.totalCount > 0 ? metric.scheduledCount / metric.totalCount : 0;
  const bg = row.isTotal
    ? '#fafafa'
    : hexToRgba(row.color || '#1677ff', 0.08 + 0.3 * Math.min(1, scheduledWeightRatio));

  return (
    <Tooltip
      title={
        <Space orientation="vertical" size={1}>
          <span>
            {row.label} · {bucketLabel}
          </span>
          <span>
            总量：{formatWeight(metric.totalWeight)}t / {metric.totalCount}卷
          </span>
          <span>
            已排：{formatWeight(metric.scheduledWeight)}t / {metric.scheduledCount}卷
          </span>
          <span>
            未排：{formatWeight(metric.totalWeight - metric.scheduledWeight)}t /{' '}
            {metric.totalCount - metric.scheduledCount}卷
          </span>
          <span>
            占比：重量 {toPercent(scheduledWeightRatio)} / 数量 {toPercent(scheduledCountRatio)}
          </span>
        </Space>
      }
    >
      <div
        style={{
          background: bg,
          borderRadius: 6,
          padding: '4px 6px',
          minHeight: 46,
          border: row.isTotal ? '1px solid #f0f0f0' : '1px solid transparent',
        }}
      >
        <div style={{ fontWeight: 600 }}>
          {formatWeight(metric.totalWeight)}t / {metric.totalCount}
        </div>
        <div style={{ fontSize: 12, color: '#595959' }}>
          已排 {toPercent(scheduledWeightRatio)}重 / {toPercent(scheduledCountRatio)}数
        </div>
      </div>
    </Tooltip>
  );
}

export default memo(function RiskInventoryTable({ selectedPlanId }: RiskInventoryTableProps) {
  const inv = useRiskInventory(selectedPlanId);

  const columns = useMemo<TableColumnsType<InventoryRow>>(() => {
    const bucketColumns: TableColumnsType<InventoryRow> = (
      ['d5p', 'd4', 'd3', 'd2', 'd1', 'd0'] as StockBucketKey[]
    ).map((bucket) => ({
      title: stockBucketLabelMap[bucket],
      key: bucket,
      align: 'center',
      width: 118,
      render: (_: unknown, row: InventoryRow) =>
        renderCell(row.byBucket[bucket], row, stockBucketLabelMap[bucket]),
    }));

    return [
      {
        title: '分组',
        dataIndex: 'label',
        key: 'label',
        fixed: 'left',
        width: 180,
        render: (_: unknown, row: InventoryRow) => (
          <Space size={8}>
            {!row.isTotal && (
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  display: 'inline-block',
                  background: row.color,
                }}
              />
            )}
            <Text strong={Boolean(row.isTotal)}>{row.label}</Text>
          </Space>
        ),
      },
      ...bucketColumns,
      {
        title: '合计',
        key: 'total',
        align: 'center',
        width: 132,
        render: (_: unknown, row: InventoryRow) => renderCell(row.total, row, '合计'),
      },
    ];
  }, []);

  const coverageWeightRatio =
    inv.totalMetric.totalWeight > 0
      ? inv.totalMetric.scheduledWeight / inv.totalMetric.totalWeight
      : 0;
  const coverageCountRatio =
    inv.totalMetric.totalCount > 0
      ? inv.totalMetric.scheduledCount / inv.totalMetric.totalCount
      : 0;

  const modeOptions: Array<{ value: InventoryColorMode; label: string }> = [
    { value: 'product_type', label: '按产品大类' },
    { value: 'delivery', label: '按交期类别' },
    { value: 'assessment', label: '按是否考核' },
    { value: 'export', label: '按是否出口' },
  ];

  return (
    <Card
      title="库存情况表"
      size="small"
      style={{ marginBottom: 12 }}
      extra={
        <Segmented
          value={inv.colorMode}
          options={modeOptions}
          onChange={(value) => inv.setColorMode(value as InventoryColorMode)}
        />
      }
    >
      <Space orientation="vertical" size={8} style={{ width: '100%', marginBottom: 8 }}>
        <Text type="secondary">
          口径：仅待排+已排（排除 completed）｜库存 {formatWeight(inv.scopedMaterialWeight)}t /{' '}
          {inv.scopedMaterialCount}卷
        </Text>
        <Text type="secondary">
          当前方案排程覆盖：重量 {toPercent(coverageWeightRatio)} / 数量{' '}
          {toPercent(coverageCountRatio)}
          （颜色深浅按重量占比）
        </Text>
      </Space>

      <Spin spinning={inv.loading}>
        {inv.rows.length === 0 ? (
          <Empty
            description={selectedPlanId ? '当前口径下无库存数据' : '请选择方案后查看库存结构'}
          />
        ) : (
          <Table<InventoryRow>
            size="small"
            rowKey="key"
            pagination={false}
            dataSource={inv.rows}
            columns={columns}
            scroll={{ x: 980 }}
          />
        )}
      </Spin>
    </Card>
  );
});

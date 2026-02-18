import { memo, useMemo } from 'react';
import { Card, Space, Table, Tag, Select, InputNumber, Button, Empty, Spin } from 'antd';
import type { TableColumnsType } from 'antd';

import type { RiskConstraintDiffRow } from './useHistoryData';
import { constraintLabelMap } from '../../constants/schedule';
import { riskDeltaColor } from './constants';

interface RiskDiffPanelProps {
  selectedPlanId: number | null;
  compareTargetPlanId: number | null;
  selectedVersion: number | undefined;
  compareTargetVersion: number | undefined;
  riskDiffRows: RiskConstraintDiffRow[];
  filteredRiskDiffRows: RiskConstraintDiffRow[];
  filteredRiskDiffCurrentTotal: number;
  filteredRiskDiffTargetTotal: number;
  filteredRiskDiffDeltaTotal: number;
  riskTrendFilter: 'all' | 'worse' | 'improve';
  riskMinDelta: number;
  loadingRiskDiff: boolean;
  onTrendFilterChange: (value: 'all' | 'worse' | 'improve') => void;
  onMinDeltaChange: (value: number) => void;
  onNavigate: (path: string) => void;
}

export default memo(function RiskDiffPanel({
  selectedPlanId,
  compareTargetPlanId,
  selectedVersion,
  compareTargetVersion,
  riskDiffRows,
  filteredRiskDiffRows,
  filteredRiskDiffCurrentTotal,
  filteredRiskDiffTargetTotal,
  filteredRiskDiffDeltaTotal,
  riskTrendFilter,
  riskMinDelta,
  loadingRiskDiff,
  onTrendFilterChange,
  onMinDeltaChange,
  onNavigate,
}: RiskDiffPanelProps) {
  const riskDiffColumns = useMemo<TableColumnsType<RiskConstraintDiffRow>>(
    () => [
      {
        title: '风险类型',
        dataIndex: 'constraint_type',
        width: 120,
        render: (v: string) => constraintLabelMap[v] || v,
      },
      {
        title: '当前(高/中/低)',
        width: 120,
        align: 'right',
        render: (_: unknown, row: RiskConstraintDiffRow) => (
          <span>{`${row.current_high}/${row.current_medium}/${row.current_low}`}</span>
        ),
      },
      {
        title: '目标(高/中/低)',
        width: 120,
        align: 'right',
        render: (_: unknown, row: RiskConstraintDiffRow) => (
          <span>{`${row.target_high}/${row.target_medium}/${row.target_low}`}</span>
        ),
      },
      {
        title: '当前总',
        dataIndex: 'current_total',
        width: 72,
        align: 'right',
      },
      {
        title: '目标总',
        dataIndex: 'target_total',
        width: 72,
        align: 'right',
      },
      {
        title: '变化(目标-当前)',
        dataIndex: 'delta_total',
        width: 112,
        align: 'right',
        render: (v: number) => (
          <span style={{ color: riskDeltaColor(v), fontWeight: 600 }}>{v > 0 ? `+${v}` : v}</span>
        ),
      },
      {
        title: '查看',
        width: 120,
        align: 'center',
        render: (_: unknown, row: RiskConstraintDiffRow) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!selectedPlanId}
              onClick={() => {
                if (!selectedPlanId) return;
                onNavigate(
                  `/risk?planId=${selectedPlanId}&riskConstraint=${encodeURIComponent(row.constraint_type)}`
                );
              }}
            >
              当前
            </Button>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!compareTargetPlanId}
              onClick={() => {
                if (!compareTargetPlanId) return;
                onNavigate(
                  `/risk?planId=${compareTargetPlanId}&riskConstraint=${encodeURIComponent(row.constraint_type)}`
                );
              }}
            >
              目标
            </Button>
          </Space>
        ),
      },
    ],
    [selectedPlanId, compareTargetPlanId, onNavigate]
  );

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <span>版本风险差异（按类型）</span>
          {compareTargetPlanId && (
            <Tag color="purple" style={{ margin: 0 }}>
              v{selectedVersion ?? '-'} {'->'} v{compareTargetVersion ?? '-'}
            </Tag>
          )}
          <span style={{ color: '#999', fontSize: 12 }}>
            {`筛选后 ${filteredRiskDiffRows.length}/${riskDiffRows.length} / 当前 ${filteredRiskDiffCurrentTotal} / 目标 ${filteredRiskDiffTargetTotal} / 变化 ${filteredRiskDiffDeltaTotal > 0 ? `+${filteredRiskDiffDeltaTotal}` : filteredRiskDiffDeltaTotal}`}
          </span>
          <Select
            size="small"
            style={{ width: 116 }}
            value={riskTrendFilter}
            onChange={onTrendFilterChange}
            options={[
              { value: 'all', label: '全部变化' },
              { value: 'worse', label: '仅看变差' },
              { value: 'improve', label: '仅看改善' },
            ]}
          />
          <InputNumber
            size="small"
            min={0}
            step={1}
            style={{ width: 112 }}
            value={riskMinDelta}
            addonBefore="阈值≥"
            onChange={(value) =>
              onMinDeltaChange(typeof value === 'number' ? Math.max(0, value) : 0)
            }
          />
        </Space>
      }
      style={{ marginBottom: 12 }}
      styles={{ body: { padding: 0 } }}
    >
      {!compareTargetPlanId || selectedPlanId === compareTargetPlanId ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="请先在版本列表选择一个对比目标"
          style={{ padding: 20 }}
        />
      ) : (
        <Spin spinning={loadingRiskDiff}>
          <Table
            size="small"
            rowKey="key"
            dataSource={filteredRiskDiffRows}
            columns={riskDiffColumns}
            pagination={{ pageSize: 6, size: 'small' }}
            scroll={{ x: 760, y: 180 }}
            locale={{ emptyText: '当前与目标版本风险类型分布无差异' }}
          />
        </Spin>
      )}
    </Card>
  );
});

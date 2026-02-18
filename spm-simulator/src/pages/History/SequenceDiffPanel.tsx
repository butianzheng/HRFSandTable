import { memo, useMemo } from 'react';
import { Card, Space, Table, Tag, Select, InputNumber, Button, Empty, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';

import type { SequenceChangeItem } from '../../types/schedule';
import { deltaColor, sequenceMoveLabel } from './constants';

interface SequenceDiffPanelProps {
  selectedPlanId: number | null;
  compareTargetPlanId: number | null;
  selectedVersion: number | undefined;
  compareTargetVersion: number | undefined;
  sequenceDiffRows: SequenceChangeItem[];
  filteredSequenceDiffRows: SequenceChangeItem[];
  sequenceDiffAvgMove: string;
  sequenceMoveFilter: 'all' | 'forward' | 'backward';
  sequenceMinDelta: number;
  loadingSequenceDiff: boolean;
  exportingSequenceDiff: boolean;
  onMoveFilterChange: (value: 'all' | 'forward' | 'backward') => void;
  onMinDeltaChange: (value: number) => void;
  onExportSequenceDiff: (format: 'excel' | 'csv') => void;
  onNavigate: (path: string) => void;
}

export default memo(function SequenceDiffPanel({
  selectedPlanId,
  compareTargetPlanId,
  selectedVersion,
  compareTargetVersion,
  sequenceDiffRows,
  filteredSequenceDiffRows,
  sequenceDiffAvgMove,
  sequenceMoveFilter,
  sequenceMinDelta,
  loadingSequenceDiff,
  exportingSequenceDiff,
  onMoveFilterChange,
  onMinDeltaChange,
  onExportSequenceDiff,
  onNavigate,
}: SequenceDiffPanelProps) {
  const sequenceDiffColumns = useMemo<TableColumnsType<SequenceChangeItem>>(
    () => [
      {
        title: '卷号',
        dataIndex: 'coil_id',
        width: 130,
        ellipsis: true,
      },
      {
        title: `当前(v${selectedVersion ?? '-'})`,
        dataIndex: 'sequence_a',
        width: 100,
        align: 'right',
        render: (v: number) => `#${v}`,
      },
      {
        title: `目标(v${compareTargetVersion ?? '-'})`,
        dataIndex: 'sequence_b',
        width: 100,
        align: 'right',
        render: (v: number) => `#${v}`,
      },
      {
        title: '位移',
        dataIndex: 'delta',
        width: 120,
        render: (v: number) => (
          <span style={{ color: deltaColor(v), fontWeight: 500 }}>{sequenceMoveLabel(v)}</span>
        ),
      },
      {
        title: '定位',
        key: 'locate',
        width: 120,
        align: 'center',
        render: (_: unknown, row: SequenceChangeItem) => (
          <Space size={4}>
            <Button
              type="link"
              size="small"
              style={{ paddingInline: 2 }}
              disabled={!selectedPlanId}
              onClick={() => {
                if (!selectedPlanId) return;
                onNavigate(`/?planId=${selectedPlanId}&focusSeq=${row.sequence_a}`);
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
                onNavigate(`/?planId=${compareTargetPlanId}&focusSeq=${row.sequence_b}`);
              }}
            >
              目标
            </Button>
          </Space>
        ),
      },
    ],
    [selectedPlanId, compareTargetPlanId, selectedVersion, compareTargetVersion, onNavigate]
  );

  return (
    <Card
      size="small"
      title={
        <Space wrap>
          <span>版本顺序差异</span>
          {compareTargetPlanId && (
            <Tag color="purple" style={{ margin: 0 }}>
              v{selectedVersion ?? '-'} {'->'} v{compareTargetVersion ?? '-'}
            </Tag>
          )}
          <span style={{ color: '#999', fontSize: 12 }}>
            {`变化卷数 ${filteredSequenceDiffRows.length}/${sequenceDiffRows.length} / 平均位移 ${sequenceDiffAvgMove}`}
          </span>
          <Select
            size="small"
            style={{ width: 104 }}
            value={sequenceMoveFilter}
            onChange={onMoveFilterChange}
            options={[
              { value: 'all', label: '全部位移' },
              { value: 'forward', label: '仅前移' },
              { value: 'backward', label: '仅后移' },
            ]}
          />
          <InputNumber
            size="small"
            min={0}
            step={1}
            style={{ width: 112 }}
            value={sequenceMinDelta}
            addonBefore="阈值≥"
            onChange={(value) =>
              onMinDeltaChange(typeof value === 'number' ? Math.max(0, value) : 0)
            }
          />
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exportingSequenceDiff}
            disabled={!compareTargetPlanId || selectedPlanId === compareTargetPlanId}
            onClick={() => void onExportSequenceDiff('excel')}
          >
            导出Excel
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            loading={exportingSequenceDiff}
            disabled={!compareTargetPlanId || selectedPlanId === compareTargetPlanId}
            onClick={() => void onExportSequenceDiff('csv')}
          >
            导出CSV
          </Button>
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
        <Spin spinning={loadingSequenceDiff}>
          <Table
            size="small"
            rowKey="coil_id"
            dataSource={filteredSequenceDiffRows}
            columns={sequenceDiffColumns}
            pagination={{ pageSize: 6, size: 'small' }}
            scroll={{ x: 560, y: 180 }}
            locale={{ emptyText: '两版本共同材料顺序无变化' }}
            onRow={(record) => ({
              onDoubleClick: () => {
                if (!selectedPlanId) return;
                onNavigate(`/?planId=${selectedPlanId}&focusSeq=${record.sequence_a}`);
              },
              style: { cursor: 'pointer' },
            })}
          />
        </Spin>
      )}
    </Card>
  );
});

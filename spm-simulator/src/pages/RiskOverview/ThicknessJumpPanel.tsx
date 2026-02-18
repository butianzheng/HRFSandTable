/**
 * 厚度跳跃分析面板 —— 厚度差柱状图 + 厚度跳跃明细表
 */
import { memo } from 'react';
import { Card, Table, Space, Button, Tooltip, Tag, Checkbox } from 'antd';
import type { TableColumnsType } from 'antd';
import { ColumnHeightOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';

import type { ThicknessJumpItem } from '../../types/schedule';
import DeferredEChart from '../../components/DeferredEChart';

export interface ThicknessJumpPanelProps {
  thicknessJumps: ThicknessJumpItem[];
  totalThicknessJumpCount: number;
  onlyNonRollThicknessJumps: boolean;
  onOnlyNonRollThicknessJumpsChange: (checked: boolean) => void;
  thicknessLineOption: EChartsOption;
  thicknessJumpEvents: Record<string, (params: never) => void>;
  onLocate: (row: ThicknessJumpItem) => void;
}

export default memo(function ThicknessJumpPanel({
  thicknessJumps,
  totalThicknessJumpCount,
  onlyNonRollThicknessJumps,
  onOnlyNonRollThicknessJumpsChange,
  thicknessLineOption,
  thicknessJumpEvents,
  onLocate,
}: ThicknessJumpPanelProps) {
  const enableVirtual = thicknessJumps.length >= 200;
  const titleCount = onlyNonRollThicknessJumps
    ? `${thicknessJumps.length}/${totalThicknessJumpCount}`
    : `${totalThicknessJumpCount}`;

  const columns: TableColumnsType<ThicknessJumpItem> = [
    {
      title: '位置',
      dataIndex: 'sequence',
      width: 60,
      align: 'center',
      render: (v: number) => `#${v}`,
    },
    {
      title: '前卷',
      dataIndex: 'prev_coil_id',
      width: 120,
      ellipsis: true,
      render: (v: string, row: ThicknessJumpItem) => (
        <Tooltip title={`厚度: ${row.prev_thickness.toFixed(2)}mm`}>{v}</Tooltip>
      ),
    },
    {
      title: '当前卷',
      dataIndex: 'coil_id',
      width: 120,
      ellipsis: true,
      render: (v: string, row: ThicknessJumpItem) => (
        <Tooltip title={`厚度: ${row.thickness.toFixed(2)}mm`}>{v}</Tooltip>
      ),
    },
    {
      title: '厚度差',
      dataIndex: 'thickness_diff',
      width: 100,
      align: 'right',
      render: (v: number) => (
        <span style={{ color: v > 2 ? '#ff4d4f' : '#faad14', fontWeight: 500 }}>
          {v.toFixed(2)} mm
        </span>
      ),
    },
    {
      title: '换辊标记',
      dataIndex: 'is_roll_change_boundary',
      width: 110,
      align: 'center',
      render: (v?: boolean) =>
        v ? <Tag color="geekblue">换辊边界</Tag> : <Tag color="default">非换辊</Tag>,
    },
    {
      title: '定位',
      key: 'locate',
      width: 72,
      align: 'center',
      render: (_: unknown, row: ThicknessJumpItem) => (
        <Button type="link" size="small" onClick={() => onLocate(row)}>
          定位
        </Button>
      ),
    },
  ];

  return (
    <Card
      title={
        <Space>
          <ColumnHeightOutlined />
          <span>厚度跳跃分析 ({titleCount}处)</span>
        </Space>
      }
      extra={
        <Checkbox
          checked={onlyNonRollThicknessJumps}
          disabled={totalThicknessJumpCount === 0}
          onChange={(e) => onOnlyNonRollThicknessJumpsChange(e.target.checked)}
        >
          仅看非换辊厚跳
        </Checkbox>
      }
      size="small"
      styles={{ body: { padding: 0 } }}
    >
      {thicknessJumps.length > 0 ? (
        <>
          <div style={{ height: 180, padding: '8px 4px 0' }}>
            <Tooltip title="点击柱条或换辊标记可定位到工作台对应序号">
              <div style={{ height: '100%' }}>
                <DeferredEChart
                  echarts={echarts}
                  option={thicknessLineOption}
                  style={{ height: '100%' }}
                  onEvents={thicknessJumpEvents}
                />
              </div>
            </Tooltip>
          </div>
          <Table
            size="small"
            dataSource={thicknessJumps}
            columns={columns}
            rowKey="sequence"
            pagination={false}
            virtual={enableVirtual}
            scroll={{ y: 200 }}
            onRow={(record) => ({ onDoubleClick: () => onLocate(record) })}
          />
        </>
      ) : (
        <div style={{ padding: 32, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 28, color: '#52c41a' }} />
          <div style={{ marginTop: 8, color: '#52c41a' }}>
            {onlyNonRollThicknessJumps && totalThicknessJumpCount > 0
              ? '当前筛选无非换辊厚跳'
              : '无厚度跳跃异常'}
          </div>
        </div>
      )}
    </Card>
  );
});


/**
 * 宽度跳跃分析面板 —— 宽度差柱状图 + 宽度跳跃明细表
 */
import { memo } from 'react';
import { Card, Table, Space, Button, Tooltip, Tag, Checkbox } from 'antd';
import type { TableColumnsType } from 'antd';
import { SwapOutlined, CheckCircleOutlined } from '@ant-design/icons';
import type { EChartsOption } from 'echarts';
import * as echarts from 'echarts/core';

import type { WidthJumpItem } from '../../types/schedule';
import DeferredEChart from '../../components/DeferredEChart';

export interface WidthJumpPanelProps {
  widthJumps: WidthJumpItem[];
  totalWidthJumpCount: number;
  onlyNonRollWidthJumps: boolean;
  onOnlyNonRollWidthJumpsChange: (checked: boolean) => void;
  widthLineOption: EChartsOption;
  widthJumpEvents: Record<string, (params: never) => void>;
  onLocate: (row: WidthJumpItem) => void;
}

export default memo(function WidthJumpPanel({
  widthJumps,
  totalWidthJumpCount,
  onlyNonRollWidthJumps,
  onOnlyNonRollWidthJumpsChange,
  widthLineOption,
  widthJumpEvents,
  onLocate,
}: WidthJumpPanelProps) {
  const enableVirtual = widthJumps.length >= 200;
  const titleCount = onlyNonRollWidthJumps
    ? `${widthJumps.length}/${totalWidthJumpCount}`
    : `${totalWidthJumpCount}`;

  const columns: TableColumnsType<WidthJumpItem> = [
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
      render: (v: string, row: WidthJumpItem) => (
        <Tooltip title={`宽度: ${row.prev_width.toFixed(0)}mm`}>{v}</Tooltip>
      ),
    },
    {
      title: '当前卷',
      dataIndex: 'coil_id',
      width: 120,
      ellipsis: true,
      render: (v: string, row: WidthJumpItem) => (
        <Tooltip title={`宽度: ${row.width.toFixed(0)}mm`}>{v}</Tooltip>
      ),
    },
    {
      title: '宽度差',
      dataIndex: 'width_diff',
      width: 100,
      align: 'right',
      render: (v: number) => (
        <span style={{ color: v > 150 ? '#ff4d4f' : '#faad14', fontWeight: 500 }}>
          {v.toFixed(0)} mm
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
      render: (_: unknown, row: WidthJumpItem) => (
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
          <SwapOutlined />
          <span>宽度跳跃分析 ({titleCount}处)</span>
        </Space>
      }
      extra={
        <Checkbox
          checked={onlyNonRollWidthJumps}
          disabled={totalWidthJumpCount === 0}
          onChange={(e) => onOnlyNonRollWidthJumpsChange(e.target.checked)}
        >
          仅看非换辊宽跳
        </Checkbox>
      }
      size="small"
      styles={{ body: { padding: 0 } }}
      style={{ marginBottom: 12 }}
    >
      {widthJumps.length > 0 ? (
        <>
          <div style={{ height: 180, padding: '8px 4px 0' }}>
            <Tooltip title="点击柱条或换辊标记可定位到工作台对应序号">
              <div style={{ height: '100%' }}>
                <DeferredEChart
                  echarts={echarts}
                  option={widthLineOption}
                  style={{ height: '100%' }}
                  onEvents={widthJumpEvents}
                />
              </div>
            </Tooltip>
          </div>
          <Table
            size="small"
            dataSource={widthJumps}
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
            {onlyNonRollWidthJumps && totalWidthJumpCount > 0
              ? '当前筛选无非换辊宽跳'
              : '无宽度跳跃异常'}
          </div>
        </div>
      )}
    </Card>
  );
});

import { memo } from 'react';
import { Table, Tag } from 'antd';
import type { TableColumnsType } from 'antd';

import type { Material } from '../types/material';

const materialColumns: TableColumnsType<Material> = [
  { title: '卷号', dataIndex: 'coil_id', width: 120, ellipsis: true, fixed: 'left' },
  { title: '钢种', dataIndex: 'steel_grade', width: 70 },
  { title: '宽度', dataIndex: 'width', width: 65, align: 'right' },
  { title: '厚度', dataIndex: 'thickness', width: 65, align: 'right' },
  { title: '重量', dataIndex: 'weight', width: 65, align: 'right', render: (v: number) => v?.toFixed(1) },
  {
    title: '适温',
    dataIndex: 'temp_status',
    width: 70,
    align: 'center',
    render: (v: string) =>
      v === 'ready' ? (
        <Tag color="success" style={{ margin: 0 }}>适温</Tag>
      ) : (
        <Tag color="default" style={{ margin: 0 }}>等温</Tag>
      ),
  },
  { title: '客户', dataIndex: 'customer_name', width: 90, ellipsis: true },
  {
    title: '交期',
    dataIndex: 'due_date',
    width: 90,
    ellipsis: true,
    render: (v: string) => v ? v.slice(0, 10) : '-',
  },
  {
    title: '优先级',
    dataIndex: 'priority_final',
    width: 65,
    align: 'right',
    sorter: (a: Material, b: Material) => (a.priority_final ?? 0) - (b.priority_final ?? 0),
  },
  {
    title: '合同属性',
    dataIndex: 'contract_attr',
    width: 80,
    align: 'center',
    render: (v: string) =>
      v === '急单' ? (
        <Tag color="error" style={{ margin: 0 }}>急单</Tag>
      ) : v ? (
        <span>{v}</span>
      ) : '-',
  },
];

export interface MaterialTableProps {
  dataSource: Material[];
  selectedRowKeys: number[];
  onSelectionChange: (keys: number[]) => void;
  scrollY?: number;
  extraColumns?: TableColumnsType<Material>;
  virtual?: boolean;
}

export default memo(function MaterialTable({
  dataSource,
  selectedRowKeys,
  onSelectionChange,
  scrollY = 200,
  extraColumns,
  virtual,
}: MaterialTableProps) {
  const columns = extraColumns ? [...materialColumns, ...extraColumns] : materialColumns;

  return (
    <Table
      size="small"
      pagination={false}
      dataSource={dataSource}
      rowKey="id"
      rowSelection={{
        selectedRowKeys,
        onChange: (keys) => onSelectionChange(keys as number[]),
      }}
      columns={columns}
      virtual={virtual}
      scroll={{ x: 800, y: scrollY }}
    />
  );
});

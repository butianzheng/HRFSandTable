import { useState, useCallback, useEffect } from 'react';
import { Table, Tag, Button, Popconfirm, Space } from 'antd';
import type { TableColumnsType } from 'antd';
import { DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ImportBatch } from '../../types/material';

interface ImportBatchPanelProps {
  onLoadBatches: () => Promise<ImportBatch[]>;
  onDeleteBatch: (batchId: number) => Promise<unknown>;
}

const conflictModeLabel: Record<string, string> = {
  skip: '跳过重复',
  overwrite: '覆盖更新',
  replace_all: '全量替换',
};

const statusColorMap: Record<string, string> = {
  active: 'green',
  deleted: 'default',
  superseded: 'orange',
};

const statusLabelMap: Record<string, string> = {
  active: '活跃',
  deleted: '已删除',
  superseded: '已替代',
};

export default function ImportBatchPanel({ onLoadBatches, onDeleteBatch }: ImportBatchPanelProps) {
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await onLoadBatches();
      setBatches(data);
    } finally {
      setLoading(false);
    }
  }, [onLoadBatches]);

  useEffect(() => {
    if (expanded) {
      refresh();
    }
  }, [expanded, refresh]);

  const handleDelete = useCallback(
    async (batchId: number) => {
      await onDeleteBatch(batchId);
      await refresh();
    },
    [onDeleteBatch, refresh]
  );

  const columns: TableColumnsType<ImportBatch> = [
    { title: '批次号', dataIndex: 'batch_no', width: 160 },
    { title: '文件名', dataIndex: 'file_name', width: 180, ellipsis: true },
    {
      title: '冲突策略',
      dataIndex: 'conflict_mode',
      width: 100,
      render: (v: string) => conflictModeLabel[v] ?? v,
    },
    { title: '总计', dataIndex: 'total_count', width: 60, align: 'right' },
    { title: '成功', dataIndex: 'success_count', width: 60, align: 'right' },
    { title: '跳过', dataIndex: 'skipped_count', width: 60, align: 'right' },
    { title: '覆盖', dataIndex: 'overwritten_count', width: 60, align: 'right' },
    { title: '失败', dataIndex: 'failed_count', width: 60, align: 'right' },
    {
      title: '状态',
      dataIndex: 'status',
      width: 80,
      render: (v: string) => (
        <Tag color={statusColorMap[v] ?? 'default'}>
          {statusLabelMap[v] ?? v}
        </Tag>
      ),
    },
    {
      title: '导入时间',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string | null) => v ?? '-',
    },
    {
      title: '操作',
      width: 80,
      render: (_: unknown, record: ImportBatch) =>
        record.status === 'active' ? (
          <Popconfirm
            title="确认删除此批次？"
            description="将删除该批次中所有待排(pending)材料"
            onConfirm={() => handleDelete(record.id)}
          >
            <Button type="link" danger size="small" icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        ) : null,
    },
  ];

  if (!expanded) {
    return (
      <div style={{ marginTop: 12, textAlign: 'center' }}>
        <Button type="link" onClick={() => setExpanded(true)}>
          查看导入批次历史
        </Button>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <Space style={{ marginBottom: 8 }}>
        <span style={{ fontWeight: 500 }}>导入批次历史</span>
        <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>
          刷新
        </Button>
        <Button type="link" size="small" onClick={() => setExpanded(false)}>
          收起
        </Button>
      </Space>
      <Table
        size="small"
        loading={loading}
        dataSource={batches}
        rowKey="id"
        columns={columns}
        pagination={{ pageSize: 10, size: 'small' }}
        scroll={{ x: 1100 }}
      />
    </div>
  );
}

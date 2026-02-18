import { memo, useMemo } from 'react';
import { Card, Space, Table, Tag, Timeline, Empty, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import { FileTextOutlined, EditOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import type { OperationLogEntry } from '../../types/schedule';
import { actionIconMap, actionLabelMap } from './constants';

interface OperationLogPanelProps {
  logs: OperationLogEntry[];
  loadingLogs: boolean;
}

export default memo(function OperationLogPanel({ logs, loadingLogs }: OperationLogPanelProps) {
  const logColumns = useMemo<TableColumnsType<OperationLogEntry>>(
    () => [
      {
        title: '时间',
        dataIndex: 'created_at',
        width: 140,
        render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '-'),
      },
      {
        title: '类型',
        dataIndex: 'log_type',
        width: 80,
        render: (v: string) => <Tag>{v}</Tag>,
      },
      {
        title: '操作',
        dataIndex: 'action',
        width: 100,
        render: (v: string) => (
          <Space size={4}>
            {actionIconMap[v] || <EditOutlined />}
            <span>{actionLabelMap[v] || v}</span>
          </Space>
        ),
      },
      {
        title: '详情',
        dataIndex: 'detail',
        ellipsis: true,
      },
    ],
    []
  );

  return (
    <Card
      title={
        <Space>
          <FileTextOutlined />
          <span>操作日志 ({logs.length}条记录)</span>
        </Space>
      }
      size="small"
      styles={{ body: { padding: 0 } }}
    >
      <Spin spinning={loadingLogs}>
        {logs.length > 0 ? (
          <>
            <div
              style={{
                padding: '12px 16px',
                maxHeight: 260,
                overflow: 'auto',
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <Timeline
                items={logs.slice(0, 20).map((log) => ({
                  color:
                    log.action === 'delete'
                      ? 'red'
                      : log.action === 'create'
                        ? 'green'
                        : log.action === 'schedule' || log.action === 'auto_schedule'
                          ? 'purple'
                          : 'blue',
                  children: (
                    <div>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {log.created_at ? dayjs(log.created_at).format('MM-DD HH:mm:ss') : ''}
                      </div>
                      <div>
                        <Tag style={{ marginRight: 4 }}>
                          {actionLabelMap[log.action] || log.action}
                        </Tag>
                        <span style={{ fontSize: 13 }}>{log.detail || '-'}</span>
                      </div>
                    </div>
                  ),
                }))}
              />
            </div>
            <Table
              size="small"
              dataSource={logs}
              columns={logColumns}
              rowKey="id"
              pagination={{ pageSize: 10, size: 'small' }}
              scroll={{ y: 300 }}
            />
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无操作日志"
            style={{ padding: 40 }}
          />
        )}
      </Spin>
    </Card>
  );
});

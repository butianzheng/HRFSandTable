import { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Select,
  Input,
  Row,
  Col,
  Statistic,
  Modal,
  Typography,
} from 'antd';
import type { TableColumnsType } from 'antd';
import {
  ReloadOutlined,
  DeleteOutlined,
  CheckOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useErrorTrackingStore } from '../../stores/errorTrackingStore';
import type { ErrorLog } from '../../types/error';

const { Text, Paragraph } = Typography;
const { Search } = Input;

export default function ErrorLogsTab({ refreshTrigger }: { refreshTrigger: number }) {
  const {
    errors,
    stats,
    total,
    loading,
    page,
    pageSize,
    filter,
    setPage,
    setPageSize,
    setFilter,
    fetchErrors,
    resolveError,
    deleteError,
    cleanupOldErrors,
    refreshAll,
  } = useErrorTrackingStore();

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    if (refreshTrigger > 0) {
      refreshAll();
    }
  }, [refreshTrigger, refreshAll]);

  useEffect(() => {
    fetchErrors();
  }, [page, pageSize, filter, fetchErrors]);

  const handleResolve = async (errorId: number) => {
    try {
      await resolveError(errorId);
      message.success('已标记为已解决');
    } catch {
      message.error('操作失败');
    }
  };

  const handleDelete = async (errorId: number) => {
    try {
      await deleteError(errorId);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  const handleCleanup = async () => {
    try {
      const deleted = await cleanupOldErrors(30);
      message.success(`已清理 ${deleted} 条已解决的错误`);
    } catch {
      message.error('清理失败');
    }
  };

  const showDetail = (error: ErrorLog) => {
    setSelectedError(error);
    setDetailModalVisible(true);
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <ExclamationCircleOutlined />;
      case 'warning':
        return <WarningOutlined />;
      case 'info':
        return <InfoCircleOutlined />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'blue';
      default:
        return 'default';
    }
  };

  const columns: TableColumnsType<ErrorLog> = [
    {
      title: '严重程度',
      dataIndex: 'severity',
      width: 100,
      render: (severity: string) => (
        <Tag color={getSeverityColor(severity)} icon={getSeverityIcon(severity)}>
          {severity === 'error' ? '错误' : severity === 'warning' ? '警告' : '信息'}
        </Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'error_type',
      width: 100,
      render: (type: string) => {
        const typeMap: Record<string, string> = {
          frontend: '前端',
          backend: '后端',
          panic: 'Panic',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '错误消息',
      dataIndex: 'message',
      ellipsis: true,
      render: (message: string, record: ErrorLog) => (
        <a onClick={() => showDetail(record)}>{message}</a>
      ),
    },
    {
      title: '次数',
      dataIndex: 'count',
      width: 80,
      align: 'right',
    },
    {
      title: '首次出现',
      dataIndex: 'first_seen',
      width: 170,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '最后出现',
      dataIndex: 'last_seen',
      width: 170,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      title: '状态',
      dataIndex: 'resolved',
      width: 80,
      render: (resolved: boolean) => (
        <Tag color={resolved ? 'success' : 'default'}>{resolved ? '已解决' : '未解决'}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      render: (_, record: ErrorLog) => (
        <Space size="small">
          {!record.resolved && (
            <Button
              type="link"
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleResolve(record.id)}
            >
              解决
            </Button>
          )}
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card
      size="small"
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => refreshAll()} loading={loading}>
            刷新
          </Button>
          <Popconfirm title="清理30天前已解决的错误？" onConfirm={handleCleanup}>
            <Button icon={<DeleteOutlined />}>清理旧错误</Button>
          </Popconfirm>
        </Space>
      }
    >
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {/* 统计概览 */}
        {stats && (
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="总错误数" value={stats.total_errors} />
            </Col>
            <Col span={6}>
              <Statistic
                title="未解决错误"
                value={stats.unresolved_errors}
                valueStyle={{ color: stats.unresolved_errors > 0 ? '#cf1322' : undefined }}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="前端错误"
                value={stats.error_by_type.find((t) => t.error_type === 'frontend')?.count || 0}
              />
            </Col>
            <Col span={6}>
              <Statistic
                title="后端错误"
                value={stats.error_by_type.find((t) => t.error_type === 'backend')?.count || 0}
              />
            </Col>
          </Row>
        )}

        {/* 过滤器 */}
        <Space wrap>
          <Select
            placeholder="错误类型"
            style={{ width: 120 }}
            allowClear
            value={filter.error_type}
            onChange={(value) => setFilter({ error_type: value })}
            options={[
              { label: '前端', value: 'frontend' },
              { label: '后端', value: 'backend' },
              { label: 'Panic', value: 'panic' },
            ]}
          />
          <Select
            placeholder="严重程度"
            style={{ width: 120 }}
            allowClear
            value={filter.severity}
            onChange={(value) => setFilter({ severity: value })}
            options={[
              { label: '错误', value: 'error' },
              { label: '警告', value: 'warning' },
              { label: '信息', value: 'info' },
            ]}
          />
          <Select
            placeholder="状态"
            style={{ width: 120 }}
            allowClear
            value={filter.resolved}
            onChange={(value) => setFilter({ resolved: value })}
            options={[
              { label: '未解决', value: false },
              { label: '已解决', value: true },
            ]}
          />
          <Search
            placeholder="搜索错误消息"
            style={{ width: 200 }}
            allowClear
            onSearch={(value) => setFilter({ search: value || undefined })}
          />
        </Space>

        {/* 错误列表 */}
        <Table
          size="small"
          loading={loading}
          dataSource={errors}
          columns={columns}
          rowKey="id"
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            onChange: (page, pageSize) => {
              setPage(page);
              setPageSize(pageSize);
            },
          }}
          scroll={{ x: 1200 }}
        />
      </Space>

      {/* 错误详情模态框 */}
      <Modal
        title="错误详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        {selectedError && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <div>
              <Text strong>错误消息:</Text>
              <Paragraph>{selectedError.message}</Paragraph>
            </div>

            {selectedError.stack_trace && (
              <div>
                <Text strong>堆栈跟踪:</Text>
                <Paragraph>
                  <pre
                    style={{ maxHeight: 300, overflow: 'auto', background: '#f5f5f5', padding: 12 }}
                  >
                    {selectedError.stack_trace}
                  </pre>
                </Paragraph>
              </div>
            )}

            {selectedError.context && (
              <div>
                <Text strong>上下文:</Text>
                <Paragraph>
                  <pre style={{ background: '#f5f5f5', padding: 12 }}>
                    {JSON.stringify(JSON.parse(selectedError.context), null, 2)}
                  </pre>
                </Paragraph>
              </div>
            )}

            {selectedError.url && (
              <div>
                <Text strong>URL:</Text>
                <Paragraph>{selectedError.url}</Paragraph>
              </div>
            )}

            {selectedError.user_agent && (
              <div>
                <Text strong>User Agent:</Text>
                <Paragraph>{selectedError.user_agent}</Paragraph>
              </div>
            )}

            <div>
              <Text strong>出现次数:</Text> {selectedError.count}
            </div>

            <div>
              <Text strong>首次出现:</Text>{' '}
              {dayjs(selectedError.first_seen).format('YYYY-MM-DD HH:mm:ss')}
            </div>

            <div>
              <Text strong>最后出现:</Text>{' '}
              {dayjs(selectedError.last_seen).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </Space>
        )}
      </Modal>
    </Card>
  );
}

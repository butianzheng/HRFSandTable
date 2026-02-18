import { Space, Tag, Alert, Table, Modal, Button } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { ImportTestResult } from '../../types/material';

interface TestResultModalProps {
  open: boolean;
  testResult: ImportTestResult | null;
  testErrorSummary: Array<{ type: string; count: number }>;
  exportingTestResult: boolean;
  onClose: () => void;
  onExport: () => void;
}

export default function TestResultModal({
  open,
  testResult,
  testErrorSummary,
  exportingTestResult,
  onClose,
  onExport,
}: TestResultModalProps) {
  return (
    <Modal
      title="测试导入结果（沙盒）"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button
            icon={<DownloadOutlined />}
            loading={exportingTestResult}
            disabled={!testResult}
            onClick={onExport}
          >
            导出CSV
          </Button>
          <Button type="primary" onClick={onClose}>
            关闭
          </Button>
        </Space>
      }
      width={760}
    >
      {testResult && (
        <div>
          <Space size={[8, 8]} wrap>
            <Tag color="blue">总计 {testResult.total}</Tag>
            <Tag color="green">成功 {testResult.success}</Tag>
            <Tag color={testResult.failed > 0 ? 'red' : 'default'}>失败 {testResult.failed}</Tag>
          </Space>
          {testResult.failed > 0 && testResult.errors.length > 0 && (
            <Alert
              style={{ marginTop: 10 }}
              type="warning"
              showIcon
              message={`首条错误: ${testResult.errors[0]}`}
            />
          )}
          {testErrorSummary.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <Space size={[6, 6]} wrap>
                <Tag color="processing" style={{ margin: 0 }}>
                  错误分类
                </Tag>
                {testErrorSummary.map((item) => (
                  <Tag key={item.type} color="default" style={{ margin: 0 }}>
                    {item.type} {item.count}
                  </Tag>
                ))}
              </Space>
            </div>
          )}
          <Table
            size="small"
            style={{ marginTop: 10 }}
            pagination={{ pageSize: 8, size: 'small' }}
            rowKey={(row) => `${row.line_no}-${row.status}`}
            dataSource={testResult.rows}
            columns={[
              { title: '行号', dataIndex: 'line_no', width: 80, align: 'right' },
              {
                title: '结果',
                dataIndex: 'status',
                width: 90,
                align: 'center',
                render: (status: string) =>
                  status === 'ok' ? <Tag color="success">通过</Tag> : <Tag color="error">失败</Tag>,
              },
              { title: '说明', dataIndex: 'message' },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}

import { memo } from 'react';
import { Card, List, Button, Space, Tag, Tooltip, Popconfirm } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  DownloadOutlined,
  UploadOutlined,
  StarOutlined,
  StarFilled,
} from '@ant-design/icons';
import type { StrategyTemplate } from '../../types/config';

export interface TemplateListPanelProps {
  templates: StrategyTemplate[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onImport: () => void;
  onExport: () => void;
  onExportDisabled: boolean;
  onCreate: () => void;
  onEdit: (t: StrategyTemplate) => void;
  onDelete: (id: number) => void;
  onDuplicate: (t: StrategyTemplate) => void;
  onSetDefault: (id: number) => void;
}

export default memo(function TemplateListPanel({
  templates,
  loading,
  selectedId,
  onSelect,
  onImport,
  onExport,
  onExportDisabled,
  onCreate,
  onEdit,
  onDelete,
  onDuplicate,
  onSetDefault,
}: TemplateListPanelProps) {
  return (
    <Card
      title="策略模板"
      size="small"
      style={{ height: 'calc(100vh - 130px)', overflow: 'auto' }}
      extra={
        <Space>
          <Button size="small" icon={<UploadOutlined />} onClick={onImport}>
            导入
          </Button>
          <Button
            size="small"
            icon={<DownloadOutlined />}
            onClick={onExport}
            disabled={onExportDisabled}
          >
            导出
          </Button>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onCreate}>
            新建
          </Button>
        </Space>
      }
    >
      <List
        loading={loading}
        dataSource={templates}
        renderItem={(t) => (
          <List.Item
            onClick={() => onSelect(t.id)}
            style={{
              cursor: 'pointer',
              background: selectedId === t.id ? '#e6f4ff' : undefined,
              padding: '8px 12px',
              borderRadius: 4,
            }}
            actions={[
              ...(t.is_default
                ? [<StarFilled key="star" style={{ color: '#faad14' }} />]
                : [
                    <Tooltip key="set-default" title="设为默认">
                      <StarOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetDefault(t.id);
                        }}
                      />
                    </Tooltip>,
                  ]),
              ...(!t.is_system
                ? [
                    <Tooltip key="edit" title="编辑">
                      <EditOutlined
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(t);
                        }}
                      />
                    </Tooltip>,
                    <Popconfirm
                      key="del"
                      title="确定删除？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        onDelete(t.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <DeleteOutlined
                        style={{ color: '#ff4d4f' }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>,
                  ]
                : []),
              <Tooltip key="copy" title="复制">
                <CopyOutlined
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicate(t);
                  }}
                />
              </Tooltip>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space>
                  {t.name}
                  {t.is_system && <Tag color="blue">系统</Tag>}
                </Space>
              }
              description={t.description || '-'}
            />
          </List.Item>
        )}
      />
    </Card>
  );
});

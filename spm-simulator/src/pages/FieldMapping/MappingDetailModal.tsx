import { Modal, Tag, Divider, Table } from 'antd';
import {
  TARGET_FIELDS,
  type FieldMapping as FieldMappingType,
  type FieldMappingItem,
} from '../../types/fieldMapping';

const targetFields = TARGET_FIELDS;

interface MappingDetailModalProps {
  open: boolean;
  detailData: FieldMappingType | null;
  onClose: () => void;
}

export default function MappingDetailModal({ open, detailData, onClose }: MappingDetailModalProps) {
  return (
    <Modal title="映射模板详情" open={open} onCancel={onClose} footer={null} width={700}>
      {detailData && (
        <div>
          <p>
            <strong>模板名称：</strong>
            {detailData.template_name}
          </p>
          <p>
            <strong>数据源类型：</strong>
            <Tag color={detailData.source_type === 'excel' ? 'blue' : 'green'}>
              {detailData.source_type === 'excel' ? 'Excel' : 'CSV'}
            </Tag>
          </p>
          <Divider titlePlacement="left" plain>
            字段映射
          </Divider>
          <Table
            size="small"
            pagination={false}
            dataSource={(() => {
              try {
                return JSON.parse(detailData.mappings) as FieldMappingItem[];
              } catch {
                return [];
              }
            })()}
            rowKey={(_, i) => String(i)}
            columns={[
              { title: '源列名', dataIndex: 'source_field' },
              {
                title: '目标字段',
                dataIndex: 'target_field',
                render: (v: string) => {
                  const tf = targetFields.find((f) => f.field === v);
                  return tf ? `${tf.label} (${v})` : v;
                },
              },
              {
                title: '映射类型',
                dataIndex: 'mapping_type',
                render: (v: string) => {
                  const labels: Record<string, string> = {
                    direct: '直接映射',
                    transform: '值转换',
                    date: '日期解析',
                    default: '默认值',
                    calculate: '计算',
                    combine: '组合',
                  };
                  return labels[v] || v;
                },
              },
              {
                title: '默认值',
                dataIndex: 'default_value',
                render: (v: string | undefined) => v || '-',
              },
              {
                title: '规则',
                dataIndex: 'transform_rule',
                render: (v: string | undefined) => v || '-',
              },
              {
                title: '日期格式',
                dataIndex: 'source_format',
                render: (v: string | undefined) => v || '-',
              },
            ]}
          />
        </div>
      )}
    </Modal>
  );
}

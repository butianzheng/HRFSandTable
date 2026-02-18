import { memo } from 'react';
import { Table, Switch, InputNumber, Tag } from 'antd';
import type { SoftConstraint } from '../../types/config';

export interface SoftConstraintsEditorProps {
  value: SoftConstraint[];
  onChange: (v: SoftConstraint[]) => void;
  readOnly?: boolean;
}

type SRow = SoftConstraint & { _key: number };

export default memo(function SoftConstraintsEditor({
  value,
  onChange,
  readOnly,
}: SoftConstraintsEditorProps) {
  const updateField = (index: number, field: string, val: unknown) => {
    const arr = [...value];
    arr[index] = { ...arr[index], [field]: val };
    onChange(arr);
  };

  return (
    <Table
      size="small"
      pagination={false}
      dataSource={value.map((v, i) => ({ ...v, _key: i }))}
      rowKey="_key"
      columns={[
        { title: '约束名称', dataIndex: 'name', width: 150 },
        {
          title: '启用',
          dataIndex: 'enabled',
          width: 60,
          render: (v: boolean, r: SRow) => (
            <Switch
              size="small"
              checked={v}
              disabled={readOnly}
              onChange={(val) => updateField(r._key, 'enabled', val)}
            />
          ),
        },
        {
          title: '惩罚',
          dataIndex: 'penalty',
          width: 80,
          render: (v: number | undefined, r: SRow) =>
            v !== undefined ? (
              readOnly ? (
                <Tag color="red">-{v}</Tag>
              ) : (
                <InputNumber
                  size="small"
                  value={v}
                  min={0}
                  style={{ width: 65 }}
                  onChange={(val) => updateField(r._key, 'penalty', val)}
                />
              )
            ) : (
              '-'
            ),
        },
        {
          title: '奖励',
          dataIndex: 'bonus',
          width: 80,
          render: (v: number | undefined, r: SRow) =>
            v !== undefined ? (
              readOnly ? (
                <Tag color="green">+{v}</Tag>
              ) : (
                <InputNumber
                  size="small"
                  value={v}
                  min={0}
                  style={{ width: 65 }}
                  onChange={(val) => updateField(r._key, 'bonus', val)}
                />
              )
            ) : (
              '-'
            ),
        },
        {
          title: '阈值',
          width: 80,
          render: (_: unknown, record: SRow) =>
            record.threshold !== undefined ? (
              readOnly ? (
                `${record.threshold}${record.unit || ''}`
              ) : (
                <InputNumber
                  size="small"
                  value={record.threshold}
                  style={{ width: 65 }}
                  onChange={(val) => updateField(record._key, 'threshold', val)}
                />
              )
            ) : (
              '-'
            ),
        },
      ]}
    />
  );
});

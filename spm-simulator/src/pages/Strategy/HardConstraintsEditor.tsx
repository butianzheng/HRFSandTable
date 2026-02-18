import { memo } from 'react';
import { Table, Switch, InputNumber } from 'antd';
import type { HardConstraint } from '../../types/config';

export interface HardConstraintsEditorProps {
  value: HardConstraint[];
  onChange: (v: HardConstraint[]) => void;
  readOnly?: boolean;
}

type HRow = HardConstraint & { _key: number };

export default memo(function HardConstraintsEditor({
  value,
  onChange,
  readOnly,
}: HardConstraintsEditorProps) {
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
          render: (v: boolean, r: HRow) => (
            <Switch
              size="small"
              checked={v}
              disabled={readOnly}
              onChange={(val) => updateField(r._key, 'enabled', val)}
            />
          ),
        },
        {
          title: '阈值',
          width: 140,
          render: (_: unknown, record: HRow) => {
            if (record.max_value !== undefined) {
              return readOnly ? (
                `${record.max_value} ${record.unit || ''}`
              ) : (
                <InputNumber
                  size="small"
                  value={record.max_value}
                  style={{ width: 100 }}
                  addonAfter={record.unit}
                  onChange={(val) => updateField(record._key, 'max_value', val)}
                />
              );
            }
            if (record.value !== undefined) {
              return readOnly ? (
                `${record.value} ${record.unit || ''}`
              ) : (
                <InputNumber
                  size="small"
                  value={record.value}
                  style={{ width: 100 }}
                  addonAfter={record.unit}
                  onChange={(val) => updateField(record._key, 'value', val)}
                />
              );
            }
            return '-';
          },
        },
        {
          title: '说明',
          dataIndex: 'description',
          ellipsis: true,
          render: (v: string | undefined) => v || '-',
        },
      ]}
    />
  );
});

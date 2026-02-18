import { memo } from 'react';
import { Table, Select, InputNumber, Switch, Space, Button, Tag } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import type { SortPriority } from '../../types/config';
import { fieldLabels } from './constants';

export interface SortWeightsEditorProps {
  value: SortPriority[];
  onChange: (v: SortPriority[]) => void;
  readOnly?: boolean;
}

type SortRow = SortPriority & { _key: number };

export default memo(function SortWeightsEditor({
  value,
  onChange,
  readOnly,
}: SortWeightsEditorProps) {
  const moveRow = (index: number, direction: 'up' | 'down') => {
    const arr = [...value];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= arr.length) return;
    const tmpWeight = arr[index].weight;
    arr[index].weight = arr[targetIdx].weight;
    arr[targetIdx].weight = tmpWeight;
    [arr[index], arr[targetIdx]] = [arr[targetIdx], arr[index]];
    onChange(arr);
  };

  const updateField = (index: number, field: keyof SortPriority, val: unknown) => {
    const arr = [...value];
    arr[index] = { ...arr[index], [field]: val };
    onChange(arr);
  };

  const columns = [
    {
      title: '#',
      width: 40,
      render: (_: unknown, __: unknown, idx: number) => idx + 1,
    },
    {
      title: '字段',
      dataIndex: 'field',
      width: 100,
      render: (v: string) => fieldLabels[v] || v,
    },
    {
      title: '排序',
      dataIndex: 'order',
      width: 80,
      render: (v: string, r: SortRow) =>
        readOnly ? (
          <Tag color={v === 'desc' ? 'blue' : 'green'}>{v === 'desc' ? '降序' : '升序'}</Tag>
        ) : (
          <Select
            size="small"
            value={v}
            style={{ width: 70 }}
            onChange={(val) => updateField(r._key, 'order', val)}
            options={[
              { value: 'asc', label: '升序' },
              { value: 'desc', label: '降序' },
            ]}
          />
        ),
    },
    {
      title: '权重',
      dataIndex: 'weight',
      width: 80,
      render: (v: number, r: SortRow) =>
        readOnly ? (
          v
        ) : (
          <InputNumber
            size="small"
            min={0}
            max={100}
            value={v}
            style={{ width: 65 }}
            onChange={(val) => updateField(r._key, 'weight', val ?? 0)}
          />
        ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 60,
      render: (v: boolean, r: SortRow) => (
        <Switch
          size="small"
          checked={v}
          disabled={readOnly || r.is_prerequisite}
          onChange={(val) => updateField(r._key, 'enabled', val)}
        />
      ),
    },
    {
      title: '分组',
      dataIndex: 'group',
      width: 60,
      render: (v: boolean, r: SortRow) => (
        <Switch
          size="small"
          checked={v}
          disabled={readOnly}
          onChange={(val) => updateField(r._key, 'group', val)}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      ellipsis: true,
    },
    ...(!readOnly
      ? [
          {
            title: '调序',
            width: 70,
            render: (_v: unknown, _r: SortRow, idx: number) => (
              <Space size={4}>
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowUpOutlined />}
                  disabled={idx === 0}
                  onClick={() => moveRow(idx, 'up')}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<ArrowDownOutlined />}
                  disabled={idx === value.length - 1}
                  onClick={() => moveRow(idx, 'down')}
                />
              </Space>
            ),
          },
        ]
      : []),
  ];

  return (
    <Table
      size="small"
      pagination={false}
      dataSource={value.map((v, i) => ({ ...v, _key: i }))}
      rowKey="_key"
      columns={columns}
    />
  );
});

import type React from 'react';
import { Input, InputNumber, Switch, Select, Popconfirm, Button, Tag } from 'antd';
import type { TableColumnsType } from 'antd';
import type {
  EditablePriorityWeightRow,
  EditablePriorityDimensionRow,
  EditableCustomerPriorityRow,
  EditableBatchPriorityRow,
  EditableProductTypePriorityRow,
} from '../types';
import {
  weightDimensionLabelMap,
  priorityDimensionTypeOptions,
  customerPriorityLevelOptions,
  batchPriorityTypeOptions,
  productPriorityLevelOptions,
} from '../types';

export interface UsePriorityColumnsParams {
  setWeightRows: React.Dispatch<React.SetStateAction<EditablePriorityWeightRow[]>>;
  setDimensionRows: React.Dispatch<React.SetStateAction<EditablePriorityDimensionRow[]>>;
  setCustomerRows: React.Dispatch<React.SetStateAction<EditableCustomerPriorityRow[]>>;
  setBatchRows: React.Dispatch<React.SetStateAction<EditableBatchPriorityRow[]>>;
  setProductRows: React.Dispatch<React.SetStateAction<EditableProductTypePriorityRow[]>>;
  handleDeleteDimensionRow: (row: EditablePriorityDimensionRow) => Promise<void>;
  handleDeleteCustomerRow: (row: EditableCustomerPriorityRow) => Promise<void>;
  handleDeleteBatchRow: (row: EditableBatchPriorityRow) => Promise<void>;
  handleDeleteProductRow: (row: EditableProductTypePriorityRow) => Promise<void>;
}

export function usePriorityColumns({
  setWeightRows,
  setDimensionRows,
  setCustomerRows,
  setBatchRows,
  setProductRows,
  handleDeleteDimensionRow,
  handleDeleteCustomerRow,
  handleDeleteBatchRow,
  handleDeleteProductRow,
}: UsePriorityColumnsParams) {
  const weightColumns: TableColumnsType<EditablePriorityWeightRow> = [
    {
      title: '维度',
      dataIndex: 'dimension_type',
      width: 130,
      render: (value: string) => <Tag color="blue">{weightDimensionLabelMap[value] ?? value}</Tag>,
    },
    {
      title: '维度名称',
      dataIndex: 'dimension_name',
      width: 140,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setWeightRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, dimension_name: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '权重(0~1)',
      dataIndex: 'weight',
      width: 130,
      render: (value: number, row) => (
        <InputNumber
          min={0}
          max={1}
          step={0.05}
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setWeightRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, weight: nextValue ?? 0 } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value: boolean, row) => (
        <Switch
          checked={value}
          onChange={(checked) => {
            setWeightRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, enabled: checked } : item))
            );
          }}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 100,
      render: (value: number | undefined, row) => (
        <InputNumber
          min={0}
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setWeightRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, sort_order: nextValue ?? 0 } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      render: (value: string | undefined, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setWeightRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, description: nextValue } : item
              )
            );
          }}
        />
      ),
    },
  ];

  const dimensionColumns: TableColumnsType<EditablePriorityDimensionRow> = [
    {
      title: '维度类型',
      dataIndex: 'dimension_type',
      width: 130,
      render: (value: string, row) => (
        <Select
          value={value}
          options={priorityDimensionTypeOptions}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setDimensionRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, dimension_type: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '编码',
      dataIndex: 'dimension_code',
      width: 140,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDimensionRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, dimension_code: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '名称',
      dataIndex: 'dimension_name',
      width: 160,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDimensionRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, dimension_name: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '分值',
      dataIndex: 'score',
      width: 110,
      render: (value: number, row) => (
        <InputNumber
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setDimensionRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, score: nextValue ?? 0 } : item))
            );
          }}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value: boolean, row) => (
        <Switch
          checked={value}
          onChange={(checked) => {
            setDimensionRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, enabled: checked } : item))
            );
          }}
        />
      ),
    },
    {
      title: '排序',
      dataIndex: 'sort_order',
      width: 100,
      render: (value: number | undefined, row) => (
        <InputNumber
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setDimensionRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, sort_order: nextValue ?? 0 } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '规则(JSON)',
      dataIndex: 'rule_config',
      width: 200,
      render: (value: string | undefined, row) => (
        <Input
          value={value}
          placeholder="{...}"
          onChange={(event) => {
            const nextValue = event.target.value;
            setDimensionRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, rule_config: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '说明',
      dataIndex: 'description',
      width: 180,
      render: (value: string | undefined, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setDimensionRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, description: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      fixed: 'right',
      render: (_value: unknown, row) => (
        <Popconfirm title="确认删除该维度配置？" onConfirm={() => handleDeleteDimensionRow(row)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const customerColumns: TableColumnsType<EditableCustomerPriorityRow> = [
    {
      title: '客户编码',
      dataIndex: 'customer_code',
      width: 140,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCustomerRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, customer_code: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '客户名称',
      dataIndex: 'customer_name',
      width: 160,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCustomerRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, customer_name: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '等级',
      dataIndex: 'priority_level',
      width: 120,
      render: (value: string, row) => (
        <Select
          value={value}
          options={customerPriorityLevelOptions}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setCustomerRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, priority_level: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '分值',
      dataIndex: 'priority_score',
      width: 100,
      render: (value: number, row) => (
        <InputNumber
          min={0}
          max={1000}
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setCustomerRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, priority_score: nextValue ?? 0 } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value: boolean, row) => (
        <Switch
          checked={value}
          onChange={(checked) => {
            setCustomerRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, enabled: checked } : item))
            );
          }}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      render: (value: string | undefined, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setCustomerRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, remarks: nextValue } : item))
            );
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      fixed: 'right',
      render: (_value: unknown, row) => (
        <Popconfirm title="确认删除该客户配置？" onConfirm={() => handleDeleteCustomerRow(row)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const batchColumns: TableColumnsType<EditableBatchPriorityRow> = [
    {
      title: '集批编码',
      dataIndex: 'batch_code',
      width: 140,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setBatchRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, batch_code: nextValue } : item))
            );
          }}
        />
      ),
    },
    {
      title: '集批名称',
      dataIndex: 'batch_name',
      width: 160,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setBatchRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, batch_name: nextValue } : item))
            );
          }}
        />
      ),
    },
    {
      title: '类型',
      dataIndex: 'priority_type',
      width: 120,
      render: (value: string, row) => (
        <Select
          value={value}
          options={batchPriorityTypeOptions}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setBatchRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, priority_type: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '分值',
      dataIndex: 'priority_score',
      width: 100,
      render: (value: number, row) => (
        <InputNumber
          min={0}
          max={1000}
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setBatchRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, priority_score: nextValue ?? 0 } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value: boolean, row) => (
        <Switch
          checked={value}
          onChange={(checked) => {
            setBatchRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, enabled: checked } : item))
            );
          }}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      render: (value: string | undefined, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setBatchRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, remarks: nextValue } : item))
            );
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      fixed: 'right',
      render: (_value: unknown, row) => (
        <Popconfirm title="确认删除该集批配置？" onConfirm={() => handleDeleteBatchRow(row)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  const productColumns: TableColumnsType<EditableProductTypePriorityRow> = [
    {
      title: '产品大类',
      dataIndex: 'product_type',
      width: 140,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setProductRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, product_type: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '产品名称',
      dataIndex: 'product_name',
      width: 160,
      render: (value: string, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setProductRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, product_name: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '等级',
      dataIndex: 'priority_level',
      width: 120,
      render: (value: string, row) => (
        <Select
          value={value}
          options={productPriorityLevelOptions}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setProductRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, priority_level: nextValue } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '分值',
      dataIndex: 'priority_score',
      width: 100,
      render: (value: number, row) => (
        <InputNumber
          min={0}
          max={1000}
          value={value}
          style={{ width: '100%' }}
          onChange={(nextValue) => {
            setProductRows((prev) =>
              prev.map((item) =>
                item.key === row.key ? { ...item, priority_score: nextValue ?? 0 } : item
              )
            );
          }}
        />
      ),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 90,
      render: (value: boolean, row) => (
        <Switch
          checked={value}
          onChange={(checked) => {
            setProductRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, enabled: checked } : item))
            );
          }}
        />
      ),
    },
    {
      title: '备注',
      dataIndex: 'remarks',
      render: (value: string | undefined, row) => (
        <Input
          value={value}
          onChange={(event) => {
            const nextValue = event.target.value;
            setProductRows((prev) =>
              prev.map((item) => (item.key === row.key ? { ...item, remarks: nextValue } : item))
            );
          }}
        />
      ),
    },
    {
      title: '操作',
      dataIndex: 'action',
      width: 90,
      fixed: 'right',
      render: (_value: unknown, row) => (
        <Popconfirm title="确认删除该产品大类配置？" onConfirm={() => handleDeleteProductRow(row)}>
          <Button type="link" size="small" danger>
            删除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return { weightColumns, dimensionColumns, customerColumns, batchColumns, productColumns };
}

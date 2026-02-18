import { memo } from 'react';
import { Card, Select, Button, Space } from 'antd';
import { SwapOutlined } from '@ant-design/icons';

export interface ComparisonSelectorProps {
  planAId: number | null;
  planBId: number | null;
  planCId: number | null;
  planOptions: { value: number; label: string }[];
  loading: boolean;
  onPlanAChange: (v: number) => void;
  onPlanBChange: (v: number) => void;
  onPlanCChange: (v: number | null) => void;
  onSwapAB: () => void;
  onCompare: () => void;
}

export default memo(function ComparisonSelector({
  planAId,
  planBId,
  planCId,
  planOptions,
  loading,
  onPlanAChange,
  onPlanBChange,
  onPlanCChange,
  onSwapAB,
  onCompare,
}: ComparisonSelectorProps) {
  const filterOption = (input: string, option?: { label: string }) =>
    (option?.label as string)?.toLowerCase().includes(input.toLowerCase());

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space wrap>
        <span style={{ fontWeight: 500 }}>方案 A:</span>
        <Select
          style={{ width: 280 }}
          value={planAId}
          onChange={onPlanAChange}
          placeholder="选择方案 A"
          options={planOptions}
          showSearch
          filterOption={filterOption}
        />
        <Button
          type="text"
          icon={<SwapOutlined />}
          style={{ fontSize: 18, color: '#1677ff' }}
          onClick={onSwapAB}
          title="交换方案 A 和 B"
        />
        <span style={{ fontWeight: 500 }}>方案 B:</span>
        <Select
          style={{ width: 280 }}
          value={planBId}
          onChange={onPlanBChange}
          placeholder="选择方案 B"
          options={planOptions}
          showSearch
          filterOption={filterOption}
        />
        <span style={{ fontWeight: 500 }}>方案 C(可选):</span>
        <Select
          allowClear
          style={{ width: 280 }}
          value={planCId ?? undefined}
          onChange={(v) => onPlanCChange(v ?? null)}
          placeholder="选择方案 C（可选）"
          options={planOptions}
          showSearch
          filterOption={filterOption}
        />
        <Button type="primary" onClick={onCompare} loading={loading}>
          开始对比
        </Button>
      </Space>
    </Card>
  );
});

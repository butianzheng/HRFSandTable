import { memo } from 'react';
import { Table, Switch, Input, InputNumber, Select, Row, Col, Typography } from 'antd';
import type { TemperRules } from '../../types/config';
import { seasonLabels, seasonOrder } from './constants';

const { Text } = Typography;

export interface TemperRulesEditorProps {
  value: TemperRules;
  onChange: (v: TemperRules) => void;
  readOnly?: boolean;
}

export default memo(function TemperRulesEditor({
  value,
  onChange,
  readOnly,
}: TemperRulesEditorProps) {
  const rows = seasonOrder.map((key) => ({
    key,
    months: value.seasons?.[key]?.months ?? [],
    min_days: value.seasons?.[key]?.min_days ?? 0,
    description: value.seasons?.[key]?.description ?? '',
  }));

  const updateSeason = (
    key: string,
    patch: { months?: number[]; min_days?: number; description?: string }
  ) => {
    onChange({
      ...value,
      seasons: {
        ...value.seasons,
        [key]: {
          ...value.seasons?.[key],
          ...patch,
        },
      },
    });
  };

  return (
    <div>
      <Row gutter={12} style={{ marginBottom: 10 }}>
        <Col span={6}>
          <span style={{ marginRight: 8 }}>启用适温筛选</span>
          <Switch
            size="small"
            checked={value.enabled}
            disabled={readOnly}
            onChange={(enabled) => onChange({ ...value, enabled })}
          />
        </Col>
        <Col span={18}>
          {readOnly ? (
            <Text type="secondary">{value.description || '-'}</Text>
          ) : (
            <Input
              size="small"
              value={value.description}
              maxLength={100}
              onChange={(e) => onChange({ ...value, description: e.target.value })}
              placeholder="规则说明"
            />
          )}
        </Col>
      </Row>
      <Table
        size="small"
        pagination={false}
        dataSource={rows}
        rowKey="key"
        columns={[
          {
            title: '季节',
            dataIndex: 'key',
            width: 90,
            render: (v: string) => seasonLabels[v] || v,
          },
          {
            title: '月份',
            dataIndex: 'months',
            width: 280,
            render: (months: number[], row: { key: string }) => {
              if (readOnly) return months.join(', ');
              return (
                <Select
                  mode="multiple"
                  size="small"
                  maxTagCount={6}
                  style={{ width: '100%' }}
                  value={months}
                  onChange={(vals) => {
                    const normalized = Array.from(new Set(vals.map((v) => Number(v))))
                      .filter((v) => Number.isFinite(v) && v >= 1 && v <= 12)
                      .sort((a, b) => a - b);
                    updateSeason(row.key, { months: normalized });
                  }}
                  options={Array.from({ length: 12 }, (_, idx) => ({
                    value: idx + 1,
                    label: `${idx + 1}`,
                  }))}
                />
              );
            },
          },
          {
            title: '最少天数',
            dataIndex: 'min_days',
            width: 120,
            render: (v: number, row: { key: string }) =>
              readOnly ? (
                `${v} 天`
              ) : (
                <InputNumber
                  size="small"
                  min={0}
                  max={30}
                  value={v}
                  addonAfter="天"
                  onChange={(val) => updateSeason(row.key, { min_days: Number(val ?? 0) })}
                />
              ),
          },
          {
            title: '说明',
            dataIndex: 'description',
            render: (v: string, row: { key: string }) =>
              readOnly ? (
                v || '-'
              ) : (
                <Input
                  size="small"
                  value={v}
                  maxLength={30}
                  onChange={(e) => updateSeason(row.key, { description: e.target.value })}
                  placeholder="可选"
                />
              ),
          },
        ]}
      />
    </div>
  );
});

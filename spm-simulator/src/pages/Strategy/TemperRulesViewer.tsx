import { memo } from 'react';
import { Descriptions, Switch, Divider, Table, Typography } from 'antd';
import type { TemperRules } from '../../types/config';
import { seasonLabels } from './constants';

const { Text } = Typography;

export interface TemperRulesViewerProps {
  temperRules: TemperRules | null;
}

export default memo(function TemperRulesViewer({ temperRules }: TemperRulesViewerProps) {
  if (!temperRules) {
    return <Text type="secondary">无适温规则配置</Text>;
  }
  return (
    <div>
      <Descriptions bordered size="small" column={2}>
        <Descriptions.Item label="启用">
          <Switch size="small" checked={temperRules.enabled} disabled />
        </Descriptions.Item>
        <Descriptions.Item label="说明">{temperRules.description || '-'}</Descriptions.Item>
      </Descriptions>
      <Divider plain titlePlacement="left">
        季节配置
      </Divider>
      <Table
        size="small"
        pagination={false}
        dataSource={Object.entries(temperRules.seasons || {}).map(
          ([k, v]) =>
            ({ key: k, ...v }) as {
              key: string;
              months: number[];
              min_days: number;
              description: string;
            }
        )}
        columns={[
          {
            title: '季节',
            dataIndex: 'key',
            width: 80,
            render: (v: string) => seasonLabels[v] || v,
          },
          {
            title: '月份',
            dataIndex: 'months',
            render: (v: number[]) => v?.join(', ') || '-',
          },
          {
            title: '最少天数',
            dataIndex: 'min_days',
            width: 100,
            render: (v: number) => `${v} 天`,
          },
          {
            title: '说明',
            dataIndex: 'description',
            render: (v: string) => v || '-',
          },
        ]}
      />
    </div>
  );
});

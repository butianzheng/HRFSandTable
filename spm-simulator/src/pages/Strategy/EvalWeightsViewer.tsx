import { memo } from 'react';
import { Descriptions, Tag, Typography } from 'antd';
import type { EvalWeight } from './types';
import { evalLabels } from './constants';

const { Text } = Typography;

export interface EvalWeightsViewerProps {
  evalWeights: Record<string, EvalWeight>;
}

export default memo(function EvalWeightsViewer({ evalWeights }: EvalWeightsViewerProps) {
  return (
    <Descriptions bordered size="small" column={2}>
      {Object.entries(evalWeights).map(([k, v]) => (
        <Descriptions.Item key={k} label={evalLabels[k] || k}>
          <Tag color="blue">{v.weight}%</Tag>
          {v.description && (
            <Text type="secondary" style={{ marginLeft: 8 }}>
              {v.description}
            </Text>
          )}
        </Descriptions.Item>
      ))}
    </Descriptions>
  );
});

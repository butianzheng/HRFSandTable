import { memo } from 'react';
import { Tag } from 'antd';
import { severityColorMap, severityLabelMap } from '../constants/schedule';

interface RiskSeverityTagProps {
  severity: string;
  style?: React.CSSProperties;
}

export default memo(function RiskSeverityTag({ severity, style }: RiskSeverityTagProps) {
  return (
    <Tag color={severityColorMap[severity]} style={{ margin: 0, ...style }}>
      {severityLabelMap[severity] || severity}
    </Tag>
  );
});

import { memo } from 'react';
import { Tag } from 'antd';
import { planStatusColorMap, planStatusLabelMap } from '../constants/schedule';

interface PlanStatusTagProps {
  status: string;
  style?: React.CSSProperties;
}

export default memo(function PlanStatusTag({ status, style }: PlanStatusTagProps) {
  return (
    <Tag color={planStatusColorMap[status] || 'default'} style={style}>
      {planStatusLabelMap[status] || status}
    </Tag>
  );
});

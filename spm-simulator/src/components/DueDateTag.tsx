import { memo } from 'react';
import { Tag, Tooltip } from 'antd';
import { dueBucketColorMap, dueBucketLabelMap, type DueBucket } from '../constants/schedule';

interface DueDateTagProps {
  bucket: DueBucket;
  dueDate?: string;
}

export default memo(function DueDateTag({ bucket, dueDate }: DueDateTagProps) {
  return (
    <Tooltip title={dueDate ? `交期 ${dueDate}` : '无交期'}>
      <Tag color={dueBucketColorMap[bucket]} style={{ margin: 0 }}>
        {dueBucketLabelMap[bucket]}
      </Tag>
    </Tooltip>
  );
});

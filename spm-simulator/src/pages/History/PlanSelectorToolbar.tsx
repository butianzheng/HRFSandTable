import { Card, Space, Select, Tag, Button, Tooltip } from 'antd';
import { SwapOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons';
import type { SchedulePlan, PlanVersionItem } from '../../types/schedule';
import {
  planStatusLabelMap as statusLabelMap,
  planStatusColorMap as statusColorMap,
} from '../../constants/schedule';

interface PlanSelectorToolbarProps {
  plans: SchedulePlan[];
  selectedPlanId: number | null;
  currentPlan: SchedulePlan | null;
  versions: PlanVersionItem[];
  compareTargetPlanId: number | null;
  exportingReport: boolean;
  onPlanChange: (planId: number) => void;
  onCompareVersions: () => void;
  onOpenExportPreview: () => void;
  onRefresh: () => void;
}

export default function PlanSelectorToolbar({
  plans,
  selectedPlanId,
  currentPlan,
  versions,
  compareTargetPlanId,
  exportingReport,
  onPlanChange,
  onCompareVersions,
  onOpenExportPreview,
  onRefresh,
}: PlanSelectorToolbarProps) {
  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space>
        <span style={{ fontWeight: 500 }}>选择方案:</span>
        <Select
          style={{ width: 360 }}
          value={selectedPlanId}
          onChange={onPlanChange}
          placeholder="选择排程方案"
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          options={plans.map((p) => ({
            value: p.id,
            label: `${p.name} (${p.plan_no}) ${p.score_overall != null ? `[${p.score_overall}分]` : ''}`,
          }))}
        />
        {currentPlan && (
          <>
            <Tag color={statusColorMap[currentPlan.status || ''] || 'default'}>
              {statusLabelMap[currentPlan.status || ''] || currentPlan.status}
            </Tag>
            {compareTargetPlanId && (
              <Tag color="purple">
                对比目标: v{versions.find((v) => v.plan_id === compareTargetPlanId)?.version ?? '-'}
              </Tag>
            )}
            <Button
              size="small"
              icon={<SwapOutlined />}
              disabled={!compareTargetPlanId}
              onClick={onCompareVersions}
            >
              版本对比
            </Button>
            <Tooltip title="导出内容含 versions / version_stats / version_delta / sequence_diff / risk_diff / logs">
              <Button
                size="small"
                icon={<DownloadOutlined />}
                loading={exportingReport}
                onClick={onOpenExportPreview}
              >
                导出报告
              </Button>
            </Tooltip>
            <Button size="small" icon={<ReloadOutlined />} onClick={onRefresh}>
              刷新
            </Button>
          </>
        )}
      </Space>
    </Card>
  );
}

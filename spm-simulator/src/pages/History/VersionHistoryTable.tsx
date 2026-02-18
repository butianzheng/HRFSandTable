import { memo, useMemo } from 'react';
import { Card, Space, Table, Tag, Badge, Tooltip, Popconfirm, Button, Empty, Spin } from 'antd';
import type { TableColumnsType } from 'antd';
import { BranchesOutlined, CheckCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import type { PlanVersionItem } from '../../types/schedule';
import {
  planStatusLabelMap as statusLabelMap,
  planStatusColorMap as statusColorMap,
  scoreColor,
} from '../../constants/schedule';

interface VersionHistoryTableProps {
  versions: PlanVersionItem[];
  selectedPlanId: number | null;
  compareTargetPlanId: number | null;
  rollbackingId: number | null;
  loadingVersions: boolean;
  onSelectPlan: (planId: number) => void;
  onSetCompareTarget: (planId: number) => void;
  onRollback: (planId: number) => void;
}

export default memo(function VersionHistoryTable({
  versions,
  selectedPlanId,
  compareTargetPlanId,
  rollbackingId,
  loadingVersions,
  onSelectPlan,
  onSetCompareTarget,
  onRollback,
}: VersionHistoryTableProps) {
  const versionColumns = useMemo<TableColumnsType<PlanVersionItem>>(
    () => [
      {
        title: '版本',
        dataIndex: 'version',
        width: 60,
        align: 'center',
        render: (v: number, row: PlanVersionItem) => (
          <Badge
            count={`v${v}`}
            style={{
              backgroundColor: row.plan_id === selectedPlanId ? '#1677ff' : '#d9d9d9',
              fontSize: 11,
            }}
          />
        ),
      },
      {
        title: '方案名称',
        dataIndex: 'name',
        ellipsis: true,
        render: (v: string, row: PlanVersionItem) => (
          <Tooltip title={row.plan_no}>
            <span style={{ fontWeight: row.plan_id === selectedPlanId ? 600 : 400 }}>{v}</span>
          </Tooltip>
        ),
      },
      {
        title: '状态',
        dataIndex: 'status',
        width: 80,
        align: 'center',
        render: (v: string) => (
          <Tag color={statusColorMap[v] || 'default'}>{statusLabelMap[v] || v}</Tag>
        ),
      },
      {
        title: '评分',
        dataIndex: 'score_overall',
        width: 60,
        align: 'center',
        render: (v: number) => (
          <span style={{ color: scoreColor(v), fontWeight: 600 }}>{v || '-'}</span>
        ),
      },
      {
        title: '排程数',
        dataIndex: 'total_count',
        width: 70,
        align: 'right',
      },
      {
        title: '总重量',
        dataIndex: 'total_weight',
        width: 80,
        align: 'right',
        render: (v: number) => `${v.toFixed(0)}t`,
      },
      {
        title: '风险',
        width: 100,
        render: (_: unknown, row: PlanVersionItem) => (
          <Space size={4}>
            {row.risk_high > 0 && <Tag color="red">{row.risk_high}高</Tag>}
            {row.risk_medium > 0 && <Tag color="orange">{row.risk_medium}中</Tag>}
            {row.risk_low > 0 && <Tag color="blue">{row.risk_low}低</Tag>}
            {row.risk_high === 0 && row.risk_medium === 0 && row.risk_low === 0 && (
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
            )}
          </Space>
        ),
      },
      {
        title: '创建时间',
        dataIndex: 'created_at',
        width: 140,
        render: (v: string) => (v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '-'),
      },
      {
        title: '操作',
        width: 96,
        align: 'center',
        render: (_: unknown, row: PlanVersionItem) => {
          if (row.plan_id === selectedPlanId) {
            return <Tag color="blue">当前</Tag>;
          }
          const currentVersion = versions.find((v) => v.plan_id === selectedPlanId);
          const scoreDiff = currentVersion ? row.score_overall - currentVersion.score_overall : 0;
          const riskDiff = currentVersion
            ? row.risk_high +
              row.risk_medium +
              row.risk_low -
              (currentVersion.risk_high + currentVersion.risk_medium + currentVersion.risk_low)
            : 0;
          return (
            <Popconfirm
              title={
                <div>
                  <div>{`确认回滚到 v${row.version}？`}</div>
                  {currentVersion && (
                    <div style={{ fontSize: 12, color: '#595959', marginTop: 4 }}>
                      <span>
                        评分: {currentVersion.score_overall} → {row.score_overall}
                      </span>
                      <span
                        style={{
                          color: scoreDiff > 0 ? '#52c41a' : scoreDiff < 0 ? '#ff4d4f' : '#8c8c8c',
                          marginLeft: 4,
                        }}
                      >
                        ({scoreDiff > 0 ? `+${scoreDiff}` : scoreDiff})
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        排程: {currentVersion.total_count} → {row.total_count}
                      </span>
                      <span style={{ marginLeft: 8 }}>
                        风险:{' '}
                        {currentVersion.risk_high +
                          currentVersion.risk_medium +
                          currentVersion.risk_low}{' '}
                        → {row.risk_high + row.risk_medium + row.risk_low}
                      </span>
                      <span
                        style={{
                          color: riskDiff < 0 ? '#52c41a' : riskDiff > 0 ? '#ff4d4f' : '#8c8c8c',
                          marginLeft: 4,
                        }}
                      >
                        ({riskDiff > 0 ? `+${riskDiff}` : riskDiff})
                      </span>
                    </div>
                  )}
                </div>
              }
              onConfirm={() => onRollback(row.plan_id)}
            >
              <Button
                type="link"
                size="small"
                loading={rollbackingId === row.plan_id}
                onClick={(e) => e.stopPropagation()}
              >
                回滚
              </Button>
            </Popconfirm>
          );
        },
      },
      {
        title: '对比',
        width: 90,
        align: 'center',
        render: (_: unknown, row: PlanVersionItem) => (
          <Button
            type="link"
            size="small"
            disabled={row.plan_id === selectedPlanId}
            onClick={(e) => {
              e.stopPropagation();
              onSetCompareTarget(row.plan_id);
            }}
          >
            {compareTargetPlanId === row.plan_id ? '已选择' : '设为对比'}
          </Button>
        ),
      },
    ],
    [selectedPlanId, versions, compareTargetPlanId, rollbackingId, onRollback, onSetCompareTarget]
  );

  return (
    <Card
      title={
        <Space>
          <BranchesOutlined />
          <span>版本历史 ({versions.length}个版本)</span>
        </Space>
      }
      size="small"
      styles={{ body: { padding: 0 } }}
    >
      <Spin spinning={loadingVersions}>
        {versions.length > 0 ? (
          <Table
            size="small"
            dataSource={versions}
            columns={versionColumns}
            rowKey="plan_id"
            pagination={false}
            scroll={{ y: 400 }}
            rowClassName={(record) =>
              record.plan_id === selectedPlanId ? 'ant-table-row-selected' : ''
            }
            onRow={(record) => ({
              onClick: () => onSelectPlan(record.plan_id),
              style: { cursor: 'pointer' },
            })}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="当前方案无版本记录"
            style={{ padding: 32 }}
          />
        )}
      </Spin>
    </Card>
  );
});

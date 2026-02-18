import { memo } from 'react';
import { Card, Space, Table, Tag, Button } from 'antd';
import type { TableColumnsType } from 'antd';
import { WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';

import type { RiskAnalysis, RiskViolationItem } from '../../types/schedule';
import type { RiskViolationRow } from './types';

interface ViolationListPanelProps {
  analysis: RiskAnalysis;
  filteredViolations: RiskViolationRow[];
  columns: TableColumnsType<RiskViolationItem>;
  enableVirtual: boolean;
  activeFilterTags: string[];
  onResetFilters: () => void;
  onLocateRisk: (row: RiskViolationRow) => void;
}

export default memo(function ViolationListPanel({
  analysis,
  filteredViolations,
  columns,
  enableVirtual,
  activeFilterTags,
  onResetFilters,
  onLocateRisk,
}: ViolationListPanelProps) {
  return (
    <Card
      title={
        <Space>
          <WarningOutlined />
          <span>
            风险问题清单 ({filteredViolations.length}
            {filteredViolations.length !== analysis.violations.length
              ? `/${analysis.violations.length}`
              : ''}
            项)
          </span>
        </Space>
      }
      size="small"
      styles={{ body: { padding: 0 } }}
      extra={
        <Space size={4} wrap>
          {activeFilterTags.length > 0 ? (
            <>
              {activeFilterTags.map((tag) => (
                <Tag key={tag} color="processing" style={{ margin: 0 }}>
                  {tag}
                </Tag>
              ))}
              <Button type="link" size="small" onClick={onResetFilters}>
                清空筛选
              </Button>
            </>
          ) : (
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>提示：双击行可定位到工作台</span>
          )}
        </Space>
      }
    >
      {analysis.violations.length > 0 ? (
        <Table
          size="small"
          dataSource={filteredViolations}
          columns={columns}
          rowKey={(row) => String((row as RiskViolationRow).risk_index)}
          pagination={{ pageSize: 10, size: 'small' }}
          virtual={enableVirtual}
          scroll={{ y: 400 }}
          onRow={(record) => ({
            style: (record as RiskViolationRow).ignored
              ? { opacity: 0.45, textDecoration: 'line-through' }
              : undefined,
            onDoubleClick: () => onLocateRisk(record as RiskViolationRow),
          })}
        />
      ) : (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
          <div style={{ marginTop: 8, color: '#52c41a' }}>当前方案无约束违规</div>
        </div>
      )}
    </Card>
  );
});

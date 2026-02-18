import { Card, Space, Tag, Button, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { buildSettingsLinkFromRiskChip } from '../../utils/riskConfig';
import type { RiskConfigHitChip } from '../../utils/riskConfig';

interface RiskConfigHitCardProps {
  chips: RiskConfigHitChip[];
  riskConstraintFilter: string;
  riskDueFilter: string;
  onToggleFilter: (chip: RiskConfigHitChip) => void;
  onResetFilters: () => void;
}

export default function RiskConfigHitCard({
  chips,
  riskConstraintFilter,
  riskDueFilter,
  onToggleFilter,
  onResetFilters,
}: RiskConfigHitCardProps) {
  const navigate = useNavigate();

  if (chips.length === 0) {
    return null;
  }

  return (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space size={[6, 6]} wrap>
        <Tag color="blue" style={{ margin: 0 }}>
          配置命中解释
        </Tag>
        {chips.map((chip) => {
          const active =
            chip.type === 'constraint'
              ? riskConstraintFilter === chip.value
              : riskDueFilter === chip.value;
          const settingsLink = buildSettingsLinkFromRiskChip(chip);
          return (
            <Tooltip key={chip.key} title={settingsLink ? '单击筛选，双击跳转配置' : '单击筛选'}>
              <Tag
                color={active ? 'processing' : 'default'}
                style={{ margin: 0, cursor: 'pointer' }}
                onClick={() => onToggleFilter(chip)}
                onDoubleClick={() => {
                  if (!settingsLink) return;
                  navigate(settingsLink);
                }}
              >
                {chip.label} {chip.count}
              </Tag>
            </Tooltip>
          );
        })}
        {(riskConstraintFilter !== 'all' || riskDueFilter !== 'all') && (
          <Button type="link" size="small" onClick={onResetFilters}>
            清除命中筛选
          </Button>
        )}
        <span style={{ color: '#8c8c8c', fontSize: 12 }}>点击标签可筛出受影响材料</span>
      </Space>
    </Card>
  );
}

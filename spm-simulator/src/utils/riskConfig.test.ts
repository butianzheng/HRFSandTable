import { describe, expect, it } from 'vitest';

import {
  buildSettingsLinkFromRiskChip,
  collectRiskConfigHitEntries,
  buildRiskConfigHitChips,
  nextRiskConfigHitFilters,
  type RiskConfigHitChip,
  type RiskConfigHitWorkerRow,
} from './riskConfig';

function chip(partial: Partial<RiskConfigHitChip>): RiskConfigHitChip {
  return {
    key: partial.key ?? 'k',
    label: partial.label ?? 'l',
    count: partial.count ?? 1,
    type: partial.type ?? 'constraint',
    value: partial.value ?? 'temp_status_filter',
  };
}

describe('riskConfig utils', () => {
  it('collectRiskConfigHitEntries 按 material 去重并统计命中', () => {
    const rows: RiskConfigHitWorkerRow[] = [
      { constraint_type: 'temp_status_filter', material_id: 1, due_bucket: 'in3' },
      { constraint_type: 'temp_status_filter', material_id: 1, due_bucket: 'in3' },
      { constraint_type: 'temp_status_filter', material_id: 2, due_bucket: 'in3' },
      { constraint_type: 'width_jump', material_id: 2, due_bucket: 'in7' },
      { constraint_type: 'width_jump', material_id: 3, due_bucket: 'later' },
      { constraint_type: 'shift_capacity', material_id: 4 },
    ];
    const entries = collectRiskConfigHitEntries(rows);
    expect(entries).toContainEqual(['constraint:temp_status_filter', 2]);
    expect(entries).toContainEqual(['constraint:width_jump', 2]);
    expect(entries).toContainEqual(['constraint:shift_capacity', 1]);
    expect(entries).toContainEqual(['due:in3', 2]);
    expect(entries).toContainEqual(['due:in7', 1]);
    expect(entries).toContainEqual(['due:later', 1]);
    expect(entries).toContainEqual(['due:none', 1]);
  });

  it('buildRiskConfigHitChips 构建可展示标签', () => {
    const chips = buildRiskConfigHitChips(
      [
        ['constraint:temp_status_filter', 2],
        ['due:overdue', 1],
        ['due:unknown', 3],
      ],
      { temp_status_filter: '适温状态' },
      { overdue: '已超期', in3: '3天内', in7: '7天内', later: '7天后', none: '无交期' }
    );
    expect(chips).toEqual([
      {
        key: 'constraint:temp_status_filter',
        label: '约束:适温状态',
        count: 2,
        type: 'constraint',
        value: 'temp_status_filter',
      },
      { key: 'due:overdue', label: '交期:已超期', count: 1, type: 'due', value: 'overdue' },
      { key: 'due:none', label: '交期:无交期', count: 3, type: 'due', value: 'none' },
    ]);
  });

  it('nextRiskConfigHitFilters 支持点击切换筛选', () => {
    const byConstraint = nextRiskConfigHitFilters(
      'all',
      'all',
      chip({ key: 'constraint:width_jump', type: 'constraint', value: 'width_jump' })
    );
    expect(byConstraint).toEqual({ constraintFilter: 'width_jump', dueFilter: 'all' });

    const resetConstraint = nextRiskConfigHitFilters(
      'width_jump',
      'all',
      chip({ key: 'constraint:width_jump', type: 'constraint', value: 'width_jump' })
    );
    expect(resetConstraint).toEqual({ constraintFilter: 'all', dueFilter: 'all' });

    const byDue = nextRiskConfigHitFilters(
      'all',
      'all',
      chip({ key: 'due:in7', type: 'due', value: 'in7' })
    );
    expect(byDue).toEqual({ constraintFilter: 'all', dueFilter: 'in7' });

    const resetDue = nextRiskConfigHitFilters(
      'all',
      'in7',
      chip({ key: 'due:in7', type: 'due', value: 'in7' })
    );
    expect(resetDue).toEqual({ constraintFilter: 'all', dueFilter: 'all' });
  });

  it('交期命中标签映射到优先级配置链接', () => {
    expect(buildSettingsLinkFromRiskChip(chip({ type: 'due', value: 'overdue' }))).toBe(
      '/settings?tab=priority&priorityKey=delivery%3Aoverdue'
    );
    expect(buildSettingsLinkFromRiskChip(chip({ type: 'due', value: 'in3' }))).toBe(
      '/settings?tab=priority&priorityKey=delivery%3AD%2B7'
    );
    expect(buildSettingsLinkFromRiskChip(chip({ type: 'due', value: 'later' }))).toBe(
      '/settings?tab=priority&priorityKey=delivery%3Anext_period'
    );
    expect(buildSettingsLinkFromRiskChip(chip({ type: 'due', value: 'unknown' }))).toBe(
      '/settings?tab=priority&priorityKey=delivery%3Ano_requirement'
    );
  });

  it('约束命中标签映射到对应配置入口', () => {
    expect(
      buildSettingsLinkFromRiskChip(chip({ type: 'constraint', value: 'temp_status_filter' }))
    ).toBe('/settings?tab=temp');
    expect(buildSettingsLinkFromRiskChip(chip({ type: 'constraint', value: 'width_jump' }))).toBe(
      '/strategy'
    );
    expect(
      buildSettingsLinkFromRiskChip(chip({ type: 'constraint', value: 'shift_capacity' }))
    ).toBe('/strategy');
    expect(
      buildSettingsLinkFromRiskChip(chip({ type: 'constraint', value: 'roll_change_tonnage' }))
    ).toBe('/strategy');
    expect(
      buildSettingsLinkFromRiskChip(chip({ type: 'constraint', value: 'overdue_priority' }))
    ).toBe('/settings?tab=priority&priorityKey=delivery%3Aoverdue');
    expect(
      buildSettingsLinkFromRiskChip(chip({ type: 'constraint', value: 'unknown' }))
    ).toBeNull();
  });
});

export interface RiskConfigHitChip {
  key: string;
  label: string;
  count: number;
  type: 'constraint' | 'due';
  value: string;
}

export type RiskDueBucket = 'overdue' | 'in3' | 'in7' | 'later' | 'none';

export interface RiskConfigHitWorkerRow {
  constraint_type: string;
  material_id: number;
  due_bucket?: RiskDueBucket;
}

export function collectRiskConfigHitEntries(
  rows: RiskConfigHitWorkerRow[]
): Array<[string, number]> {
  const constraintMaterialMap = new Map<string, Set<number>>();
  const dueMaterialMap = new Map<RiskDueBucket, Set<number>>();

  rows.forEach((row) => {
    const constraintSet = constraintMaterialMap.get(row.constraint_type) ?? new Set<number>();
    constraintSet.add(row.material_id);
    constraintMaterialMap.set(row.constraint_type, constraintSet);

    const dueBucket = row.due_bucket ?? 'none';
    const dueSet = dueMaterialMap.get(dueBucket) ?? new Set<number>();
    dueSet.add(row.material_id);
    dueMaterialMap.set(dueBucket, dueSet);
  });

  const constraintEntries: Array<[string, number]> = Array.from(constraintMaterialMap.entries())
    .map(([constraintType, set]): [string, number] => [`constraint:${constraintType}`, set.size])
    .sort((a, b) => b[1] - a[1]);

  const dueEntries: Array<[string, number]> = Array.from(dueMaterialMap.entries())
    .map(([bucket, set]): [string, number] => [`due:${bucket}`, set.size])
    .sort((a, b) => b[1] - a[1]);

  return [...constraintEntries, ...dueEntries];
}

export function buildRiskConfigHitChips(
  entries: Array<[string, number]>,
  constraintLabelMap: Record<string, string>,
  dueBucketLabelMap: Record<RiskDueBucket, string>
): RiskConfigHitChip[] {
  const chips: RiskConfigHitChip[] = [];

  entries.forEach(([key, count]) => {
    if (count <= 0) return;
    const [prefix, rawValue = ''] = key.split(':', 2);
    if (!rawValue) return;
    if (prefix === 'constraint') {
      chips.push({
        key,
        label: `约束:${constraintLabelMap[rawValue] || rawValue}`,
        count,
        type: 'constraint',
        value: rawValue,
      });
      return;
    }
    if (prefix === 'due') {
      const bucket: RiskDueBucket =
        rawValue === 'overdue' ||
        rawValue === 'in3' ||
        rawValue === 'in7' ||
        rawValue === 'later' ||
        rawValue === 'none'
          ? rawValue
          : 'none';
      chips.push({
        key: `due:${bucket}`,
        label: `交期:${dueBucketLabelMap[bucket]}`,
        count,
        type: 'due',
        value: bucket,
      });
    }
  });

  return chips;
}

export function nextRiskConfigHitFilters(
  currentConstraintFilter: string,
  currentDueFilter: 'all' | RiskDueBucket,
  chip: RiskConfigHitChip
): {
  constraintFilter: string;
  dueFilter: 'all' | RiskDueBucket;
} {
  if (chip.type === 'constraint') {
    return {
      constraintFilter: currentConstraintFilter === chip.value ? 'all' : chip.value,
      dueFilter: currentDueFilter,
    };
  }
  const dueValue = chip.value as RiskDueBucket;
  return {
    constraintFilter: currentConstraintFilter,
    dueFilter: currentDueFilter === dueValue ? 'all' : dueValue,
  };
}

export function buildSettingsLinkFromRiskChip(chip: RiskConfigHitChip): string | null {
  if (chip.type === 'due') {
    const dueToPriorityKey: Record<string, string> = {
      overdue: 'delivery:overdue',
      in3: 'delivery:D+7',
      in7: 'delivery:D+7',
      later: 'delivery:next_period',
      none: 'delivery:no_requirement',
    };
    const priorityKey = dueToPriorityKey[chip.value] ?? 'delivery:no_requirement';
    return `/settings?tab=priority&priorityKey=${encodeURIComponent(priorityKey)}`;
  }

  const constraintTabMap: Record<string, string> = {
    temp_status_filter: 'temp',
  };
  const strategyManagedConstraints = new Set([
    'width_jump',
    'shift_capacity',
    'roll_change_tonnage',
    'roll_change_duration',
    'thickness_jump',
  ]);
  if (chip.value === 'overdue_priority') {
    return `/settings?tab=priority&priorityKey=${encodeURIComponent('delivery:overdue')}`;
  }
  if (strategyManagedConstraints.has(chip.value)) {
    return '/strategy';
  }
  const targetTab = constraintTabMap[chip.value];
  return targetTab ? `/settings?tab=${encodeURIComponent(targetTab)}` : null;
}

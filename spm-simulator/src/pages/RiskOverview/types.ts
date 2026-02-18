import type { RiskAnalysis, RiskViolationItem } from '../../types/schedule';

export interface RiskViolationRow extends RiskViolationItem {
  risk_index: number;
}

export interface RiskSnapshot {
  total: number;
  high: number;
  medium: number;
  low: number;
  overdue: number;
}

export interface BlockedReasonEntry {
  reasonCode: string;
  signature: string;
}

export interface RiskApplySummary {
  mode: 'single' | 'batch';
  requested: number;
  changed: number;
  at: string;
  notes: string[];
  blockedReasons: Record<string, number>;
  blockedEntries: BlockedReasonEntry[];
  before: RiskSnapshot;
  after: RiskSnapshot;
}

export interface RiskConfigHitWorkerResponse {
  id: number;
  entries: Array<[string, number]>;
}

export function buildRiskSnapshot(data: RiskAnalysis): RiskSnapshot {
  return {
    total: data.violations.length,
    high: data.risk_high,
    medium: data.risk_medium,
    low: data.risk_low,
    overdue: data.overdue_count,
  };
}

export function buildRiskSignature(item: {
  constraint_type: string;
  material_id: number;
  sequence: number;
  coil_id: string;
}): string {
  return `${item.constraint_type}|${item.material_id}|${item.sequence}|${item.coil_id}`;
}

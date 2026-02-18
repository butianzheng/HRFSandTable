import type { SequenceChangeItem } from '../../types/schedule';

export interface ThreeModeSequencePair {
  key: string;
  label: string;
  plan_a_id: number;
  plan_b_id: number;
  plan_a_label: string;
  plan_b_label: string;
  changes: SequenceChangeItem[];
}

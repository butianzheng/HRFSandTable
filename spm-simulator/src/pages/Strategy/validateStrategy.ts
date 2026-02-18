import { message } from 'antd';
import type { SortPriority, HardConstraint, SoftConstraint, TemperRules } from '../../types/config';
import type { EvalWeight } from './types';
import { fieldLabels, evalLabels } from './constants';

export interface ValidateStrategyInput {
  sortWeights: SortPriority[];
  hardConstraints: HardConstraint[];
  softConstraints: SoftConstraint[];
  evalWeights: Record<string, EvalWeight>;
  temperRules: TemperRules;
}

/** Validates all strategy template fields before save. Returns true if valid. */
export function validateStrategy({
  sortWeights,
  hardConstraints,
  softConstraints,
  evalWeights,
  temperRules: _temperRules,
}: ValidateStrategyInput): boolean {
  const enabledSorts = sortWeights.filter((item) => item.enabled);
  if (enabledSorts.length === 0) {
    message.error('至少启用一个排序规则');
    return false;
  }
  for (const item of enabledSorts) {
    if (!Number.isFinite(item.weight) || item.weight < 0 || item.weight > 100) {
      message.error(`排序规则「${fieldLabels[item.field] || item.field}」权重需在 0-100`);
      return false;
    }
  }

  for (const item of hardConstraints.filter((c) => c.enabled)) {
    const title = item.name || item.type;
    if (item.max_value !== undefined && (!Number.isFinite(item.max_value) || item.max_value < 0)) {
      message.error(`硬约束「${title}」阈值必须为非负数字`);
      return false;
    }
    if (item.value !== undefined && (!Number.isFinite(item.value) || item.value < 0)) {
      message.error(`硬约束「${title}」参数必须为非负数字`);
      return false;
    }
    if (item.max_days !== undefined && (!Number.isFinite(item.max_days) || item.max_days < 0)) {
      message.error(`硬约束「${title}」天数必须为非负数字`);
      return false;
    }
    const maxValue = item.max_value ?? Number.NaN;
    const fixedValue = item.value ?? Number.NaN;
    if (
      (item.type === 'width_jump' ||
        item.type === 'roll_change_tonnage' ||
        item.type === 'shift_capacity') &&
      !(Number.isFinite(maxValue) && maxValue > 0)
    ) {
      message.error(`硬约束「${title}」阈值需大于 0`);
      return false;
    }
    if (item.type === 'roll_change_duration' && !(Number.isFinite(fixedValue) && fixedValue > 0)) {
      message.error(`硬约束「${title}」时长需大于 0`);
      return false;
    }
  }

  for (const item of softConstraints.filter((c) => c.enabled)) {
    const title = item.name || item.type;
    if (item.penalty !== undefined && (!Number.isFinite(item.penalty) || item.penalty < 0)) {
      message.error(`软约束「${title}」惩罚分必须为非负数字`);
      return false;
    }
    if (item.bonus !== undefined && (!Number.isFinite(item.bonus) || item.bonus < 0)) {
      message.error(`软约束「${title}」奖励分必须为非负数字`);
      return false;
    }
    if (item.threshold !== undefined && (!Number.isFinite(item.threshold) || item.threshold < 0)) {
      message.error(`软约束「${title}」阈值必须为非负数字`);
      return false;
    }
  }

  const evalEntries = Object.entries(evalWeights);
  if (evalEntries.length === 0) {
    message.error('评估权重不能为空');
    return false;
  }
  let evalSum = 0;
  for (const [key, item] of evalEntries) {
    if (!Number.isFinite(item.weight) || item.weight < 0 || item.weight > 100) {
      message.error(`评估项「${evalLabels[key] || key}」权重需在 0-100`);
      return false;
    }
    evalSum += item.weight;
  }
  if (Math.abs(evalSum - 100) > 0.001) {
    message.error(`评估权重总和需为 100，当前为 ${evalSum.toFixed(2)}`);
    return false;
  }

  return true;
}

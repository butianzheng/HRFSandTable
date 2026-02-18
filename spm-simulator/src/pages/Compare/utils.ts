import type { PlanComparisonSide } from '../../types/schedule';

export function riskScore(side: PlanComparisonSide): number {
  return side.risk_high * 100 + side.risk_medium * 10 + side.risk_low;
}

export function comparePlanQuality(a: PlanComparisonSide, b: PlanComparisonSide): number {
  const scoreDiff = b.score_overall - a.score_overall;
  if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

  const riskDiff = riskScore(a) - riskScore(b);
  if (riskDiff !== 0) return riskDiff;

  const rollDiff = a.roll_change_count - b.roll_change_count;
  if (rollDiff !== 0) return rollDiff;

  const switchDiff = a.steel_grade_switches - b.steel_grade_switches;
  if (switchDiff !== 0) return switchDiff;

  return b.total_weight - a.total_weight;
}

export function buildRecommendReason(best: PlanComparisonSide, other: PlanComparisonSide): string {
  if (Math.abs(best.score_overall - other.score_overall) > 0.001) {
    return `综合评分更高（${best.score_overall} vs ${other.score_overall}）`;
  }
  const bestRisk = riskScore(best);
  const otherRisk = riskScore(other);
  if (bestRisk !== otherRisk) {
    return `风险更低（高/中/低：${best.risk_high}/${best.risk_medium}/${best.risk_low}）`;
  }
  if (best.roll_change_count !== other.roll_change_count) {
    return `换辊次数更少（${best.roll_change_count} vs ${other.roll_change_count}）`;
  }
  if (best.steel_grade_switches !== other.steel_grade_switches) {
    return `钢种切换更少（${best.steel_grade_switches} vs ${other.steel_grade_switches}）`;
  }
  return '综合表现更优';
}

import { describe, expect, it } from 'vitest';

import {
  calcPriorityContractCode,
  calcPriorityDeliveryCode,
  collectPriorityHitCountEntries,
  isAssessmentContract,
  matchesPriorityHitFilter,
  nextPriorityHitFilter,
  type PriorityHitCodeSets,
} from './priorityHit';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}T12:00:00`;
}

function offsetDate(base: Date, days: number): string {
  const target = new Date(base);
  target.setDate(target.getDate() + days);
  return formatLocalDate(target);
}

describe('priorityHit utils', () => {
  const now = new Date(2026, 1, 13, 12, 0, 0);

  it('calcPriorityDeliveryCode 按交期区间返回编码', () => {
    expect(calcPriorityDeliveryCode(undefined, now)).toBe('no_requirement');
    expect(calcPriorityDeliveryCode('invalid-date', now)).toBe('no_requirement');
    expect(calcPriorityDeliveryCode(offsetDate(now, 0), now)).toBe('D+0');
    expect(calcPriorityDeliveryCode(offsetDate(now, -1), now)).toBe('overdue');
    expect(calcPriorityDeliveryCode(offsetDate(now, -31), now)).toBe('super_overdue');
    expect(calcPriorityDeliveryCode(offsetDate(now, -61), now)).toBe('double_overdue');
    expect(calcPriorityDeliveryCode(offsetDate(now, 7), now)).toBe('D+7');
    expect(calcPriorityDeliveryCode(offsetDate(now, 10), now)).toBe('current_period');
    expect(calcPriorityDeliveryCode(offsetDate(now, 20), now)).toBe('next_period');
    expect(calcPriorityDeliveryCode(offsetDate(now, 60), now)).toBe('no_requirement');
  });

  it('calcPriorityContractCode 返回合同分类编码', () => {
    expect(calcPriorityContractCode({ export_flag: true, contract_attr: '现货' })).toBe(
      'export_contract'
    );
    expect(calcPriorityContractCode({ contract_attr: '期货' })).toBe('futures_contract');
    expect(calcPriorityContractCode({ contract_attr: 'spot' })).toBe('spot_contract');
    expect(calcPriorityContractCode({ contract_attr: 'transition' })).toBe('transition_contract');
    expect(calcPriorityContractCode({ contract_attr: '其他' })).toBe('other');
  });

  it('isAssessmentContract 仅在需评估合同且有交期时返回 true', () => {
    expect(isAssessmentContract({ contract_nature: '订单', due_date: offsetDate(now, 1) })).toBe(
      true
    );
    expect(
      isAssessmentContract({ contract_nature: '框架订单', due_date: offsetDate(now, 2) })
    ).toBe(true);
    expect(isAssessmentContract({ contract_nature: '订单' })).toBe(false);
    expect(isAssessmentContract({ contract_nature: '库存材', due_date: offsetDate(now, 2) })).toBe(
      false
    );
  });

  it('collectPriorityHitCountEntries 统计各维命中', () => {
    const codeSets: PriorityHitCodeSets = {
      customerCodes: new Set(['C1']),
      batchCodes: new Set(['B1']),
      productTypeCodes: new Set(['P1']),
    };
    const materials = [
      {
        due_date: offsetDate(now, 1),
        contract_nature: '订单',
        contract_attr: '期货',
        customer_code: 'C1',
        batch_code: 'B1',
        product_type: 'P2',
      },
      {
        contract_nature: '库存材',
        contract_attr: '现货',
        customer_code: 'C2',
        batch_code: '',
        product_type: 'P1',
      },
    ];

    const entries = collectPriorityHitCountEntries(materials, codeSets);
    expect(entries).toContainEqual(['assessment:assessed', 1]);
    expect(entries).toContainEqual(['assessment:not_assessed', 1]);
    expect(entries).toContainEqual(['customer:C1', 1]);
    expect(entries).toContainEqual(['customer:default', 1]);
    expect(entries).toContainEqual(['batch:B1', 1]);
    expect(entries).toContainEqual(['batch:default', 1]);
    expect(entries).toContainEqual(['product_type:P1', 1]);
    expect(entries).toContainEqual(['product_type:default', 1]);
    const deliveryTotal = entries
      .filter(([key]) => key.startsWith('delivery:'))
      .reduce((sum, [, count]) => sum + count, 0);
    expect(deliveryTotal).toBe(materials.length);
  });

  it('matchesPriorityHitFilter 支持优先级命中筛选', () => {
    const codeSets: PriorityHitCodeSets = {
      customerCodes: new Set(['C1']),
      batchCodes: new Set(['B1']),
      productTypeCodes: new Set(['P1']),
    };
    const material = {
      due_date: offsetDate(now, 1),
      contract_nature: '订单',
      contract_attr: '期货',
      customer_code: 'C1',
      batch_code: '',
      product_type: 'PX',
    };

    expect(matchesPriorityHitFilter(material, 'all', codeSets, now)).toBe(true);
    expect(matchesPriorityHitFilter(material, 'assessment:assessed', codeSets, now)).toBe(true);
    expect(matchesPriorityHitFilter(material, 'assessment:not_assessed', codeSets, now)).toBe(
      false
    );
    expect(matchesPriorityHitFilter(material, 'delivery:D+7', codeSets, now)).toBe(true);
    expect(matchesPriorityHitFilter(material, 'contract:futures_contract', codeSets, now)).toBe(
      true
    );
    expect(matchesPriorityHitFilter(material, 'customer:C1', codeSets, now)).toBe(true);
    expect(matchesPriorityHitFilter(material, 'customer:default', codeSets, now)).toBe(false);
    expect(matchesPriorityHitFilter(material, 'batch:default', codeSets, now)).toBe(true);
    expect(matchesPriorityHitFilter(material, 'product_type:default', codeSets, now)).toBe(true);
    expect(matchesPriorityHitFilter(material, 'unknown:xxx', codeSets, now)).toBe(true);
  });

  it('nextPriorityHitFilter 支持点击切换筛选', () => {
    expect(nextPriorityHitFilter('all', 'delivery:D+7')).toBe('delivery:D+7');
    expect(nextPriorityHitFilter('delivery:D+7', 'delivery:D+7')).toBe('all');
  });
});

export interface PriorityHitMaterial {
  due_date?: string;
  contract_nature?: string;
  export_flag?: boolean;
  contract_attr?: string;
  customer_code?: string;
  batch_code?: string;
  product_type?: string;
}

export function calcPriorityDeliveryCode(dueDate?: string, nowDate?: Date): string {
  if (!dueDate) return 'no_requirement';
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return 'no_requirement';
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const now = nowDate ?? new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((dueStart - todayStart) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) {
    const overdueDays = -diffDays;
    if (overdueDays > 60) return 'double_overdue';
    if (overdueDays > 30) return 'super_overdue';
    if (overdueDays > 0) return 'overdue';
    return 'D+0';
  }
  if (diffDays <= 7) return 'D+7';
  const dueMonth = due.getMonth();
  const dueYear = due.getFullYear();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  if (dueYear === currentYear && dueMonth === currentMonth) {
    return 'current_period';
  }
  const isNextMonth =
    (dueYear === currentYear && dueMonth === currentMonth + 1) ||
    (currentMonth === 11 && dueYear === currentYear + 1 && dueMonth === 0);
  if (isNextMonth) {
    return 'next_period';
  }
  return 'no_requirement';
}

export function calcPriorityContractCode(material: PriorityHitMaterial): string {
  if (material.export_flag) return 'export_contract';
  const attr = (material.contract_attr ?? '').toLowerCase();
  if (attr === '期货' || attr === 'futures') return 'futures_contract';
  if (attr === '现货' || attr === 'spot') return 'spot_contract';
  if (attr === '过渡材' || attr === 'transition') return 'transition_contract';
  return 'other';
}

export function isAssessmentContract(material: PriorityHitMaterial): boolean {
  const nature = material.contract_nature ?? '';
  return (nature === '订单' || nature === '框架订单') && Boolean(material.due_date);
}

export interface PriorityHitCodeSets {
  customerCodes: ReadonlySet<string>;
  batchCodes: ReadonlySet<string>;
  productTypeCodes: ReadonlySet<string>;
}

export function collectPriorityHitCountEntries(
  materials: PriorityHitMaterial[],
  codeSets: PriorityHitCodeSets
): Array<[string, number]> {
  const countMap = new Map<string, number>();
  const incr = (key: string) => countMap.set(key, (countMap.get(key) ?? 0) + 1);

  materials.forEach((material) => {
    incr(`assessment:${isAssessmentContract(material) ? 'assessed' : 'not_assessed'}`);
    incr(`delivery:${calcPriorityDeliveryCode(material.due_date)}`);
    incr(`contract:${calcPriorityContractCode(material)}`);

    const customerCode = (material.customer_code ?? '').trim();
    if (customerCode && codeSets.customerCodes.has(customerCode)) {
      incr(`customer:${customerCode}`);
    } else {
      incr('customer:default');
    }

    const batchCode = (material.batch_code ?? '').trim();
    if (batchCode && codeSets.batchCodes.has(batchCode)) {
      incr(`batch:${batchCode}`);
    } else {
      incr('batch:default');
    }

    const productType = (material.product_type ?? '').trim();
    if (productType && codeSets.productTypeCodes.has(productType)) {
      incr(`product_type:${productType}`);
    } else {
      incr('product_type:default');
    }
  });

  return Array.from(countMap.entries());
}

export function nextPriorityHitFilter(currentFilter: string, chipKey: string): string {
  return currentFilter === chipKey ? 'all' : chipKey;
}

export function matchesPriorityHitFilter(
  material: PriorityHitMaterial,
  filterKey: string,
  codeSets: PriorityHitCodeSets,
  nowDate?: Date
): boolean {
  if (filterKey === 'all') return true;
  const [prefix, rawCode] = filterKey.split(':', 2);
  switch (prefix) {
    case 'assessment': {
      const assessed = isAssessmentContract(material);
      return rawCode === 'assessed' ? assessed : !assessed;
    }
    case 'delivery':
      return calcPriorityDeliveryCode(material.due_date, nowDate) === rawCode;
    case 'contract':
      return calcPriorityContractCode(material) === rawCode;
    case 'customer': {
      const code = (material.customer_code ?? '').trim();
      if (rawCode === 'default') return !code || !codeSets.customerCodes.has(code);
      return code === rawCode;
    }
    case 'batch': {
      const code = (material.batch_code ?? '').trim();
      if (rawCode === 'default') return !code || !codeSets.batchCodes.has(code);
      return code === rawCode;
    }
    case 'product_type': {
      const code = (material.product_type ?? '').trim();
      if (rawCode === 'default') return !code || !codeSets.productTypeCodes.has(code);
      return code === rawCode;
    }
    default:
      return true;
  }
}

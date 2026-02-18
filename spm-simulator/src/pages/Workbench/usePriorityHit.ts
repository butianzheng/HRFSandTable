import { useState, useEffect, useRef, useMemo } from 'react';

import type { Material } from '../../types/material';
import type {
  PriorityDimensionConfig,
  CustomerPriorityConfig,
  BatchPriorityConfig,
  ProductTypePriorityConfig,
} from '../../types/config';
import { collectPriorityHitCountEntries, type PriorityHitCodeSets } from '../../utils/priorityHit';
import type {
  PriorityHitChip,
  PriorityHitWorkerMaterial,
  PriorityHitWorkerResponse,
} from './types';
import {
  PRIORITY_HIT_WORKER_THRESHOLD,
  deliveryCodeLabelMap,
  contractCodeLabelMap,
} from './constants';

export interface UsePriorityHitParams {
  baseAvailableMaterials: Material[];
  priorityHitCodeSets: PriorityHitCodeSets;
  priorityDimensionConfigs: PriorityDimensionConfig[];
  customerPriorityConfigs: CustomerPriorityConfig[];
  batchPriorityConfigs: BatchPriorityConfig[];
  productTypePriorityConfigs: ProductTypePriorityConfig[];
  priorityDimensionNameMap: Map<string, string>;
  customerPriorityMap: Map<string, CustomerPriorityConfig>;
  batchPriorityMap: Map<string, BatchPriorityConfig>;
  productTypePriorityMap: Map<string, ProductTypePriorityConfig>;
}

export interface UsePriorityHitReturn {
  priorityHitChips: PriorityHitChip[];
  priorityHitCountEntries: Array<[string, number]>;
}

export function usePriorityHit(params: UsePriorityHitParams): UsePriorityHitReturn {
  const {
    baseAvailableMaterials,
    priorityHitCodeSets,
    priorityDimensionNameMap,
    customerPriorityMap,
    batchPriorityMap,
    productTypePriorityMap,
  } = params;

  const [priorityHitCountEntries, setPriorityHitCountEntries] = useState<Array<[string, number]>>(
    []
  );
  const priorityHitWorkerRef = useRef<Worker | null>(null);
  const latestPriorityHitTaskIdRef = useRef(0);

  // ─── Worker materials ───
  const workerMaterials = useMemo<PriorityHitWorkerMaterial[]>(
    () =>
      baseAvailableMaterials.map((item) => ({
        due_date: item.due_date,
        contract_nature: item.contract_nature,
        export_flag: item.export_flag,
        contract_attr: item.contract_attr,
        customer_code: item.customer_code,
        batch_code: item.batch_code,
        product_type: item.product_type,
      })),
    [baseAvailableMaterials]
  );

  // ─── Worker lifecycle ───
  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    const worker = new Worker(new URL('../../workers/priorityHit.worker.ts', import.meta.url), {
      type: 'module',
    });
    priorityHitWorkerRef.current = worker;
    worker.onmessage = (event: MessageEvent<PriorityHitWorkerResponse>) => {
      const { id, counts } = event.data;
      if (id !== latestPriorityHitTaskIdRef.current) return;
      setPriorityHitCountEntries(counts);
    };
    worker.onerror = () => {
      priorityHitWorkerRef.current = null;
    };
    return () => {
      worker.terminate();
      priorityHitWorkerRef.current = null;
    };
  }, []);

  // ─── Worker dispatch ───
  useEffect(() => {
    const taskId = latestPriorityHitTaskIdRef.current + 1;
    latestPriorityHitTaskIdRef.current = taskId;

    if (workerMaterials.length === 0) {
      queueMicrotask(() => setPriorityHitCountEntries([]));
      return;
    }

    const worker = priorityHitWorkerRef.current;
    if (!worker || workerMaterials.length < PRIORITY_HIT_WORKER_THRESHOLD) {
      const entries = collectPriorityHitCountEntries(workerMaterials, priorityHitCodeSets);
      queueMicrotask(() => setPriorityHitCountEntries(entries));
      return;
    }

    worker.postMessage({
      id: taskId,
      materials: workerMaterials,
      customerCodes: Array.from(priorityHitCodeSets.customerCodes),
      batchCodes: Array.from(priorityHitCodeSets.batchCodes),
      productTypeCodes: Array.from(priorityHitCodeSets.productTypeCodes),
    });
  }, [priorityHitCodeSets, workerMaterials]);

  // ─── Derived chips ───
  const priorityHitCountMap = useMemo(
    () => new Map(priorityHitCountEntries),
    [priorityHitCountEntries]
  );

  const priorityHitChips = useMemo<PriorityHitChip[]>(() => {
    const chips: PriorityHitChip[] = [];
    if (priorityHitCountMap.size === 0) return chips;

    const assessmentKeys = ['assessment:assessed', 'assessment:not_assessed'];
    const deliveryKeys = [
      'delivery:D+0',
      'delivery:D+7',
      'delivery:super_overdue',
      'delivery:double_overdue',
      'delivery:overdue',
      'delivery:current_period',
      'delivery:next_period',
      'delivery:no_requirement',
    ];
    const contractKeys = [
      'contract:export_contract',
      'contract:futures_contract',
      'contract:spot_contract',
      'contract:transition_contract',
      'contract:other',
    ];

    assessmentKeys.forEach((key) => {
      const count = priorityHitCountMap.get(key) ?? 0;
      if (count === 0) return;
      const isAssessedKey = key === 'assessment:assessed';
      chips.push({
        key,
        label: isAssessedKey ? '考核合同' : '非考核合同',
        count,
        color: isAssessedKey ? 'magenta' : 'default',
      });
    });

    deliveryKeys.forEach((key) => {
      const count = priorityHitCountMap.get(key) ?? 0;
      if (count === 0) return;
      const deliveryCode = key.split(':')[1] ?? '';
      chips.push({
        key,
        label:
          priorityDimensionNameMap.get(`delivery:${deliveryCode}`) ??
          deliveryCodeLabelMap[deliveryCode] ??
          `交期:${deliveryCode}`,
        count,
        color:
          deliveryCode === 'overdue' ||
          deliveryCode === 'super_overdue' ||
          deliveryCode === 'double_overdue'
            ? 'error'
            : 'processing',
      });
    });

    contractKeys.forEach((key) => {
      const count = priorityHitCountMap.get(key) ?? 0;
      if (count === 0) return;
      const code = key.split(':')[1] ?? '';
      chips.push({
        key,
        label:
          priorityDimensionNameMap.get(`contract:${code}`) ??
          contractCodeLabelMap[code] ??
          `合同:${code}`,
        count,
        color: code === 'export_contract' ? 'gold' : 'blue',
      });
    });

    const buildDynamicChips = (
      prefix: 'customer' | 'batch' | 'product_type',
      defaultLabel: string,
      labelGetter: (code: string) => string,
      color: string
    ) => {
      const entries = Array.from(priorityHitCountMap.entries())
        .filter(([key]) => key.startsWith(`${prefix}:`))
        .sort((a, b) => b[1] - a[1]);
      entries.slice(0, 8).forEach(([key, count]) => {
        const code = key.slice(prefix.length + 1);
        const label = code === 'default' ? defaultLabel : labelGetter(code);
        chips.push({ key, label, count, color });
      });
    };

    buildDynamicChips(
      'customer',
      '客户:未配置',
      (code) => `客户:${customerPriorityMap.get(code)?.customer_name ?? code}`,
      'purple'
    );
    buildDynamicChips(
      'batch',
      '集批:未配置',
      (code) => `集批:${batchPriorityMap.get(code)?.batch_name ?? code}`,
      'orange'
    );
    buildDynamicChips(
      'product_type',
      '产品:未配置',
      (code) => `产品:${productTypePriorityMap.get(code)?.product_name ?? code}`,
      'cyan'
    );

    return chips;
  }, [
    batchPriorityMap,
    customerPriorityMap,
    priorityDimensionNameMap,
    priorityHitCountMap,
    productTypePriorityMap,
  ]);

  return {
    priorityHitChips,
    priorityHitCountEntries,
  };
}

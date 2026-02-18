/// <reference lib="webworker" />

import {
  collectPriorityHitCountEntries,
  type PriorityHitMaterial,
  type PriorityHitCodeSets,
} from '../utils/priorityHit';

interface PriorityHitRequest {
  id: number;
  materials: PriorityHitMaterial[];
  customerCodes: string[];
  batchCodes: string[];
  productTypeCodes: string[];
}

interface PriorityHitResponse {
  id: number;
  counts: Array<[string, number]>;
}

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<PriorityHitRequest>) => {
  const { id, materials, customerCodes, batchCodes, productTypeCodes } = event.data;

  const codeSets: PriorityHitCodeSets = {
    customerCodes: new Set(customerCodes),
    batchCodes: new Set(batchCodes),
    productTypeCodes: new Set(productTypeCodes),
  };
  const counts = collectPriorityHitCountEntries(materials, codeSets);
  const response: PriorityHitResponse = { id, counts };
  ctx.postMessage(response);
};

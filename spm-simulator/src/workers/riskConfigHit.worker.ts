/// <reference lib="webworker" />

import { collectRiskConfigHitEntries, type RiskConfigHitWorkerRow } from '../utils/riskConfig';

interface RiskHitRequest {
  id: number;
  rows: RiskConfigHitWorkerRow[];
}

interface RiskHitResponse {
  id: number;
  entries: Array<[string, number]>;
}

const ctx = self as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<RiskHitRequest>) => {
  const { id, rows } = event.data;
  const response: RiskHitResponse = { id, entries: collectRiskConfigHitEntries(rows) };
  ctx.postMessage(response);
};

/// <reference lib="webworker" />

import type { OperationLogEntry } from '../types/schedule';

interface FilterRequest {
  id: number;
  logs: OperationLogEntry[];
  keyword: string;
}

interface FilterResponse {
  id: number;
  filteredLogs: OperationLogEntry[];
}

const ctx = self as DedicatedWorkerGlobalScope;

function doFilter(logs: OperationLogEntry[], keyword: string): OperationLogEntry[] {
  if (!keyword) return logs;
  const kw = keyword.toLowerCase();
  return logs.filter((log) => {
    const detail = (log.detail || '').toLowerCase();
    const action = (log.action || '').toLowerCase();
    const logType = (log.log_type || '').toLowerCase();
    return detail.includes(kw) || action.includes(kw) || logType.includes(kw);
  });
}

ctx.onmessage = (event: MessageEvent<FilterRequest>) => {
  const { id, logs, keyword } = event.data;
  const filteredLogs = doFilter(logs, keyword);
  const response: FilterResponse = { id, filteredLogs };
  ctx.postMessage(response);
};

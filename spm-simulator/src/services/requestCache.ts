import { invoke } from '@tauri-apps/api/core';

interface CacheRecord {
  expiresAt: number;
  value: unknown;
}

const inflightRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, CacheRecord>();

function buildCacheKey(command: string, args: unknown): string {
  return `${command}:${JSON.stringify(args ?? null)}`;
}

export async function invokeDeduped<T>(
  command: string,
  args?: Record<string, unknown>,
  ttlMs = 0
): Promise<T> {
  const key = buildCacheKey(command, args);
  const now = Date.now();

  if (ttlMs > 0) {
    const cached = responseCache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value as T;
    }
  }

  const inflight = inflightRequests.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = invoke<T>(command, args)
    .then((result) => {
      if (ttlMs > 0) {
        responseCache.set(key, { value: result, expiresAt: Date.now() + ttlMs });
      }
      return result;
    })
    .finally(() => {
      inflightRequests.delete(key);
    });

  inflightRequests.set(key, request as Promise<unknown>);
  return request;
}

export function clearInvokeCache(commandPrefix?: string): void {
  if (!commandPrefix) {
    responseCache.clear();
    return;
  }
  const prefix = `${commandPrefix}:`;
  for (const key of responseCache.keys()) {
    if (key.startsWith(prefix)) {
      responseCache.delete(key);
    }
  }
}

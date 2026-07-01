import { AsyncLocalStorage } from 'async_hooks';

const asyncLocalStorage = new AsyncLocalStorage<Map<string, string>>();

export function getRequestId(): string {
  const store = asyncLocalStorage.getStore();
  return store?.get('requestId') || 'unknown';
}

export function runWithRequestId<T>(requestId: string, fn: () => T | Promise<T>): T | Promise<T> {
  const store = new Map<string, string>();
  store.set('requestId', requestId);
  return asyncLocalStorage.run(store, fn);
}

export function logTrace(step: string, extra?: any): void {
  const requestId = getRequestId();
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({ requestId, timestamp, step, extra }));
}
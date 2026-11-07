/** Counts actual settled requests, never estimates AI completion from time. */
type RequestSnapshot = {
  active: number;
  total: number;
  settled: number;
  /** Requests in the current batch that ended with an error (not a cancellation). */
  failed: number;
  /** When the current batch began; 0 before the first request. */
  startedAt: number;
};
let snapshot: RequestSnapshot = { active: 0, total: 0, settled: 0, failed: 0, startedAt: 0 };
const listeners = new Set<() => void>();
const emit = () => {
  for (const fn of listeners) fn();
};
export const subscribeRequests = (fn: () => void) => {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
};
export const requestSnapshot = () => snapshot;
const empty: RequestSnapshot = { active: 0, total: 0, settled: 0, failed: 0, startedAt: 0 };
export const serverRequestSnapshot = () => empty;
/** Short responses finish before this; only longer waits show the shared progress bar. */
export const LONG_WAIT_MS = 400;
export function isLongWait(value: RequestSnapshot, now: number) {
  return value.active > 0 && now - value.startedAt >= LONG_WAIT_MS;
}
export function trackRequest() {
  if (typeof window === "undefined") return () => {};
  snapshot = snapshot.active
    ? { ...snapshot, active: snapshot.active + 1, total: snapshot.total + 1 }
    : { active: 1, total: 1, settled: 0, failed: 0, startedAt: Date.now() };
  emit();
  let finished = false;
  return (ok = true) => {
    if (finished) return;
    finished = true;
    snapshot = {
      ...snapshot,
      active: snapshot.active - 1,
      settled: snapshot.settled + 1,
      failed: snapshot.failed + (ok ? 0 : 1),
    };
    emit();
  };
}

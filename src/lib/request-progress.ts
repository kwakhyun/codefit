/** Counts actual settled requests, never estimates AI completion from time. */
let snapshot = { active: 0, total: 0, settled: 0 };
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
const empty = { active: 0, total: 0, settled: 0 };
export const serverRequestSnapshot = () => empty;
export function trackRequest() {
  if (typeof window === "undefined") return () => {};
  snapshot = snapshot.active
    ? { ...snapshot, active: snapshot.active + 1, total: snapshot.total + 1 }
    : { active: 1, total: 1, settled: 0 };
  emit();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    snapshot = { ...snapshot, active: snapshot.active - 1, settled: snapshot.settled + 1 };
    emit();
  };
}

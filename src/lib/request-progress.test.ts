import { afterEach, expect, it, vi } from "vitest";
import {
  isLongWait,
  LONG_WAIT_MS,
  requestSnapshot,
  subscribeRequests,
  trackRequest,
} from "./request-progress";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
it("counts actual overlapping completions and ignores duplicate completion", () => {
  vi.stubGlobal("window", {});
  const change = vi.fn();
  const unsubscribe = subscribeRequests(change);
  const first = trackRequest(),
    second = trackRequest();
  expect(requestSnapshot()).toMatchObject({ active: 2, total: 2, settled: 0, failed: 0 });
  first();
  first();
  expect(requestSnapshot()).toMatchObject({ active: 1, total: 2, settled: 1, failed: 0 });
  second();
  expect(requestSnapshot()).toMatchObject({ active: 0, total: 2, settled: 2, failed: 0 });
  const next = trackRequest();
  expect(requestSnapshot()).toMatchObject({ active: 1, total: 1, settled: 0, failed: 0 });
  next();
  unsubscribe();
  expect(change).toHaveBeenCalledTimes(6);
});
it("remembers failures until the next batch starts", () => {
  vi.stubGlobal("window", {});
  const ok = trackRequest(),
    broken = trackRequest();
  broken(false);
  ok();
  expect(requestSnapshot()).toMatchObject({ active: 0, settled: 2, failed: 1 });
  const fresh = trackRequest();
  expect(requestSnapshot()).toMatchObject({ active: 1, failed: 0 });
  fresh();
});
it("treats only requests still pending after the threshold as a long wait", () => {
  vi.stubGlobal("window", {});
  vi.useFakeTimers();
  vi.setSystemTime(10_000);
  const finish = trackRequest();
  const started = requestSnapshot();
  expect(isLongWait(started, 10_000 + LONG_WAIT_MS - 1)).toBe(false);
  expect(isLongWait(started, 10_000 + LONG_WAIT_MS)).toBe(true);
  finish();
  expect(isLongWait(requestSnapshot(), 10_000 + LONG_WAIT_MS * 10)).toBe(false);
});

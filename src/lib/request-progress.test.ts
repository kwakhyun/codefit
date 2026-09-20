import { afterEach, expect, it, vi } from "vitest";
import { requestSnapshot, subscribeRequests, trackRequest } from "./request-progress";
afterEach(() => vi.unstubAllGlobals());
it("counts actual overlapping completions and ignores duplicate completion", () => {
  vi.stubGlobal("window", {});
  const change = vi.fn();
  const unsubscribe = subscribeRequests(change);
  const first = trackRequest(),
    second = trackRequest();
  expect(requestSnapshot()).toEqual({ active: 2, total: 2, settled: 0 });
  first();
  first();
  expect(requestSnapshot()).toEqual({ active: 1, total: 2, settled: 1 });
  second();
  expect(requestSnapshot()).toEqual({ active: 0, total: 2, settled: 2 });
  const next = trackRequest();
  expect(requestSnapshot()).toEqual({ active: 1, total: 1, settled: 0 });
  next();
  unsubscribe();
  expect(change).toHaveBeenCalledTimes(6);
});

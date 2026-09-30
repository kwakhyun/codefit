import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runInSandbox, SANDBOX_TIMEOUT_MS } from "./runner";

class FakeWorker {
  static last: FakeWorker;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  terminated = false;
  constructor() {
    FakeWorker.last = this;
  }
  postMessage() {}
  terminate() {
    this.terminated = true;
  }
  send(data: unknown) {
    this.onmessage?.({ data });
  }
}
const cases = [{ id: "a", expression: "1" }];

describe("sandbox runner messages", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", FakeWorker);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it("forwards errors reported by the worker instead of a generic result failure", async () => {
    const run = runInSandbox("", cases, new AbortController().signal);
    FakeWorker.last.send({ error: "실행 환경을 준비하지 못했습니다." });
    await expect(run).rejects.toThrow("실행 환경을 준비하지 못했습니다.");
    expect(FakeWorker.last.terminated).toBe(true);
  });
  it("starts the execution timeout only after the engine is ready", async () => {
    const run = runInSandbox("", cases, new AbortController().signal);
    const settled = vi.fn();
    run.then(settled, settled);
    await vi.advanceTimersByTimeAsync(SANDBOX_TIMEOUT_MS + 5_000);
    expect(settled).not.toHaveBeenCalled();
    FakeWorker.last.send({ ready: true });
    await vi.advanceTimersByTimeAsync(SANDBOX_TIMEOUT_MS - 1);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await expect(run).rejects.toThrow("실행 시간이 초과됐습니다");
  });
  it("gives a loading message when the engine never becomes ready", async () => {
    const run = runInSandbox("", cases, new AbortController().signal);
    const assertion = expect(run).rejects.toThrow("실행 환경을 불러오는 데 시간이 오래 걸립니다");
    await vi.advanceTimersByTimeAsync(30_000);
    await assertion;
  });
  it("resolves matching results and rejects mismatched ones", async () => {
    const ok = runInSandbox("", cases, new AbortController().signal);
    FakeWorker.last.send({ ready: true });
    FakeWorker.last.send({ results: [{ id: "a", status: "ok", actual: "1" }] });
    await expect(ok).resolves.toEqual([{ id: "a", status: "ok", actual: "1" }]);
    const bad = runInSandbox("", cases, new AbortController().signal);
    FakeWorker.last.send({ results: [{ id: "b", status: "ok", actual: "1" }] });
    await expect(bad).rejects.toThrow("실행 결과를 확인하지 못했습니다");
  });
});

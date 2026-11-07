import { afterEach, expect, it, vi } from "vitest";
import { api, ApiError, errorMessage, OFFLINE_MESSAGE, setWorkspaceScope } from "./client-api";
import { requestSnapshot } from "./request-progress";
import { PRACTICE_REQUEST_TIMEOUT_MS } from "./project-check/practice-generation-policy";
afterEach(() => {
  setWorkspaceScope("");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it("keeps the request deadline when a caller supplies a cancellation signal", async () => {
  const deadline = new AbortController();
  const caller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(deadline.signal);
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () => reject(options.signal!.reason));
        }),
    ),
  );
  const request = api("/api/project-check", { signal: caller.signal });
  const assertion = expect(request).rejects.toMatchObject({ name: "TimeoutError" });
  deadline.abort(new DOMException("Timed out", "TimeoutError"));
  await assertion;
  expect(caller.signal.aborted).toBe(false);
});
it("still cancels immediately when the caller leaves the screen", async () => {
  const caller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () => reject(options.signal!.reason));
        }),
    ),
  );
  const request = api("/api/project-check", { signal: caller.signal });
  const assertion = expect(request).rejects.toMatchObject({ name: "AbortError" });
  caller.abort();
  await assertion;
});
it("allows practice quality repair to finish without extending unrelated requests", async () => {
  const timeout = vi.spyOn(AbortSignal, "timeout");
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({})),
  );
  const endpoint = "/api/project-check/example/practice";
  await api(endpoint, { method: "POST", body: { stepwise: true } });
  expect(timeout).toHaveBeenLastCalledWith(PRACTICE_REQUEST_TIMEOUT_MS);
  for (const [url, method] of [
    [endpoint, "GET"],
    [endpoint, "PATCH"],
    ["/api/project-check/example/workshop", "POST"],
    ["/api/project-check", "POST"],
  ]) {
    await api(url, { method });
    expect(timeout).toHaveBeenLastCalledWith(115_000);
  }
});
it("discovers a new session without the stale header while preserving explicit mutation ownership", async () => {
  const fetch = vi.fn().mockImplementation(async () => Response.json({ scope: "user:new" }));
  vi.stubGlobal("fetch", fetch);
  setWorkspaceScope("user:old");
  await api("/api/project-check", { scope: null });
  expect(fetch.mock.calls[0][1].headers).not.toHaveProperty("X-Codefit-Workspace");
  setWorkspaceScope("user:new");
  await api("/api/project-check", { method: "PATCH", scope: "user:old", body: {} });
  expect(fetch.mock.calls[1][1].headers["X-Codefit-Workspace"]).toBe("user:old");
  await api("/api/usage");
  expect(fetch.mock.calls[2][1].headers["X-Codefit-Workspace"]).toBe("user:new");
});
it("shows Korean copy instead of raw browser network errors", () => {
  for (const raw of [
    "Failed to fetch",
    "Load failed",
    "NetworkError when attempting to fetch resource.",
  ]) {
    const message = errorMessage(new TypeError(raw));
    expect(message).toContain("연결");
    expect(message).not.toContain(raw);
  }
  expect(errorMessage(new TypeError("x is undefined"))).not.toContain("undefined");
  vi.stubGlobal("navigator", { onLine: false });
  expect(errorMessage(new TypeError("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
  // Deliberate Korean messages and server errors keep their wording even offline.
  expect(errorMessage(new ApiError("이미 삭제된 기록입니다.", 404))).toBe(
    "이미 삭제된 기록입니다.",
  );
});
it("reports failed requests to the shared progress state, but not cancellations", async () => {
  vi.stubGlobal("window", {});
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "실패" }, { status: 500 })),
  );
  await expect(api("/api/usage")).rejects.toBeInstanceOf(ApiError);
  expect(requestSnapshot()).toMatchObject({ active: 0, failed: 1 });
  const caller = new AbortController();
  vi.stubGlobal(
    "fetch",
    vi.fn(
      (_url, options: RequestInit) =>
        new Promise((_resolve, reject) => {
          options.signal!.addEventListener("abort", () => reject(options.signal!.reason));
        }),
    ),
  );
  const request = api("/api/usage", { signal: caller.signal });
  caller.abort();
  await expect(request).rejects.toMatchObject({ name: "AbortError" });
  expect(requestSnapshot()).toMatchObject({ active: 0, failed: 0 });
});

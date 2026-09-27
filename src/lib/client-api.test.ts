import { afterEach, expect, it, vi } from "vitest";
import { api, setWorkspaceScope } from "./client-api";
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

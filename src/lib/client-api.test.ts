import { afterEach, expect, it, vi } from "vitest";
import { api, setWorkspaceScope } from "./client-api";
afterEach(() => {
  setWorkspaceScope("");
  vi.unstubAllGlobals();
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

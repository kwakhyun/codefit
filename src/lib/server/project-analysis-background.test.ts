import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ begin: vi.fn(), create: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("./project-member", () => ({ projectMember: async () => ({ owner: "user:a" }) }));
vi.mock("./database", () => ({ getStore: async () => ({}) }));
vi.mock("./usage-policy", () => ({ networkIdentity: () => "network" }));
vi.mock("./project-check-service", () => ({
  ProjectCheckService: class {
    beginAnalysis = m.begin;
    create = m.create;
  },
}));
import { POST } from "@/app/api/project-check/route";
const id = "11111111-1111-4111-8111-111111111111";
const lease = { id, owner: "user:a", kind: "project-analysis", token: "lease" };
function request(signal?: AbortSignal) {
  return new Request("http://localhost/api/project-check", {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", prefer: "respond-async" },
    body: JSON.stringify({ requestId: id, url: "https://example.com", description: "" }),
  });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
it("accepts a job before responding and keeps execution independent of a disconnected client", async () => {
  m.begin.mockResolvedValue({ state: "new", lease });
  m.create.mockResolvedValue({ id });
  const controller = new AbortController();
  const response = await POST(request(controller.signal));
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ id, status: "pending" });
  expect(m.create).not.toHaveBeenCalled();
  controller.abort();
  await m.after.mock.calls[0][0]();
  const args = m.create.mock.calls[0];
  expect(args[3].aborted).toBe(false);
  expect(args[4]).toEqual(lease);
});
it("does not schedule or charge another analysis when its lease is already pending", async () => {
  m.begin.mockResolvedValue({ state: "pending" });
  expect((await POST(request())).status).toBe(202);
  expect(m.after).not.toHaveBeenCalled();
  expect(m.create).not.toHaveBeenCalled();
});
it("handles a failed background run after the service has marked its lease failed", async () => {
  m.begin.mockResolvedValue({ state: "new", lease });
  m.create.mockRejectedValue(new Error("provider failed"));
  await POST(request());
  await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined();
});

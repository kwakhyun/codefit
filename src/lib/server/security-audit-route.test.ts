import { beforeEach, expect, it, vi } from "vitest";
const { session, consume, run } = vi.hoisted(() => ({
  session: vi.fn(),
  consume: vi.fn(),
  run: vi.fn(),
}));
vi.mock("./session", () => ({ session }));
vi.mock("./database", () => ({ getStore: async () => ({ consumeLimits: consume }) }));
vi.mock("./security-audit", () => ({
  createOwnershipChallenge: () => ({ token: "test-proof" }),
  runCorsAudit: run,
}));
import { POST } from "@/app/api/security-check/audit/route";
const request = (body: unknown) =>
  new Request("https://codefit.test/api/security-check/audit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  session.mockResolvedValue({ owner: "owner", user: { id: "user" } });
  consume.mockResolvedValue(true);
});
it("requires sign-in, authorization and a public URL before creating proof", async () => {
  session.mockResolvedValueOnce({ owner: "guest", user: null });
  expect((await POST(request({ url: "https://example.com", authorized: true }))).status).toBe(401);
  expect((await POST(request({ url: "https://127.0.0.1", authorized: true }))).status).toBe(400);
  expect((await POST(request({ url: "https://example.com", authorized: false }))).status).toBe(400);
  expect(consume).not.toHaveBeenCalled();
  expect(run).not.toHaveBeenCalled();
});
it("budgets challenge and test requests before target access", async () => {
  consume.mockResolvedValue(false);
  expect(
    (await POST(request({ url: "https://example.com", authorized: true, token: "proof" }))).status,
  ).toBe(429);
  expect(run).not.toHaveBeenCalled();
});
it("issuing proof does not scan the target", async () => {
  expect((await POST(request({ url: "https://example.com", authorized: true }))).status).toBe(200);
  expect(run).not.toHaveBeenCalled();
  expect(consume.mock.calls[0][0]).toHaveLength(4);
});

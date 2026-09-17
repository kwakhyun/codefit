import { beforeEach, afterEach, expect, it, vi } from "vitest";
const { session, consumeLimits, askGuide } = vi.hoisted(() => ({
  session: vi.fn(),
  consumeLimits: vi.fn(),
  askGuide: vi.fn(),
}));
vi.mock("@/lib/server/session", () => ({ session }));
vi.mock("@/lib/server/database", () => ({
  getStore: async () => ({ consumeLimits, queries: { recordAiRun: vi.fn() } }),
}));
vi.mock("@/lib/server/ai-guide", () => ({ askGuide }));
import { POST, GET } from "./route";
const payload = {
  profile: { experience: "builder", goal: "fix", minutes: 15 },
  messages: [{ role: "user", content: "서비스 오류를 확인하고 싶어요" }],
  mode: "ai",
};
function req(body: unknown = payload, scope = "guest:one") {
  return new Request("http://localhost/api/guide", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Codefit-Workspace": scope },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-no-network");
  vi.stubEnv("VERCEL", "");
  session.mockReset().mockResolvedValue({ owner: "one", scope: "guest:one" });
  consumeLimits.mockReset().mockResolvedValue(true);
  askGuide.mockReset();
});
afterEach(() => vi.unstubAllEnvs());
it("returns private no-store status and rejects missing or stale ownership before a paid call", async () => {
  const status = await GET(new Request("http://localhost/api/guide"));
  expect(status.headers.get("cache-control")).toBe("no-store");
  expect(await status.json()).toEqual({ scope: "guest:one", aiReady: true });
  expect((await POST(req(payload, "guest:two"))).status).toBe(409);
  expect(askGuide).not.toHaveBeenCalled();
});
it("offers truthful basic guidance without a key or when the user opts out of AI", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  let response = await POST(req());
  expect((await response.json()).source).toBe("basic");
  vi.stubEnv("OPENAI_API_KEY", "test-no-network");
  response = await POST(req({ ...payload, mode: "basic" }));
  expect((await response.json()).recommendation.id).toBe("broken-memo");
  expect(consumeLimits).not.toHaveBeenCalled();
  expect(askGuide).not.toHaveBeenCalled();
});
it("uses separate guide allowances and shared service caps before calling AI", async () => {
  askGuide.mockResolvedValue({ source: "ai" });
  const response = await POST(req());
  expect(response.status).toBe(200);
  const entries = consumeLimits.mock.calls[0][0];
  expect(entries).toContainEqual({ key: "guide:owner:one", max: 12, windowMs: 86400000 });
  expect(
    entries.some(
      (e: { key: string }) => e.key.includes("ai:review:") || e.key.includes("ai:generate:"),
    ),
  ).toBe(false);
  expect(entries.some((e: { key: string }) => e.key === "ai:global:day")).toBe(true);
  expect(askGuide).toHaveBeenCalledOnce();
});
it("does not retry or charge a provider request when rate limited, and recovers provider failures", async () => {
  consumeLimits.mockResolvedValue(false);
  let reply = await (await POST(req())).json();
  expect(reply.source).toBe("basic");
  expect(reply.notice).toContain("한도");
  expect(askGuide).not.toHaveBeenCalled();
  consumeLimits.mockResolvedValue(true);
  askGuide.mockRejectedValue(new Error("private provider details"));
  reply = await (await POST(req())).json();
  expect(reply.source).toBe("basic");
  expect(JSON.stringify(reply)).not.toContain("private provider details");
  expect(askGuide).toHaveBeenCalledOnce();
});
it("rejects oversized and malformed chat histories before any AI work", async () => {
  expect(
    (await POST(req({ ...payload, messages: [{ role: "user", content: "a".repeat(13000) }] })))
      .status,
  ).toBe(413);
  expect((await POST(req({ ...payload, messages: [] }))).status).toBe(400);
  expect(consumeLimits).not.toHaveBeenCalled();
});

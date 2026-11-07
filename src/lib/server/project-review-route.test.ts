import { afterEach, beforeEach, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ begin: vi.fn(), review: vi.fn(), after: vi.fn() }));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("./project-member", () => ({ projectMember: async () => ({ owner: "user:a" }) }));
vi.mock("./database", () => ({ getStore: async () => ({}) }));
vi.mock("./usage-policy", () => ({ networkIdentity: () => "network" }));
vi.mock("./project-check-service", () => ({
  ProjectCheckService: class {
    beginReview = m.begin;
    review = m.review;
  },
}));
import { PATCH } from "@/app/api/project-check/route";
const id = "11111111-1111-4111-8111-111111111111";
const lease = { id: `project-review-${id}`, owner: "user:a", kind: "x", token: "lease" };
const answers = ["설명", "", "", "", ""];
function request(signal?: AbortSignal) {
  return new Request("http://localhost/api/project-check", {
    method: "PATCH",
    signal,
    headers: { "content-type": "application/json", prefer: "respond-async" },
    body: JSON.stringify({ id, answers }),
  });
}
beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test");
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());
it("accepts an evaluation before responding and keeps it independent of the client", async () => {
  m.begin.mockResolvedValue({ state: "new", lease });
  const controller = new AbortController();
  const response = await PATCH(request(controller.signal));
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ id, status: "pending" });
  expect(m.review).not.toHaveBeenCalled();
  controller.abort();
  await m.after.mock.calls[0][0]();
  expect(m.review.mock.calls[0][3].aborted).toBe(false);
  expect(m.review.mock.calls[0][4]).toEqual(lease);
});
it("returns a completed review and never schedules a second paid run", async () => {
  m.begin.mockResolvedValue({
    state: "done",
    result: JSON.stringify({ answers, assessment: { score: 40 } }),
  });
  const response = await PATCH(request());
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ answers, assessment: { score: 40 } });
  m.begin.mockResolvedValue({ state: "pending" });
  expect((await PATCH(request())).status).toBe(202);
  expect(m.after).not.toHaveBeenCalled();
});
it("absorbs a failed background run after the service recorded its reason", async () => {
  m.begin.mockResolvedValue({ state: "new", lease });
  m.review.mockRejectedValue(new Error("provider failed"));
  await PATCH(request());
  await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined();
});

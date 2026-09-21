import { afterEach, expect, it, vi } from "vitest";
const { member, getStore, status, advance } = vi.hoisted(() => ({
  member: vi.fn(),
  getStore: vi.fn(),
  status: vi.fn(),
  advance: vi.fn(),
}));
vi.mock("./project-member", () => ({ projectMember: member }));
vi.mock("./database", () => ({ getStore }));
vi.mock("./project-check-service", () => ({
  ProjectCheckService: class {
    advanceLearning = advance;
  },
}));
import { POST as practice } from "../../app/api/project-check/[id]/practice/route";
import { POST as workshop } from "../../app/api/project-check/[id]/workshop/route";
afterEach(() => vi.unstubAllEnvs());
for (const [kind, post] of [
  ["practice", practice],
  ["workshop", workshop],
] as const) {
  it(`${kind} finalizes saved stages with AI offline but refuses new paid work`, async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    member.mockResolvedValue({ owner: "visitor:recovery" });
    const id = "b9b6c81e-28e0-456f-9a05-2fbc19f2c864",
      context = { params: Promise.resolve({ id }) };
    getStore.mockResolvedValue({
      queries: {
        projectChecks: {
          get: vi.fn().mockResolvedValue({ id }),
          generatedPractice: vi.fn().mockResolvedValue(null),
          workshop: vi.fn().mockResolvedValue(null),
          learningStatus: status,
        },
      },
    });
    const request = () =>
      new Request(`https://codefit.test/api/project-check/${id}/${kind}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepwise: true }),
      });
    status.mockResolvedValue({ result: null, completed: 2, canRecover: true });
    advance.mockReset().mockResolvedValue({ status: "done", result: {} });
    expect((await post(request(), context)).status).toBe(200);
    expect(advance).toHaveBeenCalledTimes(1);
    status.mockResolvedValue({ result: null, completed: 1, canRecover: false });
    expect((await post(request(), context)).status).toBe(503);
    expect(advance).toHaveBeenCalledTimes(1);
  });
}

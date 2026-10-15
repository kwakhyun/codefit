import { afterEach, expect, it, vi } from "vitest";
import { jevDecide } from "./jev";
import { withAiCallContext } from "./ai-telemetry";
import { buildCodeGuide } from "./jev-code-guide";
import type { JevQuestion } from "./jev";
const questions = {
  q: { type: "choice" as const, instructions: "Classify", criteria: { yes: "yes", no: "no" } },
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function setup(body: unknown, status = 200) {
  vi.stubEnv("TYPESAFE_API_KEY", "test-key");
  vi.stubEnv("TYPESAFE_ENABLED", "true");
  const fetcher = vi.fn().mockResolvedValue(Response.json(body, { status }));
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}
const valid = {
  model: "jev-1.13.0",
  usage: { input_tokens: 100, output_tokens: 10 },
  answers: {
    q: { type: "choice", choice: "yes", confidence: 0.96, probabilities: { yes: 0.98, no: 0.02 } },
  },
};
it("uses only the official server endpoint and validates choices", async () => {
  const fetcher = setup(valid);
  expect(
    (await jevDecide({ code: "return" }, questions, new AbortController().signal))?.q.choice,
  ).toBe("yes");
  expect(fetcher.mock.calls[0][0]).toBe("https://api.typesafe.ai/v1/systemone");
  expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "error", cache: "no-store" });
});
it("does not call when disabled or over the byte budget", async () => {
  const fetcher = setup(valid);
  vi.stubEnv("TYPESAFE_ENABLED", "false");
  expect(await jevDecide({}, questions, new AbortController().signal)).toBeNull();
  vi.stubEnv("TYPESAFE_ENABLED", "true");
  expect(await jevDecide("가".repeat(30000), questions, new AbortController().signal)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([
  {},
  { ...valid, answers: {} },
  { ...valid, answers: { q: { ...valid.answers.q, choice: "invented" } } },
  { ...valid, answers: { q: { ...valid.answers.q, probabilities: { yes: 1, no: 1 } } } },
])("falls back on invalid provider response", async (body) => {
  setup(body);
  expect(await jevDecide({}, questions, new AbortController().signal)).toBeNull();
});
it.each([401, 429, 529])("does not retry HTTP %s or leak provider bodies", async (status) => {
  const fetcher = setup({ secret: "never print" }, status);
  const log = vi.spyOn(console, "warn").mockImplementation(() => {});
  expect(await jevDecide({}, questions, new AbortController().signal)).toBeNull();
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(log.mock.calls)).not.toContain("never print");
});
it("preserves cancellation instead of swallowing it", async () => {
  setup(valid);
  const controller = new AbortController();
  controller.abort();
  await expect(jevDecide({}, questions, controller.signal)).rejects.toThrow();
});
it("continues without a key and when the network fails", async () => {
  const fetcher = setup(valid);
  vi.stubEnv("TYPESAFE_API_KEY", "");
  expect(await jevDecide({}, questions, new AbortController().signal)).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
  vi.stubEnv("TYPESAFE_API_KEY", "test-key");
  fetcher.mockRejectedValue(new TypeError("network"));
  expect(await jevDecide({}, questions, new AbortController().signal)).toBeNull();
});

it("accepts a native Noul probability and rejects wrong types and out-of-range values", async () => {
  const noulQuestions = { q: { type: "noul" as const, instructions: "Is evidence sufficient?" } };
  setup({ ...valid, answers: { q: { type: "noul", noul: 0.25 } } });
  expect((await jevDecide({}, noulQuestions, new AbortController().signal))?.q.noul).toBe(0.25);
  setup(valid);
  expect(await jevDecide({}, noulQuestions, new AbortController().signal)).toBeNull();
  setup({ ...valid, answers: { q: { type: "noul", noul: 1.5 } } });
  expect(await jevDecide({}, noulQuestions, new AbortController().signal)).toBeNull();
});

it("discards unsolicited answers so they cannot trigger additional actions", async () => {
  setup({ ...valid, answers: { ...valid.answers, extra: { type: "noul", noul: 0 } } });
  expect(await jevDecide({}, questions, new AbortController().signal)).toEqual(valid.answers);
});

it("records TypeSafe's actual model and token usage under the owning request without inventing prices", async () => {
  const fetcher = setup(valid);
  vi.stubEnv("TYPESAFE_MODEL", "jev-latest");
  const beforeCall = vi.fn(),
    record = vi.fn();
  const result = await withAiCallContext({ requestId: "project-request", beforeCall, record }, () =>
    jevDecide({ source: "private code" }, questions, new AbortController().signal),
  );
  expect(result).toEqual(valid.answers);
  expect(beforeCall).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(record).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      requestId: "project-request",
      operation: "project",
      model: "jev-1.13.0",
      outcome: "success",
      promptVersion: "2026-10-15.project.code-guide.typesafe-v1",
      inputTokens: 100,
      outputTokens: 10,
      estimatedCostUsd: null,
    }),
  );
  expect(JSON.stringify(record.mock.calls)).not.toContain("private code");
  expect(JSON.stringify(record.mock.calls)).not.toContain("test-key");
});

it.each(["network", "http", "json", "answer"])(
  "records %s failure before returning the optional-guide fallback",
  async (failure) => {
    const fetcher = setup(valid);
    if (failure === "network") fetcher.mockRejectedValue(new Error("private provider message"));
    if (failure === "http")
      fetcher.mockResolvedValue(
        Response.json({ error: "private provider message" }, { status: 529 }),
      );
    if (failure === "json") fetcher.mockResolvedValue(new Response("not JSON"));
    if (failure === "answer") fetcher.mockResolvedValue(Response.json({ ...valid, answers: {} }));
    const beforeCall = vi.fn(),
      record = vi.fn();
    const result = await withAiCallContext(
      { requestId: "failed-request", beforeCall, record },
      () => jevDecide({}, questions, new AbortController().signal),
    );
    expect(result).toBeNull();
    expect(beforeCall).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledOnce();
    expect(record).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        requestId: "failed-request",
        model: "jev-1.13.0",
        outcome: "error",
        estimatedCostUsd: null,
        inputTokens: failure === "answer" ? 100 : null,
        outputTokens: failure === "answer" ? 10 : null,
      }),
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain("private provider message");
  },
);

it.each(["no-key", "disabled", "no-questions", "size"])(
  "does not reserve or record a provider attempt for %s skips",
  async (reason) => {
    const fetcher = setup(valid);
    if (reason === "no-key") vi.stubEnv("TYPESAFE_API_KEY", "");
    if (reason === "disabled") vi.stubEnv("TYPESAFE_ENABLED", "false");
    const beforeCall = vi.fn(),
      record = vi.fn();
    expect(
      await withAiCallContext({ requestId: "skipped-request", beforeCall, record }, () =>
        jevDecide(
          reason === "size" ? "가".repeat(30000) : {},
          reason === "no-questions" ? {} : questions,
          new AbortController().signal,
        ),
      ),
    ).toBeNull();
    expect(beforeCall).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  },
);

it("stops before fetch when the shared request budget rejects and does not record a paid attempt", async () => {
  const fetcher = setup(valid);
  const beforeCall = vi.fn().mockRejectedValue(new Error("budget exhausted")),
    record = vi.fn();
  expect(
    await withAiCallContext({ requestId: "blocked-request", beforeCall, record }, () =>
      jevDecide({}, questions, new AbortController().signal),
    ),
  ).toBeNull();
  expect(beforeCall).toHaveBeenCalledOnce();
  expect(fetcher).not.toHaveBeenCalled();
  expect(record).not.toHaveBeenCalled();
});

it("applies the same request budget to every parallel code-guide batch", async () => {
  const fetcher = setup(valid);
  fetcher.mockImplementation(async (_url: string, input: RequestInit) => {
    const body = JSON.parse(String(input.body)) as { questions: Record<string, JevQuestion> };
    return Response.json({
      ...valid,
      answers: Object.fromEntries(
        Object.entries(body.questions).map(([id, question]) => [
          id,
          question.type === "noul"
            ? { type: "noul", noul: 0.99 }
            : {
                type: "choice",
                choice: "access",
                confidence: 1,
                probabilities: Object.fromEntries(
                  Object.keys(question.criteria).map((option) => [
                    option,
                    option === "access" ? 1 : 0,
                  ]),
                ),
              },
        ]),
      ),
    });
  });
  let available = 1;
  const beforeCall = vi.fn(async () => {
      if (available === 0) throw new Error("budget exhausted");
      available--;
    }),
    record = vi.fn();
  const result = await withAiCallContext(
    { requestId: "analysis-with-guide", beforeCall, record },
    () =>
      buildCodeGuide(
        Array.from({ length: 25 }, (_, i) => ({
          id: String(i),
          file: `auth-${i}.ts`,
          code: "if (!user) throw Error();",
          evidence: `auth-${i}.ts:L1 if (!user) throw Error();`,
        })),
        "Authentication",
        new AbortController().signal,
      ),
  );
  expect(result).toHaveLength(1);
  expect(beforeCall).toHaveBeenCalledTimes(3);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(record).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ requestId: "analysis-with-guide", outcome: "success" }),
  );
});

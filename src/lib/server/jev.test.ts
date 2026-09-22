import { afterEach, expect, it, vi } from "vitest";
import { jevDecide } from "./jev";
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

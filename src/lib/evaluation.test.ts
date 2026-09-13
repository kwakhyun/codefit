import { expect, it } from "vitest";
import { evaluationSummary } from "./evaluation";
import { estimateCost } from "./ai-telemetry";
it("reports false passes, false rejects and provider errors separately", () => {
  const row = { category: "starter", latencyMs: 100, id: "a" };
  const summary = evaluationSummary([
    { ...row, expected: [false, false], actual: [true, true] },
    { ...row, expected: [true, true], actual: [true, false] },
    { ...row, expected: [false, false], actual: null },
  ]);
  expect(summary).toMatchObject({
    errors: 1,
    falsePasses: 1,
    falseRejects: 1,
    agreement: 0,
    criterionAgreement: 0.25,
    falsePassRate: 1,
  });
  expect(evaluationSummary([]).agreement).toBeNull();
});
it("accounts for cached inputs and leaves unknown model prices unestimated", () => {
  expect(estimateCost("gpt-5.4-mini", 1000000, 500000, 1000000)).toBe(4.9125);
  expect(estimateCost("unknown", 100, 0, 200)).toBeNull();
  expect(estimateCost("constructor", 100, 0, 200)).toBeNull();
  expect(estimateCost("gpt-5.6-luna", 1000000, 500000, 1000000)).toBe(1.31);
  expect(estimateCost("gpt-5.6-terra", 1000000, 500000, 1000000)).toBe(13.1);
  expect(estimateCost("gpt-5.6-sol", 1000000, 500000, 1000000)).toBe(22.2);
  expect(estimateCost("gpt-5.6-luna-2026-09-14", 1000000, 500000, 1000000)).toBe(1.31);
  expect(estimateCost("gpt-5.6-luna-other", 100, 0, 200)).toBeNull();
});

it("keeps the published evaluation tied to the current cases and review instructions", async () => {
  const { createHash } = await import("node:crypto");
  const { reviewCases } = await import("../../evals/review-cases");
  const { REVIEW_PROMPT, REVIEW_REASONING, PROMPT_VERSION } = await import("./server/ai-prompts");
  const { default: report } = await import("../../reports/ai-evaluation.json");
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify({ cases: reviewCases, prompt: REVIEW_PROMPT, reasoning: REVIEW_REASONING }),
    )
    .digest("hex");
  expect(report.fingerprint).toBe(fingerprint);
  expect(report.promptVersion).toBe(PROMPT_VERSION);
  expect(report.summary).toEqual(evaluationSummary(report.results));
  const { default: luna } = await import("../../reports/ai-review-luna.json");
  expect(luna.fingerprint).toBe(fingerprint);
  expect(luna.models).toEqual(["gpt-5.6-luna"]);
  expect(luna.summary).toEqual(evaluationSummary(luna.results));
  expect(luna.summary).toMatchObject({
    errors: 0,
    falsePasses: 0,
    falseRejects: 0,
    criterionAgreement: 1,
  });
});

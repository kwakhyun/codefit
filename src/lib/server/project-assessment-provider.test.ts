import { beforeEach, expect, it, vi } from "vitest";
import { fixtureCheck } from "../project-check/fixtures";
import { assessProject } from "./ai-project-check";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
const response = (flow: string | null) => ({
  model: "gpt-5.6-luna",
  usage: {
    input_tokens: 100,
    cached_input_tokens: 0,
    input_tokens_details: { cached_tokens: 0 },
    output_tokens: 200,
  },
  output_parsed: {
    summary: "回答の確認",
    feedback: Array.from({ length: 5 }, (_, questionIndex) => ({
      questionIndex,
      feedback: "処理順序",
      nextStep: "次の確認",
      blockingIssue: null,
      evidence: {
        feature: null,
        flow: questionIndex === 0 ? flow : null,
        reason: null,
        failure: null,
        verification: null,
        tradeoff: null,
      },
    })),
  },
});
beforeEach(() => parse.mockReset());
it("records citation rejection as a failure while retaining paid token usage", async () => {
  parse.mockResolvedValue(response("invented quotation"));
  const record = vi.fn();
  await expect(
    assessProject(
      fixtureCheck,
      ["actual answer", "", "", "", ""],
      new AbortController().signal,
      record,
    ),
  ).rejects.toMatchObject({ status: 502 });
  expect(parse).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledWith(
    expect.objectContaining({
      outcome: "error",
      inputTokens: 100,
      outputTokens: 200,
      promptVersion: "2026-09-20.project.assessment.evidence-v3.1",
    }),
  );
});
it("uses the strict new contract and records successful server-derived scores", async () => {
  parse.mockResolvedValue(response("q0s0"));
  const record = vi.fn();
  const result = await assessProject(
    fixtureCheck,
    ["actual answer", "", "", "", ""],
    new AbortController().signal,
    record,
  );
  expect(result.score).toBe(10);
  expect(result.rubricVersion).toBe("evidence-v3");
  expect(parse.mock.calls[0][0]).toMatchObject({ store: false, max_output_tokens: 6500 });
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ outcome: "success" }));
});

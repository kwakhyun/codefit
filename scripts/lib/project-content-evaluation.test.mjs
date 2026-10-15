import { afterEach, expect, it, vi } from "vitest";
import { execFileSync } from "node:child_process";
import OpenAI from "openai";
import {
  CONTENT_STAGES,
  captureContentDrafts,
  evaluateProjectContent,
  parseContentSnapshot,
  parseContentStages,
  safeContentFailure,
} from "./project-content-evaluation";
import { withAiTelemetry } from "../../src/lib/server/ai-telemetry";
import { ContentQualityError } from "../../src/lib/server/project-content-quality";
import { fixtureCheck } from "../../src/lib/project-check/fixtures";

const page = {
  ...fixtureCheck.page,
  source: "repository",
  repository: {
    name: "owner/repo",
    commit: "a".repeat(40),
    totalFiles: 1,
    eligibleFiles: 1,
    omittedFiles: 0,
    truncatedTree: false,
    links: [],
    files: [
      {
        path: "main.ts",
        totalLines: 1,
        partial: false,
        lines: [{ number: 1, text: "return prior;" }],
      },
    ],
  },
};
const plan = {
  summary: "합성 저장소 학습",
  limitations: "테스트 한 줄만 수집했습니다.",
  topics: [],
};
const task = {
  title: "이전 값",
  purpose: "반환 조건 이해",
  situation: "기존 값이 있습니다.",
  assumptions: "prior가 존재합니다.",
  evidence: ["main.ts:L1 return prior;"],
  question: "반환값은?",
  choices: ["기존 값", "새 값"],
  answer: 0,
  walkthrough: [
    { action: "값 확인", result: "기존 값" },
    { action: "반환", result: "기존 값" },
  ],
  explanation: "기존 값을 돌려줍니다.",
  verification: "반환값을 확인합니다.",
};
function providers() {
  const metered = async (result) => {
    for (const prompt of ["draft", "review"])
      await withAiTelemetry("project", prompt, async (capture) => {
        capture({
          model: "gpt-5.6-sol",
          usage: {
            input_tokens: 100,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens: 20,
          },
        });
      });
    return result;
  };
  return {
    analyzeProject: vi.fn(() => metered(fixtureCheck.analysis)),
    generateProjectExercises: vi.fn((_check, _signal, mode) =>
      metered({
        code: mode === "code" ? Array(3).fill(task) : [],
        service: mode === "service" ? Array(3).fill(task) : [],
      }),
    ),
    generateProjectWorkshop: vi.fn(() => metered(plan)),
  };
}
const save = async () => {};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("selects canonical stages and rejects misspelled selections", () => {
  expect(parseContentStages()).toEqual(CONTENT_STAGES);
  expect(parseContentStages("proposed, observed,observed")).toEqual(["observed", "proposed"]);
  expect(() => parseContentStages("workshop")).toThrow("Stages must");
  expect(() => parseContentStages("")).toThrow("Stages must");
});
it("records every nested provider call with one identity per stage", async () => {
  const ai = providers();
  const snapshots = [];
  const report = await evaluateProjectContent(
    parseContentSnapshot(page),
    parseContentStages(),
    async (r) => snapshots.push(structuredClone(r)),
    ai,
  );
  expect(report.passed).toBe(true);
  expect(report.usage.requests).toBe(10);
  expect(report.usage.inputTokens).toBe(1000);
  expect(report.usage.estimatedCostUsd).toBeGreaterThan(0);
  expect(new Set(Object.values(report.stages).map((s) => s.requestId)).size).toBe(5);
  for (const stage of Object.values(report.stages)) {
    expect(stage.runs).toHaveLength(2);
    expect(stage.runs.every((run) => run.requestId === stage.requestId)).toBe(true);
  }
  expect(ai.generateProjectExercises.mock.calls[1][3]).toHaveLength(3);
  expect(ai.generateProjectWorkshop.mock.calls.map((call) => call[2])).toEqual([
    "observed",
    "proposed",
  ]);
  expect(ai.generateProjectWorkshop.mock.calls[1][3]).toEqual([]);
  expect(
    snapshots.some((r) => r.stages.analysis?.status === "running" && r.usage.requests === 1),
  ).toBe(true);
});
it("continues independent workshops after code failure and never substitutes its saved draft", async () => {
  const ai = providers();
  ai.generateProjectExercises.mockRejectedValue(new Error("private provider response"));
  const report = await evaluateProjectContent(
    parseContentSnapshot({ page, code: Array(3).fill(task) }),
    parseContentStages(),
    save,
    ai,
  );
  expect(report.stages.code.status).toBe("failed");
  expect(report.stages.service.status).toBe("skipped");
  expect(report.stages.observed.status).toBe("passed");
  expect(report.stages.proposed.status).toBe("passed");
  expect(report).not.toHaveProperty("code");
  expect(report.passed).toBe(false);
  expect(JSON.stringify(report)).not.toContain("private provider response");
});
it("does not fall back to old analysis when its selected regeneration failed", async () => {
  const ai = providers();
  ai.analyzeProject.mockRejectedValue(new Error("failed"));
  const report = await evaluateProjectContent(
    parseContentSnapshot({ page, analysis: fixtureCheck.analysis }),
    parseContentStages(),
    save,
    ai,
  );
  expect(report.stages.analysis.status).toBe("failed");
  expect(CONTENT_STAGES.slice(1).every((name) => report.stages[name].status === "skipped")).toBe(
    true,
  );
  expect(ai.generateProjectExercises).not.toHaveBeenCalled();
  expect(ai.generateProjectWorkshop).not.toHaveBeenCalled();
});
it("reuses analysis from legacy reports for workshop-only reruns without extra calls", async () => {
  const ai = providers();
  const report = await evaluateProjectContent(
    parseContentSnapshot({ page, analysis: fixtureCheck.analysis, analysisRuns: [] }),
    parseContentStages("observed,proposed"),
    save,
    ai,
  );
  expect(report.passed).toBe(true);
  expect(report.stages.analysis.status).toBe("reused");
  expect(report.stages.analysis.requestId).toBeUndefined();
  expect(report.usage.requests).toBe(4);
  expect(ai.analyzeProject).not.toHaveBeenCalled();
  expect(ai.generateProjectExercises).not.toHaveBeenCalled();
  const missing = await evaluateProjectContent(
    parseContentSnapshot(page),
    parseContentStages("service"),
    save,
    ai,
  );
  expect(missing.stages.service.status).toBe("skipped");
  expect(missing.usage.requests).toBe(0);
});
it("retains specific quality findings but never provider secrets or bodies", () => {
  const secret = "sk-fixture-secret-not-real";
  vi.stubEnv("OPENAI_API_KEY", secret);
  const provider = new OpenAI.APIError(429, { message: secret }, secret, new Headers());
  expect(safeContentFailure(provider)).toMatchObject({ errorType: "ProviderError", status: 429 });
  expect(JSON.stringify(safeContentFailure(provider))).not.toContain(secret);
  expect(safeContentFailure(new OpenAI.APIConnectionTimeoutError({ message: secret }))).toEqual({
    errorType: "TimeoutError",
    reason: "The provider request exceeded its time limit.",
  });
  expect(safeContentFailure(new OpenAI.APIUserAbortError({ message: secret }))).toEqual({
    errorType: "AbortError",
    reason: "The provider request was cancelled by the stage signal.",
  });
  const quality = new ContentQualityError([
    {
      id: "code-0",
      issue: "missing_evidence",
      reason: `선행 반환 조건이 누락됨 ${secret}`,
      supportedChoices: [],
      answerLeakQuote: `답을 알려주는 문구 ${secret}`,
      serviceOutcome: "internal_only",
    },
  ]);
  expect(safeContentFailure(quality).findings[0]).toEqual({
    id: "code-0",
    issue: "missing_evidence",
    reason: "선행 반환 조건이 누락됨 [redacted]",
    supportedChoices: [],
    answerLeakQuote: "답을 알려주는 문구 [redacted]",
    serviceOutcome: "internal_only",
  });
  quality.findings[0].answerLeakQuote = null;
  quality.findings[0].serviceOutcome = null;
  expect(safeContentFailure(quality).findings[0]).toMatchObject({
    answerLeakQuote: null,
    serviceOutcome: null,
  });
});
it("observes only successful JSON drafts without consuming responses or retaining request metadata", async () => {
  const body = {
    model: "model",
    usage: { input_tokens: 12, output_tokens: 3 },
    output: [{ content: [{ type: "output_text", text: '{"answer":1}' }] }],
  };
  const original = vi
    .fn()
    .mockResolvedValueOnce(Response.json(body))
    .mockResolvedValueOnce(new Response("provider-secret-body", { status: 500 }));
  vi.stubGlobal("fetch", original);
  const drafts = [];
  await captureContentDrafts(drafts, async () => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      headers: { Authorization: "request-secret" },
      body: "private-request",
    });
    expect(await response.json()).toEqual(body);
    await fetch("https://api.openai.com/v1/responses");
  });
  expect(globalThis.fetch).toBe(original);
  expect(drafts).toEqual([
    { model: "model", usage: { inputTokens: 12, outputTokens: 3 }, output: [{ answer: 1 }] },
  ]);
  expect(JSON.stringify(drafts)).not.toMatch(/secret|private-request/);
});
it("dry-run CLI performs no input reads or output writes even with a missing snapshot", () => {
  const text = execFileSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "scripts/evaluate-project-content.ts",
      "--snapshot",
      "missing-snapshot.json",
      "--out",
      "/outside-artifacts/no-file.json",
      "--stages",
      "observed,proposed",
    ],
    { encoding: "utf8", env: { ...process.env, OPENAI_API_KEY: "", TYPESAFE_API_KEY: "" } },
  );
  expect(text).toContain("No API calls or file writes");
});

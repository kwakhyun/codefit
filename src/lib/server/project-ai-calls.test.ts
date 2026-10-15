import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { fixtureCheck } from "../project-check/fixtures";
import type { AiRun } from "../ai-telemetry";
import { SqliteStore } from "./sqlite-store";
import { ProjectCheckService } from "./project-check-service";
import { withAiCallContext, withAiTelemetry } from "./ai-telemetry";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));

const owner = "user:ai-call-test";
const repository = {
  name: "owner/example",
  commit: "a".repeat(40),
  totalFiles: 1,
  eligibleFiles: 1,
  omittedFiles: 0,
  truncatedTree: false,
  links: [],
  files: [
    { path: "main.py", totalLines: 1, partial: false, lines: [{ number: 1, text: "return 200" }] },
  ],
};
const task = {
  title: "반환 조건 살펴보기",
  purpose: "결과를 결정하는 코드를 찾습니다.",
  guidance: {
    goal: "반환 값을 찾을 수 있어요.",
    terms: [{ term: "return", meaning: "결과를 돌려주는 명령" }],
    readingSteps: ["반환 명령을 찾으세요.", "반환하는 값을 확인하세요."],
    takeaway: "반환 값으로 호출 결과가 정해집니다.",
  },
  situation: "함수가 호출됐습니다.",
  assumptions: "인용한 반환 명령에 도달합니다.",
  evidence: ["CFREF_1"],
  question: "어떤 결과를 받나요?",
  correctChoice: "200",
  distractors: ["400"],
  walkthrough: [
    { action: "반환 명령 확인", result: "200을 확인합니다." },
    { action: "함수 종료", result: "200을 돌려줍니다." },
  ],
  explanation: "인용 코드가 200을 반환합니다.",
  verification: "테스트 환경에서 반환 값 비교",
};
const practice = (mode: "code" | "service") => ({
  code:
    mode === "code"
      ? Array.from({ length: 3 }, (_, i) => ({ ...task, question: `코드 입력 ${i}의 결과는?` }))
      : [],
  service:
    mode === "service"
      ? Array.from({ length: 3 }, (_, i) => ({
          ...task,
          question: `서비스 입력 ${i}의 결과는?`,
          serviceScenario: {
            actor: "테스트 사용자",
            action: "결과를 요청합니다.",
            before: "첫 요청 전입니다.",
            changed: "요청을 반복합니다.",
            observe: "반환 결과를 비교합니다.",
          },
        }))
      : [],
});
const topic = {
  kind: "observed",
  title: "AI 인증 살펴보기",
  tool: "AI",
  purpose: "인증 판단 확인",
  evidence: ["CFREF_1"],
  explanation: "AI가 인증 결과를 결정합니다.",
  steps: [
    { action: "입력 확인", expected: "인증 상태" },
    { action: "호출 확인", expected: "판단 결과" },
  ],
  tradeoff: "일반 조건문을 사용할 수도 있습니다.",
  verification: "테스트 환경에서 결과 비교",
  lessonIds: ["output-validation"],
  question: "인증을 누가 결정하나요?",
  correctChoice: "AI",
  distractors: ["기존 코드"],
  feedback: "AI 판단을 사용합니다.",
};
const workshop = {
  summary: "AI 활용 학습",
  limitations: "일부 코드만 수집했습니다.",
  topics: [topic, { ...topic, title: "별도 학습", question: "별도 질문은?" }],
};
const response = (output_parsed: unknown) => ({
  output_parsed,
  model: "gpt-5.4-mini",
  usage: { input_tokens: 100, input_tokens_details: { cached_tokens: 0 }, output_tokens: 10 },
});
type ReviewRequest = { input: { content: string }[] };
function review(request: ReviewRequest, fail = false) {
  const { items } = JSON.parse(request.input[1].content) as {
    items: { id: string; choices: string[] }[];
  };
  return response({
    reviews: items.map((item, index) => ({
      id: item.id,
      answerLeakQuote: null,
      serviceOutcome: item.id.startsWith("service-") ? "observable" : null,
      supportedChoices: [item.choices.findIndex((choice) => choice === "200" || choice === "AI")],
      issue: fail && index === 0 ? "unsupported_claim" : null,
      reason: fail && index === 0 ? "인용 코드에 AI 호출이 없습니다." : "",
    })),
  });
}
let store: SqliteStore;
let id: string;
let service: ProjectCheckService;
beforeEach(async () => {
  parse.mockReset();
  store = new SqliteStore(":memory:");
  service = new ProjectCheckService(store);
  id = randomUUID();
  const claim = store.startJob(owner, id, "project-analysis", "source");
  if (claim.state !== "new") throw Error("lease");
  await store.queries.projectChecks.complete(claim.lease, {
    ...fixtureCheck,
    id,
    page: { ...fixtureCheck.page, source: "repository", repository },
  });
});
afterEach(() => store.db.close());
const advance = (kind: "practice" | "workshop") =>
  service.advanceLearning(owner, "net", id, kind, AbortSignal.timeout(5000));
const runs = () =>
  store.db
    .prepare("SELECT content FROM ai_runs WHERE owner=? ORDER BY rowid")
    .all(owner)
    .map((row) => JSON.parse((row as { content: string }).content) as AiRun);
const count = (key = "ai:global:day") =>
  (
    store.db.prepare("SELECT count FROM limits WHERE key=?").get(key) as
      { count: number } | undefined
  )?.count;

it("records and budgets both generation and review, then reuses completed stages without new calls", async () => {
  for (const mode of ["code", "service"] as const)
    parse
      .mockResolvedValueOnce(response(practice(mode)))
      .mockImplementationOnce((request) =>
        response({
          items: JSON.parse(request.input[1].content).items.map(
            ({
              id,
              title,
              purpose,
              guidance,
            }: {
              id: string;
              title: string;
              purpose: string;
              guidance: { takeaway?: string };
            }) => {
              const { takeaway, ...shown } = guidance;
              void takeaway;
              return { id, title, purpose, guidance: shown };
            },
          ),
        }),
      )
      .mockImplementationOnce((request) => review(request));
  expect(await advance("practice")).toMatchObject({ status: "pending" });
  expect(runs()).toHaveLength(3);
  expect(count()).toBe(3);
  const saved = await advance("practice");
  expect(saved.status).toBe("done");
  expect(await advance("practice")).toEqual(saved);
  expect(parse).toHaveBeenCalledTimes(6);
  expect(count()).toBe(6);
  expect(runs()).toHaveLength(6);
  expect(
    runs().every(
      (run) =>
        run.requestId === `${id}:practice` && run.inputTokens === 100 && run.estimatedCostUsd! > 0,
    ),
  ).toBe(true);
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(4);
});

it("reviews and repairs workshop content once, preserving unflagged topics and recording all four calls", async () => {
  const repaired = structuredClone(workshop);
  repaired.topics.forEach((entry) => {
    entry.title = "수정된 학습";
  });
  parse
    .mockResolvedValueOnce(response(workshop))
    .mockImplementationOnce((request) => review(request, true))
    .mockResolvedValueOnce(response(repaired))
    .mockImplementationOnce((request) => review(request));
  const result = await service.generateWorkshop(owner, "net", id, AbortSignal.timeout(5000));
  expect(result.plan.topics[0].title).toBe("수정된 학습");
  expect(result.plan.topics[1].title).toBe("별도 학습");
  expect(parse).toHaveBeenCalledTimes(4);
  expect(count()).toBe(4);
  expect(runs()).toHaveLength(4);
  expect(runs().every((run) => run.requestId === `${id}:workshop`)).toBe(true);
});

it("never saves a workshop whose false implementation claim still fails after repair", async () => {
  for (let i = 0; i < 2; i++)
    parse
      .mockResolvedValueOnce(response(workshop))
      .mockImplementationOnce((request) => review(request, true));
  await expect(
    service.generateWorkshop(owner, "net", id, AbortSignal.timeout(5000)),
  ).rejects.toMatchObject({ status: 502 });
  expect(parse).toHaveBeenCalledTimes(4);
  expect(await store.queries.projectChecks.workshop(owner, id)).toBeNull();
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(5);
  expect(count()).toBe(4);
  expect(runs()).toHaveLength(4);
});

it("can remove a misclassified observed topic instead of inventing AI use to fill a repair slot", async () => {
  parse
    .mockResolvedValueOnce(response({ ...workshop, topics: [topic] }))
    .mockImplementationOnce((request) => review(request, true))
    .mockResolvedValueOnce(response({ ...workshop, topics: [null] }));
  expect(await advance("workshop")).toMatchObject({ status: "pending", completed: 1 });
  const part = await store.queries.projectChecks.learningStage(owner, id, "workshop", "observed");
  expect(part).toMatchObject({
    topics: [],
    summary: expect.stringContaining("확인하지 못했습니다"),
  });
  expect(parse).toHaveBeenCalledTimes(3);
  expect(count()).toBe(3);
  expect(runs()).toHaveLength(3);
});

it.each([
  ["ai:global:hour", 40],
  ["ai:global:day", 100],
] as const)("stops before the next provider call when %s is exhausted", async (key, max) => {
  store.consumeLimits([{ key, max, cost: max - 1, windowMs: 86_400_000 }]);
  parse.mockResolvedValueOnce(response(practice("code")));
  await expect(advance("practice")).rejects.toMatchObject({ status: 429 });
  expect(parse).toHaveBeenCalledTimes(1);
  expect(count(key)).toBe(max);
  expect(runs()).toHaveLength(1);
  expect(await store.queries.projectChecks.learningStage(owner, id, "practice", "code")).toBeNull();
});

it("records provider failures with the request identity and keeps their budget charged", async () => {
  parse.mockRejectedValueOnce(new Error("provider unavailable"));
  await expect(advance("workshop")).rejects.toThrow("provider unavailable");
  expect(runs()).toMatchObject([
    { requestId: `${id}:workshop`, outcome: "error", inputTokens: null },
  ]);
  expect(count()).toBe(1);
});

it("keeps concurrent request telemetry and budgets isolated", async () => {
  const records = [vi.fn(), vi.fn()];
  const guards = [vi.fn(), vi.fn()];
  await Promise.all(
    records.map((record, i) =>
      withAiCallContext(
        {
          requestId: `request-${i}`,
          record,
          beforeCall: guards[i],
        },
        async () => {
          await Promise.resolve();
          await withAiTelemetry("project", "test", async () => {
            await Promise.resolve();
          });
        },
      ),
    ),
  );
  for (let i = 0; i < 2; i++) {
    expect(guards[i]).toHaveBeenCalledTimes(1);
    expect(records[i]).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ requestId: `request-${i}` }),
    );
  }
});

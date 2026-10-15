import { beforeEach, expect, it, vi } from "vitest";
import { fixtureAnalysis } from "../project-check/fixtures";
import type { ProjectExercises } from "../project-check/generated-practice";
import type { RepositorySnapshot } from "../project-check/repository";
import type { WorkshopPlan } from "../ai-learning/project-workshop";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
import {
  assertProjectContentQuality,
  contentReviewFailures,
  contentReviewInput,
  reviewProjectContent,
} from "./project-content-quality";

const repository: RepositorySnapshot = {
  name: "owner/project",
  commit: "a".repeat(40),
  totalFiles: 1,
  eligibleFiles: 1,
  omittedFiles: 0,
  truncatedTree: false,
  links: [],
  files: [
    {
      path: "src/save.ts",
      partial: false,
      totalLines: 3,
      lines: [
        { number: 1, text: "if (job.result) return job.result;" },
        { number: 2, text: "if (job.closing) throw new Error('busy');" },
        { number: 3, text: "return save(job);" },
      ],
    },
  ],
};
const content = {
  exercises: {
    code: [
      {
        title: "중복 요청",
        question: "두 번째 요청의 결과는?",
        assumptions: "기존 결과가 있습니다.",
        evidence: ["src/save.ts:L2 if (job.closing) throw new Error('busy');"],
        choices: ["거부", "기존 결과"],
        answer: 0,
      },
    ],
    service: [],
  } as unknown as ProjectExercises,
};
const verdict = (answers: number[], issue: "missing_evidence" | null = null) => ({
  reviews: [
    {
      id: "code-0",
      answerLeakQuote: null,
      serviceOutcome: null,
      supportedChoices: answers,
      issue,
      reason: issue ? "앞선 반환 조건이 빠졌습니다." : "",
    },
  ],
});
beforeEach(() => parse.mockReset());

it("withholds the answer key and separates learner evidence from preceding context", () => {
  const input = contentReviewInput(repository, content);
  expect(input.items[0]).not.toHaveProperty("answer");
  expect(input.items[0]).not.toHaveProperty("explanation");
  expect(input.items[0]).toHaveProperty("feedbackAfterAnswer");
  expect(input.items[0].evidence[0]).not.toContain("job.result");
  expect(input.context[0].code).toContain("if (job.result) return job.result");
  expect(input.context[0].partial).toBe(false);
});
it("rejects a different independently solved answer, ambiguous answers and quality issues", () => {
  expect(contentReviewFailures(content, verdict([0]))).toEqual([]);
  for (const result of [
    verdict([1]),
    verdict([]),
    verdict([0, 1]),
    verdict([0], "missing_evidence"),
  ])
    expect(contentReviewFailures(content, result)).toHaveLength(1);
});
it("rejects answer-revealing purposes, identifier definitions and assumptions even with a correct verdict", () => {
  for (const field of ["purpose", "term", "assumptions"] as const) {
    const example = structuredClone(content);
    const task = example.exercises.code[0];
    const quote =
      field === "purpose"
        ? "실패를 성공으로 표시하지 않도록 합니다"
        : field === "term"
          ? "기존 기록과 새 기록을 합친 목록"
          : "저장 호출 두 번은 모두 성공합니다";
    if (field === "term")
      task.guidance = {
        goal: "저장할 기록을 비교합니다",
        terms: [{ term: "pendingRecords", meaning: quote }],
        readingSteps: ["저장 인자를 찾으세요", "처리 순서를 비교하세요"],
        takeaway: "답안 제출 뒤의 설명",
      };
    else task[field] = quote;
    const review = verdict([0]);
    const result = contentReviewFailures(example, {
      reviews: [{ ...review.reviews[0], answerLeakQuote: quote }],
    });
    expect(result).toEqual([expect.objectContaining({ issue: "answer_leak" })]);
    expect(result[0].reason).toContain(quote);
  }
});
it("requires leakage witnesses to come from prose visible before answering", () => {
  const example = structuredClone(content);
  example.exercises.code[0].explanation = "제출 뒤에만 보이는 정답 설명";
  for (const quote of ["제출 뒤에만 보이는 정답 설명", "거부", "job.closing", "없는 문구"]) {
    expect(() =>
      contentReviewFailures(example, {
        reviews: [{ ...verdict([0]).reviews[0], answerLeakQuote: quote }],
      }),
    ).toThrow("인용 문구");
  }
  expect(() =>
    contentReviewFailures(example, {
      reviews: [{ ...verdict([0]).reviews[0], issue: "answer_leak", answerLeakQuote: null }],
    }),
  ).toThrow("인용 문구");
});
it("separately rejects internal-value quizzes presented as service exercises", () => {
  const example = structuredClone(content);
  example.exercises.service = example.exercises.code;
  example.exercises.code = [];
  const review = { ...verdict([0]).reviews[0], id: "service-0" };
  expect(
    contentReviewFailures(example, {
      reviews: [{ ...review, serviceOutcome: "internal_only" }],
    }),
  ).toEqual([expect.objectContaining({ issue: "not_service_scenario" })]);
  expect(
    contentReviewFailures(example, { reviews: [{ ...review, serviceOutcome: "observable" }] }),
  ).toEqual([]);
});
it("rejects invalid citations before they can silently lose surrounding context", () => {
  const invalid = structuredClone(content);
  invalid.exercises.code[0].evidence = ["src/save.ts:L2 invented();"];
  expect(() => contentReviewInput(repository, invalid)).toThrow("코드 근거");
  expect(parse).not.toHaveBeenCalled();
});
it("rejects missing, duplicated and invented review identities", () => {
  for (const reviews of [
    [],
    [...verdict([0]).reviews, ...verdict([0]).reviews],
    [{ ...verdict([0]).reviews[0], id: "code-99" }],
  ])
    expect(() => contentReviewFailures(content, { reviews })).toThrow("끝나지");
});
it("accepts open-ended analysis without a fabricated answer key", () => {
  const review = {
    reviews: fixtureAnalysis.questions.map((_, i) => ({
      id: `analysis-${i}`,
      answerLeakQuote: null,
      serviceOutcome: null,
      supportedChoices: [],
      issue: null,
      reason: "",
    })),
  };
  expect(contentReviewFailures({ analysis: fixtureAnalysis }, review)).toEqual([]);
  review.reviews[0].supportedChoices = [0] as never[];
  expect(contentReviewFailures({ analysis: fixtureAnalysis }, review)).toHaveLength(1);
});
it("does not release content when independent review fails or is malformed", async () => {
  parse.mockResolvedValueOnce({ output_parsed: verdict([1], "missing_evidence") });
  await expect(
    assertProjectContentQuality(repository, content, AbortSignal.timeout(1000)),
  ).rejects.toMatchObject({ status: 502, findings: [expect.objectContaining({ id: "code-0" })] });
  parse.mockResolvedValueOnce({ output_parsed: null });
  await expect(
    assertProjectContentQuality(repository, content, AbortSignal.timeout(1000)),
  ).rejects.toMatchObject({ status: 502 });
  parse.mockRejectedValueOnce(new Error("review unavailable"));
  await expect(
    assertProjectContentQuality(repository, content, AbortSignal.timeout(1000)),
  ).rejects.toThrow("review unavailable");
});
it("uses a bounded tool-free review and forwards cancellation", async () => {
  parse.mockResolvedValue({ output_parsed: verdict([0]) });
  const signal = AbortSignal.timeout(1000);
  await reviewProjectContent(repository, content, signal);
  const [request, options] = parse.mock.calls[0];
  expect(request.store).toBe(false);
  expect(request.tools).toBeUndefined();
  expect(request.max_output_tokens).toBe(4000);
  expect(options.signal).toBe(signal);
  expect(request.input[0].content).toContain("untrusted DATA");
  expect(request.text.format.schema.properties.reviews.items.required).toEqual(
    expect.arrayContaining(["answerLeakQuote", "serviceOutcome"]),
  );
});
it("records categorical quality failures without saving source, review prose or answers", async () => {
  const rejected = verdict([1], "missing_evidence");
  rejected.reviews[0].reason = "private source details must stay out of telemetry";
  parse.mockResolvedValue({ output_parsed: rejected, model: "gpt-5.6-sol" });
  const record = vi.fn();
  const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
  try {
    await expect(
      assertProjectContentQuality(repository, content, AbortSignal.timeout(1000), record),
    ).rejects.toMatchObject({ status: 502 });
    expect(record).toHaveBeenLastCalledWith(
      expect.objectContaining({
        outcome: "success", // Provider succeeded; the independent semantic gate rejected it.
        contentQuality: {
          verdict: "rejected",
          issues: [{ item: "code-0", code: "missing_evidence" }],
        },
      }),
    );
    expect(JSON.stringify([record.mock.calls, warning.mock.calls])).not.toContain("private source");
    expect(JSON.stringify(record.mock.calls)).not.toContain("supportedChoices");
    parse.mockResolvedValue({ output_parsed: verdict([0]), model: "gpt-5.6-sol" });
    await assertProjectContentQuality(repository, content, AbortSignal.timeout(1000), record);
    expect(record.mock.calls.at(-1)![0].contentQuality).toEqual({ verdict: "passed", issues: [] });
  } finally {
    warning.mockRestore();
  }
});

const workshop = {
  summary: "인증 학습",
  limitations: "일부 코드만 확인했습니다.",
  topics: [
    {
      kind: "observed",
      evidence: ["src/save.ts:L3 return save(job);"],
      question: "AI가 인증 여부를 결정하나요?",
      choices: ["AI가 인증한다", "코드만으로 확인할 수 없다"],
      answer: 0,
      feedback: "AI가 인증을 처리합니다.",
      explanation: "이 코드는 AI를 호출합니다.",
    },
  ],
} as WorkshopPlan;

it("independently reviews workshop classification, evidence and answers without leaking the key", async () => {
  const content = { workshop, previousTopics: ["이전 학습"] };
  const input = contentReviewInput(repository, content);
  expect(input.items[0]).not.toHaveProperty("answer");
  expect(input.items[0]).toMatchObject({ kind: "workshop", application: "observed" });
  expect(input.items[0]).toHaveProperty("feedbackAfterAnswer");
  expect(input.previousTopics).toEqual(["이전 학습"]);
  for (const row of [
    { supportedChoices: [1], issue: null },
    { supportedChoices: [0, 1], issue: null },
    { supportedChoices: [0], issue: "unsupported_claim" },
  ]) {
    parse.mockResolvedValueOnce({
      output_parsed: {
        reviews: [
          {
            id: "workshop-0",
            answerLeakQuote: null,
            serviceOutcome: null,
            ...row,
            reason: "인용한 코드에 AI 호출이 없습니다.",
          },
        ],
      },
    });
    await expect(
      assertProjectContentQuality(repository, content, AbortSignal.timeout(1000)),
    ).rejects.toMatchObject({
      status: 502,
      findings: [expect.objectContaining({ id: "workshop-0" })],
    });
  }
  expect(parse.mock.calls[0][0].input[0].content).toContain("application=observed requires");
});

it("accepts an empty AI topic list without an unnecessary provider call", async () => {
  await assertProjectContentQuality(
    repository,
    { workshop: { ...workshop, topics: [] } },
    AbortSignal.timeout(1000),
  );
  expect(parse).not.toHaveBeenCalled();
});

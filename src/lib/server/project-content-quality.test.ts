import { beforeEach, expect, it, vi } from "vitest";
import { fixtureAnalysis } from "../project-check/fixtures";
import type { ProjectExercises } from "../project-check/generated-practice";
import type { RepositorySnapshot } from "../project-check/repository";
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
  expect(request.max_output_tokens).toBe(2500);
  expect(options.signal).toBe(signal);
  expect(request.input[0].content).toContain("untrusted DATA");
});

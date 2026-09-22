import { expect, it, vi } from "vitest";
const mocked = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse: mocked.parse };
  },
}));
import { fixtureAnalysis } from "../project-check/fixtures";
import { analyzeProject } from "./ai-project-check";
import { analysisSchema, AREAS, type PageSnapshot } from "../project-check/types";
import { extractSource } from "./project-repository";
const source = "return " + "x".repeat(350);
const file = extractSource("src/service.ts", source);
const page: PageSnapshot = {
  url: "https://github.com/owner/repo",
  title: "repo",
  fetchedAt: new Date().toISOString(),
  text: `src/service.ts:L1 ${source}`,
  source: "repository",
  limited: true,
  repository: {
    name: "owner/repo",
    commit: "a".repeat(40),
    totalFiles: 1,
    eligibleFiles: 1,
    omittedFiles: 0,
    truncatedTree: false,
    files: [file],
    links: [],
  },
};
const response = (evidence: string) => ({
  output_parsed: {
    title: "프로젝트",
    summary: "공개 코드 검토",
    questions: AREAS.map((area) => ({
      area,
      learning: fixtureAnalysis.questions[0].learning,
      question: "이 처리 흐름을 어떻게 확인하나요?",
      basis: "page",
      evidence,
      criteria: ["처리 흐름", "확인 방법"],
    })),
  },
  model: "gpt-5.6-sol",
});
it("maps bounded evidence IDs to exact source and preserves long citations in storage contracts", async () => {
  mocked.parse.mockResolvedValue(response("CFREF_1"));
  const result = await analyzeProject(page, "", AbortSignal.timeout(1000));
  expect(result.questions[0].evidence).toBe(page.text);
  expect(analysisSchema.safeParse(result).success).toBe(true);
  const args = mocked.parse.mock.calls.at(-1)![0];
  const input = JSON.parse(args.input[1].content[0].text);
  expect(input.page.text).toBeUndefined();
  expect(input.page.snippets[0].id).toBe("CFREF_1");
});
it("rejects decorated IDs even if a provider returns malformed structured output", async () => {
  mocked.parse.mockResolvedValue(response("CFREF_1 Wait invalid"));
  await expect(analyzeProject(page, "", AbortSignal.timeout(1000))).rejects.toThrow("형식");
});
it("keeps exact text citation behavior for public websites", async () => {
  mocked.parse.mockResolvedValue(response("공개 화면에서 확인한 기능"));
  const result = await analyzeProject(
    { ...page, repository: undefined, source: "html", text: "공개 화면에서 확인한 기능" },
    "",
    AbortSignal.timeout(1000),
  );
  expect(result.questions[0].evidence).toBe("공개 화면에서 확인한 기능");
});
it("preserves owner-reported design separately from repository evidence", async () => {
  const output = response("DESCRIPTION");
  for (const question of output.output_parsed.questions) question.basis = "description";
  mocked.parse.mockResolvedValue(output);
  const description = "소유자가 직접 설명한 배포 후 확인 계획입니다.";
  const result = await analyzeProject(page, description, AbortSignal.timeout(1000));
  expect(
    result.questions.every((q) => q.basis === "description" && q.evidence === description),
  ).toBe(true);
});

it("requires contextual question guidance for new analyses but preserves legacy records", async () => {
  const output = response("CFREF_1");
  for (const q of output.output_parsed.questions) q.learning = undefined;
  expect(
    analysisSchema.safeParse({
      ...output.output_parsed,
      questions: output.output_parsed.questions.map(({ learning, ...q }) => {
        void learning;
        return q;
      }),
    }).success,
  ).toBe(true);
  mocked.parse.mockResolvedValue(output);
  await expect(analyzeProject(page, "", AbortSignal.timeout(1000))).rejects.toThrow("형식");
});

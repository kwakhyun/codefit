import { beforeEach, expect, it, vi } from "vitest";
import { fixtureCheck } from "../project-check/fixtures";
import { generateProjectWorkshop } from "./ai-project-check";
import { assertProjectContentQuality } from "./project-content-quality";

const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
vi.mock("./project-content-quality", async (original) => ({
  ...(await original<typeof import("./project-content-quality")>()),
  assertProjectContentQuality: vi.fn(),
}));
vi.mock("./ai-telemetry", () => ({
  withAiTelemetry: async (_a: unknown, _b: unknown, task: (capture: () => void) => unknown) =>
    task(() => {}),
}));

const source = [
  { path: "src/infer.ts", code: "return model.generate({ prompt: question });" },
  { path: "src/validate.ts", code: "return answer.valid && answer.evidenceIds.length > 0;" },
  {
    path: "src/save.ts",
    code: 'if (!accepted) throw new Error("Rejected");\nawait store.save(answer);',
  },
];
const check = {
  ...fixtureCheck,
  page: {
    ...fixtureCheck.page,
    repository: {
      name: "owner/example",
      commit: "a".repeat(40),
      totalFiles: source.length,
      eligibleFiles: source.length,
      omittedFiles: 0,
      truncatedTree: false,
      links: [],
      files: source.map(({ path, code }) => ({
        path,
        partial: false,
        totalLines: code.split("\n").length,
        lines: code.split("\n").map((text, index) => ({ number: index + 1, text })),
      })),
    },
  },
};
const topic = {
  kind: "observed",
  title: "모델 응답의 저장 조건 살펴보기",
  tool: "언어 모델 — 질문을 입력받아 응답을 생성하는 도구",
  purpose: "모델 응답과 저장 조건을 구분합니다.",
  evidence: ["CFREF_1", "CFREF_2", "CFREF_3"],
  explanation: "질문으로 모델을 호출합니다. 검증 조건과 저장 조건은 별도 함수에 있습니다.",
  steps: [
    { action: "모델 호출의 입력을 확인합니다.", expected: "질문이 입력으로 전달됩니다." },
    {
      action: "저장 함수의 accepted를 false로 설정합니다.",
      expected: "저장 전에 오류가 발생합니다.",
    },
  ],
  tradeoff: "정해진 답변이면 조건문이 더 단순하고 호출 비용도 없습니다.",
  verification: "폐기 가능한 테스트에서 accepted가 false일 때 저장이 호출되지 않는지 확인합니다.",
  lessonIds: ["output-validation"],
  question: "저장 함수에서 accepted가 false이면 어떻게 되나요?",
  correctChoice: "오류가 발생해 store.save에 도달하지 않습니다.",
  distractors: ["store.save를 실행한 뒤 오류가 발생합니다."],
  feedback: "거절 조건은 저장 호출보다 먼저 실행됩니다.",
};
const plan = {
  summary: "질문을 모델에 전달하는 프로젝트입니다.",
  limitations: "인용된 함수 사이의 호출 연결과 실행 결과는 확인하지 않았습니다.",
  topics: [topic],
};

beforeEach(() => {
  parse.mockReset();
  vi.mocked(assertProjectContentQuality).mockReset().mockResolvedValue();
});

it("passes the complete selected invocation, validation and storage citations to independent review", async () => {
  parse.mockResolvedValue({ output_parsed: plan });
  const result = await generateProjectWorkshop(check, AbortSignal.timeout(5000), "observed");
  expect(result.topics[0].evidence).toEqual([
    "src/infer.ts:L1 return model.generate({ prompt: question });",
    "src/validate.ts:L1 return answer.valid && answer.evidenceIds.length > 0;",
    'src/save.ts:L1 if (!accepted) throw new Error("Rejected");\nsrc/save.ts:L2 await store.save(answer);',
  ]);
  expect(result.topics[0].tool).toBe(topic.tool);
  expect(result.topics[0].explanation).toBe(topic.explanation);
  expect(assertProjectContentQuality).toHaveBeenCalledWith(
    check.page.repository,
    { workshop: result, previousTopics: undefined },
    expect.any(AbortSignal),
  );
});

it("rejects an overlong tool description instead of silently cutting its meaning", async () => {
  const overlong = "완전한 도구 설명입니다. ".repeat(10);
  parse.mockResolvedValue({ output_parsed: { ...plan, topics: [{ ...topic, tool: overlong }] } });
  await expect(
    generateProjectWorkshop(check, AbortSignal.timeout(5000), "observed"),
  ).rejects.toMatchObject({ status: 502 });
  expect(assertProjectContentQuality).not.toHaveBeenCalled();
  expect(parse).toHaveBeenCalledTimes(1);
});

import { beforeEach, expect, it, vi } from "vitest";
import type { ProjectExercises } from "../project-check/generated-practice";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
import { refinePracticeGuidance } from "./project-practice-guidance";

const task: ProjectExercises["code"][number] = {
  title: "기록 삭제하기",
  purpose: "기록 삭제를 확인합니다.",
  guidance: {
    goal: "삭제 경로를 찾습니다.",
    terms: [],
    readingSteps: ["조건을 찾으세요.", "반환을 살펴보세요."],
    takeaway: "조건이 거짓이면 삭제되지 않습니다.",
  },
  situation: "삭제를 요청합니다.",
  assumptions: "대상 기록이 있습니다.",
  question: "조건이 거짓이면 어떻게 되나요?",
  evidence: ["source.ts:L1 if (allowed) remove();"],
  choices: ["기록 유지", "기록 삭제"],
  answer: 0,
  walkthrough: [
    { action: "조건 비교", result: "거짓" },
    { action: "실행 확인", result: "삭제하지 않음" },
  ],
  explanation: "조건이 거짓입니다.",
  verification: "폐기 가능한 기록으로 비교하세요.",
};
const exercises: ProjectExercises = { code: [task, { ...task, title: "두 번째" }], service: [] };
const revision = (id: string) => ({
  id,
  title: "기록 삭제 요청 살펴보기",
  purpose: "조건에 따른 기록 상태를 비교합니다.",
  guidance: {
    goal: "요청 조건과 기록 상태를 비교할 수 있어요.",
    terms: [],
    readingSteps: ["입력 조건을 확인하세요.", "조건별 기록 상태를 비교하세요."],
  },
});
beforeEach(() => parse.mockReset());

it("edits only flagged scaffolds and preserves evidence, inputs, answers and hidden teaching", async () => {
  const original = structuredClone(exercises);
  parse.mockResolvedValue({ output_parsed: { items: [revision("code-0")] } });
  const result = await refinePracticeGuidance(exercises, AbortSignal.timeout(1000), ["code-0"]);
  expect(exercises).toEqual(original);
  expect(result.code[0]).toEqual({
    ...task,
    title: revision("code-0").title,
    purpose: revision("code-0").purpose,
    guidance: { ...revision("code-0").guidance, takeaway: task.guidance!.takeaway },
  });
  expect(result.code[1]).toBe(exercises.code[1]);
  const [request, options] = parse.mock.calls[0];
  expect(JSON.parse(request.input[1].content).items).toHaveLength(1);
  expect(request.store).toBe(false);
  expect(request.tools).toBeUndefined();
  expect(options.signal).toBeInstanceOf(AbortSignal);
});

it.each(
  [
    [],
    [revision("code-0"), revision("code-0")],
    [revision("code-0"), revision("service-9")],
    [{ ...revision("code-0"), answer: 1 }, revision("code-1")],
  ].map((items) => ({ items })),
)("refuses missing, duplicate, invented IDs and edits to protected fields", async ({ items }) => {
  parse.mockResolvedValue({ output_parsed: { items } });
  await expect(refinePracticeGuidance(exercises, AbortSignal.timeout(1000))).rejects.toMatchObject({
    status: 502,
  });
});

it("does not bypass the wording pass on provider failure or start work after cancellation", async () => {
  parse.mockRejectedValueOnce(new Error("offline"));
  await expect(refinePracticeGuidance(exercises, AbortSignal.timeout(1000))).rejects.toThrow(
    "offline",
  );
  parse.mockClear();
  const cancelled = new AbortController();
  cancelled.abort();
  await expect(refinePracticeGuidance(exercises, cancelled.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
  expect(parse).not.toHaveBeenCalled();
});

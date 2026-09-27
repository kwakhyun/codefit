import { expect, it, vi } from "vitest";
import { fixtureCheck } from "../project-check/fixtures";
import { generateProjectExercises } from "./ai-project-check";
const { parse } = vi.hoisted(() => ({ parse: vi.fn() }));
vi.mock("./project-content-quality", async (original) => ({
  ...(await original<typeof import("./project-content-quality")>()),
  assertProjectContentQuality: vi.fn(),
}));
import { assertProjectContentQuality, ContentQualityError } from "./project-content-quality";
vi.mock("openai", () => ({
  default: class {
    responses = { parse };
  },
}));
vi.mock("./ai-telemetry", () => ({
  withAiTelemetry: async (_a: unknown, _b: unknown, task: (capture: () => void) => unknown) =>
    task(() => {}),
}));
for (const mode of ["code", "service"] as const) {
  it(`validates the ${mode} stage with an empty unrequested track`, async () => {
    const task = {
      ...(mode === "service"
        ? {
            serviceScenario: {
              actor: "같은 작업을 다시 요청한 사용자",
              action: "완료한 요청을 다시 보냅니다.",
              before: "기존 결과가 저장되어 있습니다.",
              changed: "요청이 한 번 더 도착합니다.",
              observe: "기존 결과와 새 결과 중 어떤 것을 받는지 비교합니다.",
            },
          }
        : {}),
      title: "기존 결과 확인",
      purpose: "중복 실행 확인",
      guidance: {
        goal: "기존 결과를 돌려주는 조건을 찾을 수 있어요.",
        terms: [{ term: "previous", meaning: "이전에 저장한 처리 결과" }],
        readingSteps: ["if 안의 조건을 찾으세요.", "return이 돌려주는 값을 찾으세요."],
        takeaway: "조건에 따라 일찍 반환하면 이후 처리는 실행되지 않아요.",
      },
      situation: "기존 값이 있음",
      assumptions: "previous는 참",
      evidence: ["CFREF_1"],
      question: "결과는?",
      correctChoice: "previous",
      distractors: ["new"],
      walkthrough: [
        { action: "분기 확인", result: "참" },
        { action: "반환", result: "기존 결과" },
      ],
      explanation: "기존 값을 반환",
      verification: "같은 요청의 반환값 비교",
    };
    const output = {
      output_parsed: {
        code:
          mode === "code"
            ? Array.from({ length: 3 }, (_, i) => ({
                ...task,
                question: `조건 ${i + 1}의 결과는?`,
              }))
            : [],
        service:
          mode === "service"
            ? Array.from({ length: 3 }, (_, i) => ({
                ...task,
                question: `조건 ${i + 1}의 결과는?`,
              }))
            : [],
      },
    };
    parse.mockResolvedValue(output);
    const check = {
      ...fixtureCheck,
      page: {
        ...fixtureCheck.page,
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
              path: "src/main.ts",
              totalLines: 1,
              partial: false,
              lines: [{ number: 1, text: "if (previous) return previous;" }],
            },
          ],
        },
      },
    };
    const result = await generateProjectExercises(check, new AbortController().signal, mode);
    expect(result[mode]).toHaveLength(3);
    expect(assertProjectContentQuality).toHaveBeenCalledWith(
      check.page.repository,
      { exercises: result, previous: undefined },
      expect.any(AbortSignal),
    );
    expect(result[mode][0].guidance).toEqual(task.guidance);
    expect(result[mode === "code" ? "service" : "code"]).toEqual([]);
    const schema = parse.mock.calls.at(-1)![0].text.format.schema;
    expect(schema.properties[mode].items.required).toContain("guidance");
    expect(schema.properties[mode === "code" ? "service" : "code"]).toMatchObject({
      minItems: 0,
      maxItems: 0,
    });
    const issue = new ContentQualityError([
      {
        id: `${mode}-0`,
        supportedChoices: [],
        issue: "missing_evidence",
        reason: "반환 근거 누락",
      },
    ]);
    parse.mockClear();
    vi.mocked(assertProjectContentQuality).mockRejectedValueOnce(issue).mockResolvedValueOnce();
    const revision = structuredClone(output);
    revision.output_parsed[mode].forEach((entry, index) => {
      entry.question = `수정된 조건 ${index}의 결과는?`;
    });
    parse.mockResolvedValueOnce(output).mockResolvedValueOnce(revision);
    const repaired = await generateProjectExercises(check, new AbortController().signal, mode);
    expect(repaired[mode][0].question).toBe("수정된 조건 0의 결과는?");
    expect(repaired[mode][1]).toEqual(result[mode][1]);
    expect(repaired[mode][2]).toEqual(result[mode][2]);
    expect(parse).toHaveBeenCalledTimes(2);
    const repairedInput = JSON.parse(parse.mock.calls[1][0].input[1].content[0].text);
    expect(repairedInput.repair.findings[0].reason).toBe("반환 근거 누락");
    parse.mockClear();
    vi.mocked(assertProjectContentQuality).mockRejectedValue(issue);
    await expect(generateProjectExercises(check, new AbortController().signal, mode)).rejects.toBe(
      issue,
    );
    expect(parse).toHaveBeenCalledTimes(2); // Never retry indefinitely or return the draft.
    vi.mocked(assertProjectContentQuality).mockReset();
    parse.mockResolvedValue({
      output_parsed: {
        code: mode === "code" ? Array(3).fill(task) : [],
        service: mode === "service" ? Array(3).fill(task) : [],
      },
    });
    await expect(
      generateProjectExercises(check, new AbortController().signal, mode),
    ).rejects.toMatchObject({ status: 502 });
  });
}

import { describe, expect, it } from "vitest";
import {
  validWorkshopResponses,
  workshopProgress,
  workshopResponse,
  workshopSaveInputSchema,
  type ProjectWorkshop,
} from "./project-workshop";

const topic = {
  kind: "observed" as const,
  title: "문의 분류",
  tool: "Jev",
  purpose: "문의를 분류합니다.",
  evidence: ["src/a.ts:1 const a = 1;"],
  explanation: "설명",
  steps: [
    { action: "하나", expected: "결과" },
    { action: "둘", expected: "결과" },
  ],
  tradeoff: "비교",
  verification: "확인",
  lessonIds: ["jev-decisions" as const],
  question: "무엇을 확인할까요?",
  choices: ["가", "나", "다"],
  answer: 1,
  feedback: "해설",
};
function workshop(responses: ProjectWorkshop["responses"]): ProjectWorkshop {
  return {
    plan: { summary: "요약", limitations: "범위", topics: [topic, { ...topic, answer: 0 }] },
    responses,
    revision: 1,
    createdAt: new Date().toISOString(),
  };
}

describe("project AI workshop answers", () => {
  it("keeps the first saved choice when an answer is changed", () => {
    const input = { index: 0, revision: 1, response: { choice: 2, note: "" } };
    const first = workshopResponse(workshop([]), input);
    expect(first).toEqual({ choice: 2, note: "", firstChoice: 2 });
    const revised = workshopResponse(workshop([first]), {
      ...input,
      response: { choice: 1, note: "수정" },
    });
    expect(revised).toEqual({ choice: 1, note: "수정", firstChoice: 2 });
    // Answers saved before first choices were recorded stay without one.
    expect(workshopResponse(workshop([{ choice: 0, note: "" }]), input)).toEqual({
      choice: 2,
      note: "",
    });
    // The browser cannot send a first choice of its own.
    expect(
      workshopSaveInputSchema.safeParse({
        ...input,
        response: { ...input.response, firstChoice: 1 },
      }).success,
    ).toBe(false);
  });
  it("reports topic progress and first versus revised answers", () => {
    const value = workshop([{ choice: 1, note: "", firstChoice: 2 }, null]);
    expect(workshopProgress(value)).toMatchObject({
      answered: 1,
      total: 2,
      topics: [
        { answered: true, firstCorrect: false, revised: true, currentCorrect: true },
        { answered: false, firstCorrect: null, currentCorrect: null },
      ],
    });
    expect(validWorkshopResponses(value)).toBe(true);
    expect(validWorkshopResponses(workshop([{ choice: 1, note: "", firstChoice: 3 }]))).toBe(false);
  });
});

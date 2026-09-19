import { expect, it } from "vitest";
import { groundedAssessmentSchema, validateGroundedAssessment } from "./project-assessment";
import { evidenceLabels, type AssessmentEvidence } from "../project-check/types";
const empty = (): AssessmentEvidence => ({
  feature: null,
  flow: null,
  reason: null,
  failure: null,
  verification: null,
  tradeoff: null,
});
const answer =
  "예약 기능입니다. 서버로 요청한 뒤 저장 결과를 확인합니다. 중복을 막기 위해 키를 사용합니다. 응답을 잃을 수 있습니다. 같은 키로 두 번 요청해서 예약이 하나인지 확인합니다. 잠금 방식보다 구현은 간단하지만 키를 보관해야 합니다.";
const evidence: AssessmentEvidence = {
  feature: "예약 기능입니다.",
  flow: "서버로 요청한 뒤 저장 결과를 확인합니다.",
  reason: "중복을 막기 위해 키를 사용합니다.",
  failure: "응답을 잃을 수 있습니다.",
  verification: "같은 키로 두 번 요청해서 예약이 하나인지 확인합니다.",
  tradeoff: "잠금 방식보다 구현은 간단하지만 키를 보관해야 합니다.",
};
const raw = (first = evidence) => ({
  summary: "답변에서 확인한 설명입니다.",
  feedback: Array.from({ length: 5 }, (_, questionIndex) => ({
    questionIndex,
    evidence: questionIndex === 0 ? first : empty(),
    feedback: "처리 과정을 설명했습니다.",
    nextStep: "예약 기록을 확인해 보세요.",
  })),
});
const answers = [answer, "", "", "", ""];
it.each([
  [empty(), 0],
  [{ ...empty(), feature: evidence.feature }, 1],
  [{ ...empty(), verification: evidence.verification }, 1],
  [{ ...empty(), flow: evidence.flow }, 2],
  [{ ...evidence, failure: null }, 2],
  [{ ...evidence, reason: null }, 2],
  [{ ...evidence, verification: null }, 3],
  [{ ...evidence, tradeoff: null }, 3],
  [evidence, 4],
] as const)("derives cumulative levels from validated evidence %#", (quotes, level) => {
  const result = validateGroundedAssessment(raw(quotes), answers);
  expect(result.feedback[0].level).toBe(level);
  expect(result.score).toBe(level * 5);
  expect(result.rubricVersion).toBe("evidence-v1");
});
it("rejects paraphrases, whitespace, quotes from another answer and unexpected model scores", () => {
  for (const quote of ["別の内容", "   ", "他の質問の答え"]) {
    expect(() =>
      validateGroundedAssessment(raw({ ...evidence, flow: quote }), [
        answer,
        "他の質問の答え",
        "",
        "",
        "",
      ]),
    ).toThrow();
  }
  const scored = raw();
  Object.assign(scored.feedback[0], { level: 4 });
  expect(() => validateGroundedAssessment(scored, answers)).toThrow();
});
it("requires every question once and every evidence field, with bounded input", () => {
  const duplicate = raw();
  duplicate.feedback[4].questionIndex = 0;
  expect(() => validateGroundedAssessment(duplicate, answers)).toThrow();
  for (const key of Object.keys(evidenceLabels)) {
    const missing = raw();
    delete (missing.feedback[0].evidence as Partial<AssessmentEvidence>)[
      key as keyof AssessmentEvidence
    ];
    expect(groundedAssessmentSchema.safeParse(missing).success).toBe(false);
  }
  expect(() => validateGroundedAssessment(raw(), [])).toThrow();
  expect(() =>
    validateGroundedAssessment(raw({ ...evidence, flow: "x".repeat(1501) }), answers),
  ).toThrow();
});
it("sorts shuffled feedback without mutating provider data and handles no evidence", () => {
  const value = raw(empty());
  value.feedback.reverse();
  const result = validateGroundedAssessment(value, ["모르겠습니다.", "", "", "", ""]);
  expect(value.feedback[0].questionIndex).toBe(4);
  expect(result.feedback.map((f) => f.questionIndex)).toEqual([0, 1, 2, 3, 4]);
  expect(result.score).toBe(0);
  expect(result.feedback[0].feedback).toBe("처리 과정을 설명했습니다.");
  expect(result.feedback[1].feedback).toContain("답변하지 않았습니다");
});

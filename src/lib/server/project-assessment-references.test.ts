import { expect, it } from "vitest";
import { answerUnits, validateReferencedAssessment } from "./project-assessment-references";
const answers = [
  "예약을 요청합니다.\n서버의 결과를 확인합니다. 😀 실패하면 다시 확인합니다.",
  "다른 계정입니다.",
  "",
  "",
  "",
];
const raw = (flow: string | null) => ({
  summary: "답변의 근거를 확인했습니다.",
  feedback: Array.from({ length: 5 }, (_, questionIndex) => ({
    questionIndex,
    feedback: "설명을 확인했습니다.",
    nextStep: "응답을 확인해 보세요.",
    blockingIssue: null,
    evidence: {
      feature: null,
      flow: questionIndex === 0 ? flow : null,
      reason: null,
      failure: null,
      verification: null,
      tradeoff: null,
    },
  })),
});
it("derives exact original quotations from scoped sentence IDs", () => {
  const units = answerUnits(answers);
  expect(units[0].units.length).toBeGreaterThan(1);
  for (const group of units)
    for (const unit of group.units) expect(answers[group.questionIndex]).toContain(unit.text);
  const result = validateReferencedAssessment(raw(units[0].units[1].id), answers);
  expect(result.feedback[0].evidence?.flow).toBe(units[0].units[1].text);
  expect(result.score).toBe(10);
  expect(result.rubricVersion).toBe("evidence-v3");
});
it.each(["q1s0", "q0s9999", "invented quotation", "q0s-1"])(
  "rejects wrong-answer or nonexistent reference %s",
  (id) => {
    expect(() => validateReferencedAssessment(raw(id), answers)).toThrow();
  },
);
it("handles long unpunctuated answers, quotes, negation and emoji without rewriting", () => {
  const answer = '확인하지 않았습니다 😃 "예약" '.repeat(35);
  const values = [answer, "", "", "", ""];
  const unit = answerUnits(values)[0].units[0];
  expect(answer).toContain(unit.text);
  expect(validateReferencedAssessment(raw(unit.id), values).feedback[0].evidence?.flow).toBe(
    unit.text,
  );
  expect(answerUnits([" \n ", "", "", "", ""])[0].units).toEqual([]);
});

it("keeps internal reference identifiers out of user-facing prose without rewriting evidence", () => {
  const value = raw("q0s0");
  value.summary = "q0s0을 확인했습니다.";
  value.feedback[0].feedback = "q0s0과 q0s1을 비교하세요.";
  value.feedback[0].nextStep = "q0s999를 확인하세요.";
  const result = validateReferencedAssessment(value, answers);
  expect(result.summary).toBe("1번 답변의 1번째 문장을 확인했습니다.");
  expect(result.feedback[0].feedback).toBe("답변의 1번째 문장과 답변의 2번째 문장을 비교하세요.");
  expect(result.feedback[0].nextStep).not.toContain("q0s");
  expect(result.feedback[0].evidence?.flow).toBe(answerUnits(answers)[0].units[0].text);
});

it("caps a fully evidenced answer when its central claim is contradicted, preserving the reason and source", () => {
  const value = raw("q0s0");
  const issue = {
    evidence: ["q0s0", "q0s1"],
    explanation: "q0s1의 예외가 앞의 보장을 무효화합니다.",
  };
  const complete = Object.fromEntries(
    Object.keys(value.feedback[0].evidence).map((k) => [k, "q0s0"]),
  );
  const input = {
    ...value,
    feedback: value.feedback.map((f, i) =>
      i ? f : { ...f, evidence: complete, blockingIssue: issue },
    ),
  };
  const copy = structuredClone(input);
  const result = validateReferencedAssessment(input, answers);
  expect(result.feedback[0].level).toBe(1);
  expect(result.score).toBe(5);
  expect(result.feedback[0].blockingIssue).toEqual({
    evidence: answerUnits(answers)[0]
      .units.slice(0, 2)
      .map((u) => u.text),
    explanation: "답변의 2번째 문장의 예외가 앞의 보장을 무효화합니다.",
  });
  expect(input).toEqual(copy);
  input.feedback[0].blockingIssue = null;
  expect(validateReferencedAssessment(input, answers).feedback[0].level).toBe(4);
});

it.each(
  [[], ["q1s0"], ["q0s9999"], ["q0s0", "q0s1", "q0s0", "q0s1"]].map((evidence) => ({ evidence })),
)("rejects invalid issue references %j, even with valid positive evidence", ({ evidence }) => {
  const value = raw("q0s0");
  expect(() =>
    validateReferencedAssessment(
      {
        ...value,
        feedback: value.feedback.map((f, i) =>
          i
            ? f
            : {
                ...f,
                blockingIssue: { evidence, explanation: "오류 설명" },
              },
        ),
      },
      answers,
    ),
  ).toThrow();
});
it("requires an explicit issue decision and never awards points merely for an issue", () => {
  const value = raw(null);
  const missing = value.feedback.map(({ blockingIssue, ...f }) => {
    void blockingIssue;
    return f;
  });
  expect(() => validateReferencedAssessment({ ...value, feedback: missing }, answers)).toThrow();
  const result = validateReferencedAssessment(
    {
      ...value,
      feedback: value.feedback.map((f, i) =>
        i
          ? f
          : {
              ...f,
              blockingIssue: { evidence: ["q0s0"], explanation: "오류 설명" },
            },
      ),
    },
    answers,
  );
  expect(result.score).toBe(0);
});

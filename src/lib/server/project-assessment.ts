import { z } from "zod";
import { assessmentSchema, type Assessment } from "../project-check/types";
import { HttpError } from "./http";

// Separate the provider contract from persisted legacy results. New responses
// cannot omit evidence; old saved assessments remain readable without regrading.
const quote = z.string().min(1).max(1500).nullable();
export const groundedAssessmentSchema = assessmentSchema
  .extend({
    feedback: z
      .array(
        assessmentSchema.shape.feedback.element
          .omit({ level: true })
          .extend({
            evidence: z
              .object({
                feature: quote,
                flow: quote,
                reason: quote,
                failure: quote,
                verification: quote,
                tradeoff: quote,
              })
              .strict(),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();

export function validateGroundedAssessment(raw: unknown, answers: string[]): Assessment {
  const parsed = groundedAssessmentSchema.safeParse(raw);
  if (!parsed.success || answers.length !== 5)
    throw new HttpError(
      502,
      "AI 평가 형식을 확인하지 못했습니다. 같은 답변으로 다시 시도해 주세요.",
    );
  const result = parsed.data;
  if (new Set(result.feedback.map((item) => item.questionIndex)).size !== 5)
    throw new HttpError(502, "답변별 평가를 확인하지 못했습니다.");
  const feedback = result.feedback
    .sort((a, b) => a.questionIndex - b.questionIndex)
    .map((item) => {
      const answer = answers[item.questionIndex];
      const evidence = item.evidence;
      for (const value of Object.values(evidence)) {
        if (value !== null && (!value.trim() || !answer.includes(value)))
          throw new HttpError(
            502,
            "평가에 인용된 내용을 제출한 답변에서 찾지 못했습니다. 같은 답변으로 다시 시도해 주세요.",
          );
      }
      // Quote existence is deterministic; whether a quote supports a criterion is
      // still a model judgement. Do not call this a correctness or security proof.
      const level = evidence.flow
        ? evidence.reason && evidence.failure
          ? evidence.verification && evidence.tradeoff
            ? 4
            : 3
          : 2
        : Object.values(evidence).some(Boolean)
          ? 1
          : 0;
      return {
        ...item,
        level,
        feedback: !answer.trim()
          ? "이번 질문에는 답변하지 않았습니다. 아직 평가할 근거가 없습니다."
          : item.feedback,
      };
    });
  return {
    ...result,
    feedback,
    rubricVersion: "evidence-v1",
    score: feedback.reduce((sum, item) => sum + item.level * 5, 0),
  };
}

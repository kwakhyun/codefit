import { z } from "zod";
import { groundedAssessmentSchema, validateGroundedAssessment } from "./project-assessment";
import { type Assessment, evidenceLabels, assessmentIssueSchema } from "../project-check/types";
import { HttpError } from "./http";
const reference = z
  .string()
  .regex(/^q[0-4]s\d{1,4}$/)
  .nullable();
const references = z
  .object({
    feature: reference,
    flow: reference,
    reason: reference,
    failure: reference,
    verification: reference,
    tradeoff: reference,
  })
  .strict();
export const ASSESSMENT_RUBRIC_VERSION = "evidence-v3";
export const referencedAssessmentSchema = groundedAssessmentSchema.extend({
  feedback: z
    .array(
      groundedAssessmentSchema.shape.feedback.element.extend({
        blockingIssue: assessmentIssueSchema
          .extend({
            evidence: z.array(reference.unwrap()).min(1).max(3),
          })
          .nullable(),
        evidence: references,
      }),
    )
    .length(5),
});
const segmenter = new Intl.Segmenter("ko", { granularity: "sentence" });
export function answerUnits(answers: string[]) {
  return answers.map((answer, questionIndex) => ({
    questionIndex,
    units: [...segmenter.segment(answer)]
      .map((s) => s.segment.trim())
      .filter(Boolean)
      .map((text, index) => ({ id: `q${questionIndex}s${index}`, text })),
  }));
}
export function validateReferencedAssessment(raw: unknown, answers: string[]): Assessment {
  const parsed = referencedAssessmentSchema.safeParse(raw);
  if (!parsed.success || answers.length !== 5)
    throw new HttpError(
      502,
      "AI 평가 형식을 확인하지 못했습니다. 같은 답변으로 다시 시도해 주세요.",
    );
  const units = answerUnits(answers);
  const resolve = (questionIndex: number, id: string) => {
    const unit = units[questionIndex].units.find((unit) => unit.id === id);
    if (!unit)
      throw new HttpError(
        502,
        "평가가 참조한 문장을 해당 답변에서 찾지 못했습니다. 같은 답변으로 다시 시도해 주세요.",
      );
    return unit.text;
  };
  const issues = new Map(
    parsed.data.feedback.map((item) => [
      item.questionIndex,
      item.blockingIssue && {
        explanation: item.blockingIssue.explanation,
        evidence: [...new Set(item.blockingIssue.evidence)].map((id) =>
          resolve(item.questionIndex, id),
        ),
      },
    ]),
  );
  const feedback = parsed.data.feedback.map((item) => ({
    questionIndex: item.questionIndex,
    feedback: item.feedback,
    nextStep: item.nextStep,
    evidence: Object.fromEntries(
      Object.keys(evidenceLabels).map((key) => {
        const id = item.evidence[key as keyof typeof evidenceLabels];
        if (id === null) return [key, null];
        return [key, resolve(item.questionIndex, id)];
      }),
    ),
  }));
  const validated = validateGroundedAssessment({ ...parsed.data, feedback }, answers);
  const displayReferences = (text: string, questionIndex?: number) =>
    text.replace(/\bq([0-4])s(\d{1,4})\b/g, (id, question: string, sentence: string) => {
      if (!units[Number(question)].units.some((unit) => unit.id === id))
        return "확인되지 않은 문장";
      return `${Number(question) === questionIndex ? "답변" : `${Number(question) + 1}번 답변`}의 ${Number(sentence) + 1}번째 문장`;
    });
  const graded = validated.feedback.map((item) => {
    const issue = issues.get(item.questionIndex) ?? null;
    return {
      ...item,
      level: issue ? Math.min(item.level, 1) : item.level,
      blockingIssue: issue && {
        ...issue,
        explanation: displayReferences(issue.explanation, item.questionIndex),
      },
      feedback: displayReferences(item.feedback, item.questionIndex),
      nextStep: displayReferences(item.nextStep, item.questionIndex),
    };
  });
  return {
    ...validated,
    summary: displayReferences(validated.summary),
    feedback: graded,
    score: graded.reduce((sum, item) => sum + item.level * 5, 0),
    rubricVersion: ASSESSMENT_RUBRIC_VERSION,
  };
}

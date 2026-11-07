import { z } from "zod";
import { AI_LESSONS } from "./catalog";
import { repositoryCitation, type RepositorySnapshot } from "../project-check/repository";
const text = (max: number) => z.string().trim().min(1).max(max);
const topicSchema = z
  .object({
    kind: z.enum(["observed", "proposed"]),
    title: text(100),
    tool: text(100),
    purpose: text(350),
    evidence: z.array(text(1100)).min(1).max(3),
    explanation: text(700),
    steps: z
      .array(z.object({ action: text(200), expected: text(300) }).strict())
      .min(2)
      .max(4),
    tradeoff: text(400),
    verification: text(400),
    lessonIds: z
      .array(z.enum(AI_LESSONS.map((lesson) => lesson.id)))
      .min(1)
      .max(3),
    question: text(240),
    choices: z.array(text(200)).min(2).max(4),
    answer: z.number().int().min(0).max(3),
    feedback: text(450),
  })
  .strict();
export const workshopPlanSchema = z
  .object({
    summary: text(600),
    limitations: text(500),
    topics: z.array(topicSchema).max(6),
  })
  .strict();
export type WorkshopPlan = z.infer<typeof workshopPlanSchema>;
const responseInputSchema = z
  .object({
    choice: z.number().int().min(0).max(3),
    note: z.string().max(2000),
  })
  .strict();
/** A saved answer keeps the first choice ever saved for the topic; earlier saves lack it. */
const workshopResponseSchema = responseInputSchema
  .extend({ firstChoice: z.number().int().min(0).max(3).optional() })
  .strict();
export const workshopSchema = z
  .object({
    plan: workshopPlanSchema,
    responses: z.array(workshopResponseSchema.nullable()).max(6),
    revision: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type ProjectWorkshop = z.infer<typeof workshopSchema>;
/** What the browser sends; the server adds `firstChoice` from the saved record. */
export const workshopSaveInputSchema = z
  .object({
    index: z.number().int().min(0).max(5),
    revision: z.number().int().nonnegative(),
    response: responseInputSchema,
  })
  .strict();
export const workshopSaveSchema = workshopSaveInputSchema
  .extend({ response: workshopResponseSchema })
  .strict();
export type WorkshopResponse = z.infer<typeof workshopResponseSchema>;
/** Records the first saved choice once; later edits keep it, older records stay without it. */
export function workshopResponse(
  saved: ProjectWorkshop | null,
  input: z.infer<typeof workshopSaveInputSchema>,
): WorkshopResponse {
  const previous = saved?.responses[input.index];
  const firstChoice = previous ? previous.firstChoice : input.response.choice;
  return { ...input.response, ...(firstChoice === undefined ? {} : { firstChoice }) };
}
/** Workshop progress: answered topics and how the first answer compared with the advice. */
export function workshopProgress(value: ProjectWorkshop) {
  const topics = value.plan.topics.map((topic, index) => {
    const response = value.responses[index];
    const first = response?.firstChoice;
    return {
      answered: Boolean(response),
      firstCorrect: first === undefined ? null : first === topic.answer,
      revised: Boolean(response && first !== undefined && first !== response.choice),
      currentCorrect: response ? response.choice === topic.answer : null,
    };
  });
  return { topics, answered: topics.filter((t) => t.answered).length, total: topics.length };
}
export function validWorkshop(plan: WorkshopPlan, repository: RepositorySnapshot) {
  return plan.topics.every(
    (t) =>
      t.answer < t.choices.length &&
      t.lessonIds.every((id) => AI_LESSONS.some((l) => l.id === id)) &&
      t.evidence.every((line) => repositoryCitation(repository, line)),
  );
}
export function validWorkshopResponses(value: ProjectWorkshop) {
  return (
    value.responses.length <= value.plan.topics.length &&
    value.responses.every(
      (r, i) =>
        !r ||
        (r.choice < value.plan.topics[i].choices.length &&
          (r.firstChoice === undefined || r.firstChoice < value.plan.topics[i].choices.length)),
    )
  );
}

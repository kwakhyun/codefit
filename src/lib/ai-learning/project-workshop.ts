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
const workshopResponseSchema = z
  .object({
    choice: z.number().int().min(0).max(3),
    note: z.string().max(2000),
  })
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
export const workshopSaveSchema = z
  .object({
    index: z.number().int().min(0).max(5),
    revision: z.number().int().nonnegative(),
    response: workshopResponseSchema,
  })
  .strict();
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
    value.responses.every((r, i) => !r || r.choice < value.plan.topics[i].choices.length)
  );
}

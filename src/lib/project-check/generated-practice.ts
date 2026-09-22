import { z } from "zod";
import { repositoryCitation, type RepositorySnapshot } from "./repository";
const practiceModeSchema = z.enum(["code", "service"]);
export type PracticeMode = z.infer<typeof practiceModeSchema>;
const text = (max: number) => z.string().trim().min(1).max(max);
export const practiceGuidanceSchema = z
  .object({
    goal: text(180),
    terms: z.array(z.object({ term: text(80), meaning: text(180) }).strict()).max(4),
    readingSteps: z.array(text(180)).min(2).max(3),
    takeaway: text(240),
  })
  .strict();
export const serviceScenarioSchema = z
  .object({
    actor: text(100),
    action: text(180),
    before: text(180),
    changed: text(180),
    observe: text(180),
  })
  .strict();
const projectExerciseSchema = z
  .object({
    title: text(80),
    purpose: text(220),
    // Older saved exercises remain readable without regenerating or resetting progress.
    guidance: practiceGuidanceSchema.optional(),
    serviceScenario: serviceScenarioSchema.optional(),
    situation: text(400),
    assumptions: text(300),
    evidence: z.array(text(1100)).min(1).max(3),
    question: text(220),
    choices: z.array(text(160)).min(2).max(4),
    answer: z.number().int().min(0).max(3),
    walkthrough: z
      .array(z.object({ action: text(180), result: text(240) }).strict())
      .min(2)
      .max(4),
    explanation: text(450),
    verification: text(450),
  })
  .strict();
export const projectExercisesSchema = z
  .object({
    code: z.array(projectExerciseSchema).length(3),
    service: z.array(projectExerciseSchema).length(3),
  })
  .strict();
export type ProjectExercise = z.infer<typeof projectExerciseSchema>;
export type ProjectExercises = z.infer<typeof projectExercisesSchema>;
const responseSchema = z
  .object({
    choice: z.number().int().min(0).max(3),
    note: z.string().max(2000),
    predictionReason: z.string().max(800).optional(),
    completed: z.boolean(),
  })
  .strict();
const practiceProgressSchema = z.array(responseSchema).max(3);
export const generatedPracticeSchema = z
  .object({
    exercises: projectExercisesSchema,
    progress: z.object({ code: practiceProgressSchema, service: practiceProgressSchema }).strict(),
    revision: z.number().int().nonnegative(),
    createdAt: z.iso.datetime(),
  })
  .strict();
export type GeneratedPractice = z.infer<typeof generatedPracticeSchema>;
export const practiceSaveSchema = z
  .object({
    mode: practiceModeSchema,
    revision: z.number().int().nonnegative(),
    progress: practiceProgressSchema,
  })
  .strict();
export function validProjectExercises(exercises: ProjectExercises, repository: RepositorySnapshot) {
  return [...exercises.code, ...exercises.service].every(
    (task) =>
      task.answer < task.choices.length &&
      task.evidence.every((line) => repositoryCitation(repository, line)),
  );
}
export function validPracticeProgress(
  tasks: ProjectExercise[],
  progress: GeneratedPractice["progress"][PracticeMode],
) {
  return progress.every(
    (item, index) =>
      item.choice < tasks[index].choices.length && (index === 0 || progress[index - 1].completed),
  );
}

import { z } from "zod";
import { repositoryCitation, type RepositorySnapshot } from "./repository";
const practiceModeSchema = z.enum(["code", "service"]);
export type PracticeMode = z.infer<typeof practiceModeSchema>;
const text = (max: number) => z.string().trim().min(1).max(max);
const projectExerciseSchema = z
  .object({
    title: text(80),
    purpose: text(220),
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

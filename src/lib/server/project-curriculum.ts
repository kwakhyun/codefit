import { createHash } from "node:crypto";
import { z } from "zod";
import { AREAS } from "../project-check/types";
import { learningModules } from "./project-learning-content";
import { HttpError } from "./http";
const item = z
  .object({
    scenario: z.string().min(1),
    question: z.string().min(1),
    choices: z.array(z.string().min(1)).length(3),
    answer: z.number().int().min(0).max(2),
    explanation: z.string().min(1),
  })
  .strict();
const modulesSchema = z
  .array(
    z
      .object({
        id: z.enum(["flow", "storage", "access", "recovery", "rules"]),
        area: z.enum(AREAS),
        title: z.string().min(1),
        objective: z.string().min(1),
        missionId: z.string().min(1),
        baseline: z.tuple([item, item]),
        transfer: z.tuple([item, item]),
      })
      .strict(),
  )
  .length(5)
  .refine((modules) => new Set(modules.map((m) => m.id)).size === 5);
const snapshotSchema = z
  .object({
    format: z.literal(1),
    contentId: z.string().regex(/^[a-f0-9]{64}$/),
    modules: modulesSchema,
  })
  .strict();
export type CurriculumSnapshot = z.infer<typeof snapshotSchema>;
function digest(modules: CurriculumSnapshot["modules"]) {
  return createHash("sha256").update(JSON.stringify(modules)).digest("hex");
}
export function createCurriculumSnapshot(): CurriculumSnapshot {
  const modules = modulesSchema.parse(learningModules);
  return { format: 1, contentId: digest(modules), modules };
}
export function readCurriculumSnapshot(raw: unknown): CurriculumSnapshot {
  const parsed = snapshotSchema.safeParse(raw);
  if (!parsed.success || digest(parsed.data.modules) !== parsed.data.contentId)
    throw new HttpError(
      409,
      "저장된 문항의 기준을 확인하지 못했습니다. 기록을 변경하지 않고 보존했습니다.",
    );
  return parsed.data;
}

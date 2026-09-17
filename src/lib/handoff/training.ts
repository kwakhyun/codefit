import { z } from "zod";

export const LAB_VERSION = "2026-09-17.1";
export const executionResultSchema = z
  .object({
    id: z.string().max(40),
    status: z.enum(["ok", "error"]),
    actual: z.string().max(1600),
  })
  .strict();
export type ExecutionResult = z.infer<typeof executionResultSchema>;
export const coachReplySchema = z
  .object({
    evidenceId: z.string().min(1).max(40),
    observation: z.string().min(5).max(350),
    question: z.string().min(5).max(350),
    nextCheck: z.string().min(5).max(350),
  })
  .strict();
export type CoachReply = z.infer<typeof coachReplySchema>;
export const trainingSchema = z
  .object({
    version: z.literal(1),
    prediction: z
      .object({
        choice: z.string().max(40),
        reason: z.string().max(800),
        locked: z.boolean(),
      })
      .strict(),
    observation: executionResultSchema.optional(),
    run: z
      .object({
        codeHash: z.string().max(64),
        suiteVersion: z.string().max(40),
        results: z.array(executionResultSchema).max(8),
      })
      .strict()
      .optional(),
    coach: coachReplySchema.extend({ snapshot: z.string().max(64) }).optional(),
  })
  .strict();
export type TrainingDraft = z.infer<typeof trainingSchema>;
export const emptyTraining = (): TrainingDraft => ({
  version: 1,
  prediction: { choice: "", reason: "", locked: false },
});

type LabCase = { id: string; expression: string; expected: unknown; note: string };
export type LearningLab = {
  version: string;
  question: string;
  choices: { id: string; label: string; output: string }[];
  probe: { id: string; expression: string; note: string };
  checkpoints: LabCase[];
  reflection: string;
};

/** Compare JSON values, not object key insertion order. No evaluation of text. */
export function sameOutput(actual: string, expected: unknown) {
  function canonical(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value && typeof value === "object")
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
        .join(",")}}`;
    return JSON.stringify(value) ?? "undefined";
  }
  try {
    return canonical(JSON.parse(actual)) === canonical(expected);
  } catch {
    return false;
  }
}

export async function codeHash(code: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code));
  return Array.from(new Uint8Array(digest), (v) => v.toString(16).padStart(2, "0")).join("");
}

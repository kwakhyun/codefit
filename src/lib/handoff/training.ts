import { z } from "zod";

export const LAB_VERSION = "2026-09-20.1";
export const executionResultSchema = z
  .object({
    id: z.string().max(40),
    status: z.enum(["ok", "error"]),
    actual: z.string().max(1600),
  })
  .strict();
export type ExecutionResult = z.infer<typeof executionResultSchema>;
const experimentExpressionSchema = z.string().min(1).max(2000);
const coachExperimentSchema = z.object({ expression: experimentExpressionSchema }).strict();
const coachFocusSchema = z
  .object({
    learnerQuote: z.string().min(1).max(800).nullable(),
    goal: z.string().min(5).max(240),
  })
  .strict();
export const coachReplySchema = z
  .object({
    evidenceId: z.string().min(1).max(40),
    observation: z.string().min(5).max(350),
    question: z.string().min(5).max(350),
    nextCheck: z.string().min(5).max(350),
    experiment: coachExperimentSchema.optional(),
    focus: coachFocusSchema.optional(),
  })
  .strict();
export type CoachReply = z.infer<typeof coachReplySchema>;
// Persisted replies stay readable; newly generated replies must include executable setup.
export const generatedCoachReplySchema = coachReplySchema.extend({
  experiment: coachExperimentSchema,
  focus: coachFocusSchema,
});
const experimentDraftSchema = z
  .object({
    expression: z.string().max(2000),
    prediction: z.string().max(800),
    reflection: z
      .object({
        text: z.string().max(800),
        runHash: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict()
      .optional(),
    run: z
      .object({
        expression: experimentExpressionSchema,
        prediction: z.string().max(800),
        sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
        codeHash: z.string().regex(/^[a-f0-9]{64}$/),
        suiteVersion: z.string().max(40),
        original: executionResultSchema,
        current: executionResultSchema,
      })
      .strict()
      .optional(),
  })
  .strict();
export type ExperimentDraft = z.infer<typeof experimentDraftSchema>;
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
    observationSource: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .optional(),
    run: z
      .object({
        codeHash: z.string().max(64),
        suiteVersion: z.string().max(40),
        results: z.array(executionResultSchema).max(8),
      })
      .strict()
      .optional(),
    experiment: experimentDraftSchema.optional(),
    coach: coachReplySchema
      .extend({
        snapshot: z.string().max(64),
        evidenceSnapshot: z
          .string()
          .regex(/^[a-f0-9]{64}$/)
          .optional(),
      })
      .optional(),
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
  contract: string;
  question: string;
  choices: { id: string; label: string; output: string }[];
  probe: { id: string; expression: string; note: string };
  checkpoints: LabCase[];
  reflection: string;
};

/** Bind an observation to both its original code and exact probe/runner version.
 * A client hash detects stale honest records; it is not proof of execution. */
export function observationSourceText(code: string, lab: LearningLab) {
  return JSON.stringify([code, lab.version, lab.probe.id, lab.probe.expression]);
}
export type CoachingEvidence = "prediction" | "experiment";
export function coachingEvidenceText(
  training: TrainingDraft,
  evidence: CoachingEvidence = "prediction",
) {
  const original = [training.prediction, training.observation, training.observationSource];
  return JSON.stringify(
    evidence === "experiment" ? [...original, "experiment", training.experiment] : original,
  );
}
export function experimentRunText(run: NonNullable<ExperimentDraft["run"]>) {
  return JSON.stringify([
    run.expression,
    run.prediction,
    run.sourceHash,
    run.codeHash,
    run.suiteVersion,
    [run.original.id, run.original.status, run.original.actual],
    [run.current.id, run.current.status, run.current.actual],
  ]);
}
export function experimentMatches(
  experiment: ExperimentDraft,
  sourceHash: string,
  codeHash: string,
  version: string,
) {
  const run = experiment.run;
  return Boolean(
    run &&
    sourceHash &&
    codeHash &&
    run.expression === experiment.expression &&
    run.prediction === experiment.prediction &&
    run.sourceHash === sourceHash &&
    run.codeHash === codeHash &&
    run.suiteVersion === version &&
    run.original.id === "experiment" &&
    run.current.id === "experiment",
  );
}

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

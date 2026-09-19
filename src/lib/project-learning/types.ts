import { z } from "zod";
import type { AREAS } from "../project-check/types";
const moduleIds = ["flow", "storage", "access", "recovery", "rules"] as const;
type ModuleId = (typeof moduleIds)[number];
type Phase = "baseline" | "transfer";
export type Confidence = "unsure" | "likely" | "certain";
export const trainingInput = z
  .object({
    id: z.uuid(),
    moduleId: z.enum(moduleIds),
    phase: z.enum(["baseline", "transfer"]),
    revision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
    answers: z.tuple([z.number().int().min(0).max(2), z.number().int().min(0).max(2)]),
    confidence: z.enum(["unsure", "likely", "certain"]),
    assisted: z.boolean(),
  })
  .strict();
export type TrainingInput = z.infer<typeof trainingInput>;
export type Probe = { scenario: string; question: string; choices: string[] };
export type AnswerKey = { answer: number; explanation: string };
export type Submission = Pick<TrainingInput, "answers" | "confidence" | "assisted"> & {
  submittedAt: string;
  correct: number;
  priorPractice: boolean;
  practiceRevision: number | null;
  practiceHints: number;
};
export type TrainingRecord = {
  version: 1;
  revision: number;
  modules: Partial<Record<ModuleId, Partial<Record<Phase, Submission>>>>;
};
export type LearningModule = {
  id: ModuleId;
  area: (typeof AREAS)[number];
  title: string;
  objective: string;
  missionId: string;
};
export type TrainingModuleView = LearningModule & {
  level: number;
  reason: string;
  missionTitle: string;
  minutes: number;
  practiceCompleted: boolean;
  phase: Phase | "practice" | "complete";
  probes: Probe[];
  baseline?: Omit<Submission, "correct">;
  result?: {
    baseline: Submission;
    transfer: Submission;
    keys: Record<Phase, AnswerKey[]>;
    probes: Record<Phase, Probe[]>;
  };
};
export type TrainingView = {
  revision: number;
  version: 1;
  contentId: string;
  modules: TrainingModuleView[];
};

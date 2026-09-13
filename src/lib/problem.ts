import { z } from "zod";
import { DOMAIN_IDS, KINDS, LANGUAGE_IDS, LEVELS, supportsLanguage } from "./catalog";

export const generationSchema = z
  .object({
    domain: z.enum(DOMAIN_IDS),
    language: z.enum(LANGUAGE_IDS),
    difficulty: z.enum(LEVELS),
    kind: z.enum(KINDS),
    topic: z.string().trim().min(2, "주제를 2자 이상 입력해 주세요.").max(200),
    requestId: z.uuid(),
  })
  .refine((v) => supportsLanguage(v.domain, v.language), {
    message: "선택한 분야에서 지원하는 언어를 골라 주세요.",
    path: ["language"],
  });

export const problemContentSchema = z.object({
  title: z.string().min(4).max(90),
  summary: z.string().min(10).max(220),
  scenario: z.string().min(30).max(1800),
  requirements: z.array(z.string().min(8).max(400)).min(3).max(6),
  starterCode: z.string().min(15).max(16000),
  hints: z.array(z.string().min(10).max(600)).length(3),
  solution: z.string().min(30).max(20000),
  explanation: z.string().min(30).max(3000),
  examples: z
    .array(
      z.object({
        input: z.string().max(1200),
        output: z.string().max(1200),
        note: z.string().max(500),
      }),
    )
    .min(1)
    .max(3),
  tags: z.array(z.string().min(1).max(28)).min(2).max(5),
  minutes: z.number().int().min(5).max(120),
});
export const problemSchema = problemContentSchema.extend({
  id: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/),
  domain: z.enum(DOMAIN_IDS),
  language: z.enum(LANGUAGE_IDS),
  difficulty: z.enum(LEVELS),
  kind: z.enum(KINDS),
  source: z.enum(["curated", "ai"]),
  createdAt: z.iso.datetime(),
});
export type Problem = z.infer<typeof problemSchema>;
export type PublicProblem = Omit<Problem, "hints" | "solution" | "explanation"> & {
  hintCount: number;
};
export function publicProblem(problem: Problem): PublicProblem {
  const { hints, solution: _solution, explanation: _explanation, ...rest } = problem;
  void _solution;
  void _explanation;
  return { ...rest, hintCount: hints.length };
}
export const reviewSchema = z.object({
  summary: z.string().min(5).max(1200),
  criteria: z
    .array(
      z.object({
        requirementIndex: z.number().int().min(0).max(5),
        passed: z.boolean(),
        feedback: z.string().min(5).max(900),
      }),
    )
    .min(3)
    .max(6),
  strengths: z.array(z.string().max(500)).max(4),
  improvements: z.array(z.string().max(700)).max(5),
});
export type Review = z.infer<typeof reviewSchema> & { score: number; passed: boolean };
export function validateReview(
  value: z.infer<typeof reviewSchema>,
  problem: Pick<Problem, "requirements">,
): Review {
  const parsed = reviewSchema.parse(value);
  const indexes = new Set(parsed.criteria.map((c) => c.requirementIndex));
  if (
    indexes.size !== problem.requirements.length ||
    parsed.criteria.length !== problem.requirements.length ||
    [...indexes].some((i) => i >= problem.requirements.length)
  ) {
    throw new Error("Incomplete review criteria");
  }
  const criteria = [...parsed.criteria].sort((a, b) => a.requirementIndex - b.requirementIndex);
  const passedCount = criteria.filter((c) => c.passed).length;
  return {
    ...parsed,
    criteria,
    score: Math.round((passedCount / criteria.length) * 100),
    passed: passedCount === criteria.length,
  };
}
export interface Progress {
  problemId: string;
  code: string | null;
  bookmarked: boolean;
  hintsViewed: number;
  solutionViewed: boolean;
  status: "new" | "in-progress" | "solved";
  updatedAt: string;
}
export interface Attempt {
  id: string;
  problemId: string;
  code: string;
  review: Review;
  createdAt: string;
  assisted: boolean;
}
export type ProblemSummary = Omit<
  PublicProblem,
  "scenario" | "requirements" | "starterCode" | "examples"
>;
export type ProgressSummary = Omit<Progress, "code">;
export type AttemptSummary = Omit<Attempt, "code">;
export interface Workspace {
  problems: ProblemSummary[];
  progress: Record<string, ProgressSummary>;
  attempts: AttemptSummary[];
  aiReady: boolean;
  storage: string;
  legacyCount: number;
}

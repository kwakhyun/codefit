import type { ClassMetadata } from "./project-class";
import { z } from "zod";
import type { RepositorySnapshot } from "./repository";
export const PROJECT_LIMITS = { windowMs: 86_400_000 } as const;
export const AREAS = ["사용 흐름", "데이터 저장", "접근 권한", "오류 대응", "설계 선택"] as const;
export const createCheckSchema = z
  .object({
    requestId: z.uuid(),
    source: z.enum(["repository", "website"]).optional(),
    url: z.string().trim().min(1).max(1500),
    description: z.string().trim().max(2000).default(""),
    // Accepted only for compatibility with older clients; no separate consent gate.
    consent: z.boolean().optional(),
  })
  .strict();
export const reviewCheckSchema = z
  .object({
    id: z.uuid(),
    answers: z.array(z.string().trim().max(1500)).length(5),
  })
  .strict();
export const analysisSchema = z
  .object({
    title: z.string().min(1).max(80),
    summary: z.string().min(1).max(700),
    questions: z
      .array(
        z
          .object({
            area: z.enum(AREAS),
            question: z.string().min(10).max(450),
            basis: z.enum(["page", "description", "unknown"]),
            evidence: z.string().max(1100),
            criteria: z.array(z.string().min(1).max(150)).min(2).max(3),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();
export const assessmentSchema = z
  .object({
    summary: z.string().min(1).max(600),
    feedback: z
      .array(
        z
          .object({
            questionIndex: z.number().int().min(0).max(4),
            level: z.number().int().min(0).max(4),
            feedback: z.string().min(1).max(500),
            nextStep: z.string().min(1).max(350),
          })
          .strict(),
      )
      .length(5),
  })
  .strict();
export type Analysis = z.infer<typeof analysisSchema>;
export const evidenceLabels = {
  feature: "기능 설명",
  flow: "처리 흐름",
  reason: "선택 이유",
  failure: "실패 상황",
  verification: "확인 방법",
  tradeoff: "대안 비교",
} as const;
export type AssessmentEvidence = Record<keyof typeof evidenceLabels, string | null>;
export const assessmentIssueSchema = z
  .object({
    evidence: z.array(z.string().min(1).max(1500)).min(1).max(3),
    explanation: z.string().min(1).max(350),
  })
  .strict();
export const verificationPlanSchema = z
  .object({
    goal: z.string().min(1).max(180),
    preparation: z.string().min(1).max(300),
    steps: z
      .array(
        z
          .object({
            action: z.string().min(1).max(250),
            expected: z.string().min(1).max(250),
          })
          .strict(),
      )
      .min(2)
      .max(4),
    completion: z.string().min(1).max(250),
  })
  .strict();
type VerificationPlan = z.infer<typeof verificationPlanSchema>;
export type Assessment = Omit<z.infer<typeof assessmentSchema>, "feedback"> & {
  score: number;
  rubricVersion?: "evidence-v1" | "evidence-v2" | "evidence-v3";
  feedback: (z.infer<typeof assessmentSchema>["feedback"][number] & {
    evidence?: AssessmentEvidence;
    verificationPlan?: VerificationPlan;
    blockingIssue?: z.infer<typeof assessmentIssueSchema> | null;
  })[];
};
export const captureSchema = z
  .object({
    url: z
      .url()
      .max(1500)
      .refine((value) => {
        if (!URL.canParse(value)) return false;
        const url = new URL(value);
        return (
          url.protocol === "https:" &&
          !url.username &&
          !url.password &&
          !url.search &&
          !url.hash &&
          !url.port
        );
      }, "공개 HTTPS 화면 주소가 필요합니다."),
    title: z.string().max(160),
    text: z.string().max(10000),
    screenshot: z
      .string()
      .max(270000)
      .regex(/^[A-Za-z0-9+/]+=*$/)
      .optional(),
  })
  .strict();

export interface PageSnapshot {
  url: string;
  text: string;
  title: string;
  fetchedAt: string;
  limited: boolean;
  source?: "html" | "metadata" | "rendered" | "repository";
  repository?: RepositorySnapshot;
  collectionNote?: string;
  captures?: { url: string; title: string; text: string; screenshot?: string }[];
}
export const practiceSchema = z
  .object({
    revision: z.number().int().nonnegative().safe(),
    tasks: z
      .array(
        z
          .object({
            questionIndex: z.number().int().min(0).max(4),
            status: z.enum(["planned", "observed", "blocked"]),
            result: z.string().trim().max(4000),
          })
          .strict(),
      )
      .length(5),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.tasks.map((t) => t.questionIndex)).size === 5 &&
      v.tasks.every((t) => t.status !== "observed" || t.result.length > 0),
    "확인 완료한 항목에는 결과가 필요합니다.",
  );
export type ProjectPractice = z.infer<typeof practiceSchema>;
export interface StoredCheck {
  classMetadata?: ClassMetadata;
  id: string;
  createdAt: string;
  description: string;
  page: PageSnapshot;
  analysis: Analysis;
  previousReview?: { answers: string[]; assessment: Assessment };
  revisionNumber?: number;
}
export interface Check extends Omit<StoredCheck, "analysis" | "page"> {
  page: Omit<PageSnapshot, "text" | "captures"> & {
    captures?: { url: string; title: string; hasScreenshot: boolean }[];
  };
  analysis: Omit<Analysis, "questions"> & {
    questions: Omit<Analysis["questions"][number], "criteria">[];
  };
  review?: { answers: string[]; assessment: Assessment; practice?: ProjectPractice };
}
interface CheckUsage {
  limit: number;
  remaining: number;
  resetsAt: string | null;
}
export type CheckListItem = Pick<Check, "id" | "createdAt" | "classMetadata"> & {
  page: Pick<Check["page"], "url" | "source">;
  analysis: Pick<Check["analysis"], "title">;
  review?: { assessment: { score: number } };
};
export function checkListItem(check: Check): CheckListItem {
  return {
    id: check.id,
    createdAt: check.createdAt,
    ...(check.classMetadata ? { classMetadata: check.classMetadata } : {}),
    page: { url: check.page.url, ...(check.page.source ? { source: check.page.source } : {}) },
    analysis: { title: check.analysis.title },
    ...(check.review ? { review: { assessment: { score: check.review.assessment.score } } } : {}),
  };
}
export interface CheckOverview {
  scope: string;
  signedIn: boolean;
  aiReady: boolean;
  usage: { analysis: CheckUsage; review: CheckUsage };
  checks: CheckListItem[];
  nextCursor: string | null;
}

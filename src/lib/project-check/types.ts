import { z } from "zod";
export const PROJECT_LIMITS = { analysis: 2, review: 4, windowMs: 86_400_000 } as const;
export const AREAS = ["사용 흐름", "데이터 저장", "접근 권한", "오류 대응", "설계 선택"] as const;
export const createCheckSchema = z
  .object({
    requestId: z.uuid(),
    url: z.string().trim().min(1).max(1500),
    description: z.string().trim().max(2000).default(""),
    consent: z.literal(true, { error: "본인 프로젝트와 AI 분석 동의를 확인해 주세요." }),
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
            evidence: z.string().max(200),
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
export type Assessment = Omit<z.infer<typeof assessmentSchema>, "feedback"> & {
  score: number;
  rubricVersion?: "evidence-v1" | "evidence-v2" | "evidence-v3";
  feedback: (z.infer<typeof assessmentSchema>["feedback"][number] & {
    evidence?: AssessmentEvidence;
    blockingIssue?: z.infer<typeof assessmentIssueSchema> | null;
  })[];
};
export interface PageSnapshot {
  url: string;
  text: string;
  title: string;
  fetchedAt: string;
  limited: boolean;
}
export interface StoredCheck {
  id: string;
  createdAt: string;
  description: string;
  page: PageSnapshot;
  analysis: Analysis;
}
export interface Check extends Omit<StoredCheck, "analysis" | "page"> {
  page: Omit<PageSnapshot, "text">;
  analysis: Omit<Analysis, "questions"> & {
    questions: Omit<Analysis["questions"][number], "criteria">[];
  };
  review?: { answers: string[]; assessment: Assessment };
}
interface CheckUsage {
  limit: number;
  remaining: number;
  resetsAt: string | null;
}
export interface CheckOverview {
  scope: string;
  signedIn: boolean;
  aiReady: boolean;
  usage: { analysis: CheckUsage; review: CheckUsage };
  checks: Check[];
  nextCursor: string | null;
}

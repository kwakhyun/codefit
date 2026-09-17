import { z } from "zod";

export const EXPERIENCE_OPTIONS = [
  { value: "new", label: "코딩은 처음이에요" },
  { value: "builder", label: "AI로 서비스를 만들어 봤어요" },
  { value: "developer", label: "코드를 읽고 작성할 수 있어요" },
] as const;
export const GOAL_OPTIONS = [
  { value: "understand", label: "서비스가 작동하는 원리 배우기" },
  { value: "fix", label: "서비스 오류를 찾고 수정 확인하기" },
  { value: "review", label: "AI가 만든 코드 이해하기" },
  { value: "practice", label: "직접 코딩하며 연습하기" },
] as const;
export const TIME_OPTIONS = [
  { value: 5, label: "5분 정도" },
  { value: 15, label: "15분 정도" },
  { value: 30, label: "30분 이상" },
] as const;
const guideProfileSchema = z
  .object({
    experience: z.enum(["new", "builder", "developer"]),
    goal: z.enum(["understand", "fix", "review", "practice"]),
    minutes: z.union([z.literal(5), z.literal(15), z.literal(30)]),
  })
  .strict();
const guideMessageSchema = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(900),
  })
  .strict();
export const guideInputSchema = z
  .object({
    profile: guideProfileSchema,
    messages: z.array(guideMessageSchema).min(1).max(7),
    mode: z.enum(["ai", "basic"]),
  })
  .strict()
  .refine((input) => input.messages.at(-1)?.role === "user", "질문을 입력해 주세요.");
export type GuideProfile = z.infer<typeof guideProfileSchema>;
export type GuideMessage = z.infer<typeof guideMessageSchema>;
export type GuideInput = z.infer<typeof guideInputSchema>;
export type GuideRecommendation = {
  id: string;
  title: string;
  description: string;
  href: string;
  minutes: number;
  action: string;
};
export type GuideReply = {
  message: string;
  recommendation: GuideRecommendation;
  source: "ai" | "basic";
  notice?: string;
};
export type GuideStatus = { scope: string; aiReady: boolean };

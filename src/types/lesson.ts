export const STACK_IDS = ["javascript", "typescript", "react"] as const;
export type StackId = (typeof STACK_IDS)[number];

export const DIFFICULTIES = ["입문", "기초", "실전"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export type CodeLanguage = "javascript" | "typescript" | "tsx";

export interface Lesson {
  id: string;
  stack: StackId;
  language: CodeLanguage;
  category: string;
  title: string;
  summary: string;
  explanation: string;
  useCases: string[];
  concepts: string[];
  code: string;
  hints: string[];
  difficulty: Difficulty;
  minutes: number;
  generated?: boolean;
}

export interface StackMeta {
  id: StackId;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
}

export const STACK_META: Record<StackId, StackMeta> = {
  javascript: {
    id: "javascript",
    label: "JavaScript",
    shortLabel: "JS",
    color: "#f2ca3a",
    description: "데이터 가공과 비동기 처리",
  },
  typescript: {
    id: "typescript",
    label: "TypeScript",
    shortLabel: "TS",
    color: "#70a7ff",
    description: "안전한 타입 설계와 추론",
  },
  react: {
    id: "react",
    label: "React",
    shortLabel: "R",
    color: "#67d8c1",
    description: "상태, 이펙트와 컴포넌트",
  },
};


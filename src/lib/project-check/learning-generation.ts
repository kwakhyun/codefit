export type LearningGeneration<T> =
  | { status: "pending"; completed: number; total: number; label: string }
  | { status: "done"; result: T };
export type LearningKind = "practice" | "workshop";

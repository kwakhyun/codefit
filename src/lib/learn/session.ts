import type { Progress } from "../problem";

/** Private response returned by GET /api/learn/[id]. */
export type LearningSession = {
  scope: string;
  signedIn: boolean;
  aiReady: boolean;
  progress: Progress | null;
};

import { allowanceFor } from "../ai-access";
import { PRACTICE_GENERATION_TIMEOUT_MS } from "../project-check/practice-generation-policy";
export const generationAllowance = (owner: string) => allowanceFor(owner).generate;
export function generationLeaseMs(kind: string) {
  // A concurrent request must not reclaim a practice job during quality repair.
  return kind.startsWith("project-practice:") || kind.startsWith("project-learning-stage:")
    ? PRACTICE_GENERATION_TIMEOUT_MS + 30_000
    : 150_000;
}
/** Fixed calendar days in Asia/Seoul, including requests around UTC midnight. */
export function generationDay(now = Date.now()) {
  const offset = 9 * 60 * 60 * 1000;
  const dayMs = 86400000;
  return {
    key: new Date(now + offset).toISOString().slice(0, 10),
    resetsAt: (Math.floor((now + offset) / dayMs) + 1) * dayMs - offset,
  };
}

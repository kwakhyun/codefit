import { allowanceFor } from "../ai-access";
export const generationAllowance = (owner: string) => allowanceFor(owner).generate;
export const GENERATION_LEASE_MS = 150_000;
/** Fixed calendar days in Asia/Seoul, including requests around UTC midnight. */
export function generationDay(now = Date.now()) {
  const offset = 9 * 60 * 60 * 1000;
  const dayMs = 86400000;
  return {
    key: new Date(now + offset).toISOString().slice(0, 10),
    resetsAt: (Math.floor((now + offset) / dayMs) + 1) * dayMs - offset,
  };
}

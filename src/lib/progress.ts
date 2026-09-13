import type { ProgressSummary } from "./problem";

/** A late network response must not roll the visible progress back. */
export function latestProgress<T extends ProgressSummary>(
  current: T | null | undefined,
  incoming: T,
): T {
  return current && current.updatedAt > incoming.updatedAt ? current : incoming;
}

import type { ProgressSummary } from "./problem";

/** A late network response must not roll the visible progress back. */
export function latestProgress<T extends ProgressSummary>(
  current: T | null | undefined,
  incoming: T,
): T {
  if (!current) return incoming;
  const metadata = current.updatedAt > incoming.updatedAt ? current : incoming;
  const code = current.codeRevision > incoming.codeRevision ? current : incoming;
  return {
    ...metadata,
    codeRevision: code.codeRevision,
    ...("code" in code ? { code: code.code } : {}),
  };
}

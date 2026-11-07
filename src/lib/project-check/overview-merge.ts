import type { CheckOverview } from "./types";

/**
 * A background refresh re-reads only the first page. Pages already shown after it are kept so
 * the list never collapses, and items that moved into the first page are not repeated.
 */
export function mergeFirstPage(current: CheckOverview | undefined, first: CheckOverview) {
  if (!current || current.scope !== first.scope || !first.nextCursor) return first;
  const ids = new Set(first.checks.map((check) => check.id));
  const last = first.checks.at(-1);
  const boundary = last ? current.checks.findIndex((check) => check.id === last.id) : -1;
  const rest = boundary < 0 ? [] : current.checks.slice(boundary + 1).filter((c) => !ids.has(c.id));
  return rest.length
    ? { ...first, checks: [...first.checks, ...rest], nextCursor: current.nextCursor }
    : first;
}
/** Appends an older page without duplicating items already shown. */
export function appendPage(current: CheckOverview, page: CheckOverview): CheckOverview {
  if (current.scope !== page.scope) return current;
  return {
    ...current,
    checks: [
      ...current.checks,
      ...page.checks.filter((check) => !current.checks.some((known) => known.id === check.id)),
    ],
    nextCursor: page.nextCursor,
  };
}

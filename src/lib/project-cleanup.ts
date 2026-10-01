"use client";
import { reviewStorageKey } from "@/hooks/use-project-review";
import { dismissAnalysis } from "./project-analysis-tasks";

/** Clears browser-only records of deleted analyses, whichever page deleted them. */
export function forgetProjects(scope: string, ids: string[]) {
  for (const id of ids) dismissAnalysis(id);
  try {
    const selectionKey = `codefit-project-selection:${scope}`;
    if (ids.includes(sessionStorage.getItem(selectionKey) ?? ""))
      sessionStorage.removeItem(selectionKey);
    for (const key of Object.keys(sessionStorage))
      if (
        ids.some(
          (id) =>
            key === `codefit-project:${scope}:${id}` ||
            key.startsWith(`codefit-training:${scope}:${id}:`) ||
            key.startsWith(`codefit-follow-up:${scope}:${id}`),
        )
      )
        sessionStorage.removeItem(key);
  } catch {
    /* The server records are already gone; blocked storage only keeps stale drafts. */
  }
  try {
    for (const id of ids) localStorage.removeItem(reviewStorageKey(scope, id));
  } catch {}
}

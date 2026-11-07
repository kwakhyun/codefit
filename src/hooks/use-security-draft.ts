"use client";
import { useRef, useState } from "react";
import { z } from "zod";

const reportSchema = z.object({
  url: z.string().max(2000),
  checkedAt: z.iso.datetime(),
  findings: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        status: z.enum(["observed", "review", "unknown"]),
        evidence: z.string(),
        action: z.string(),
      }),
    )
    .max(30),
  status: z.number().int().optional(),
  redirects: z.array(z.string().max(2000)).max(3).optional(),
});
/** Earlier results kept for comparison in this tab, newest first. */
export const SECURITY_HISTORY_LIMIT = 5;
const schema = z.object({
  version: z.literal(1),
  url: z.string().max(2000),
  notes: z.array(z.string().max(2000)).length(3),
  report: reportSchema.nullable(),
  /** The address entered for the shown report; a later edit keeps the report with a notice. */
  checkedInput: z.string().max(2000).optional(),
  history: z
    .array(z.object({ input: z.string().max(2000), report: reportSchema }))
    .max(SECURITY_HISTORY_LIMIT)
    .optional(),
});
type Draft = z.infer<typeof schema>;
function empty(): Draft {
  return { version: 1, url: "", notes: ["", "", ""], report: null, history: [] };
}
function load(key: string): Draft {
  try {
    const saved = schema.safeParse(JSON.parse(sessionStorage.getItem(key) || "null"));
    if (saved.success) return saved.data;
  } catch {}
  return empty();
}

/** Mount only after verifying the current workspace, and remount when its scope changes. */
export function useSecurityDraft(scope: string) {
  const key = `codefit-security:${scope}`;
  const [draft, setDraft] = useState(() => load(key));
  const current = useRef(draft);
  const [storageError, setStorageError] = useState(false);
  function saveDraft(change: (value: Draft) => Draft) {
    const next = change(current.current);
    current.current = next;
    setDraft(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  return { draft, saveDraft, storageError, clear: () => saveDraft(empty) };
}

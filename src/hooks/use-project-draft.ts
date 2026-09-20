"use client";
import { useRef, useState } from "react";
import { z } from "zod";

const schema = z.object({
  version: z.literal(1),
  url: z.string().max(1500),
  description: z.string().max(2000),
  requestId: z.uuid().nullable(),
});
type Draft = z.infer<typeof schema>;
function load(key: string): Draft {
  try {
    const saved = schema.safeParse(JSON.parse(sessionStorage.getItem(key) || "null"));
    if (saved.success) return saved.data;
  } catch {}
  return { version: 1, url: "", description: "", requestId: null };
}

/** Mount once per workspace scope; consent is deliberately not persisted. */
export function useProjectDraft(scope: string) {
  const key = `codefit-project-input:${scope}`;
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
  function clearSavedDraft() {
    try {
      sessionStorage.removeItem(key);
    } catch {
      setStorageError(true);
    }
  }
  return { draft, saveDraft, clearSavedDraft, storageError };
}

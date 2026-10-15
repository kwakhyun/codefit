"use client";
import { useEffect, useRef, useState } from "react";
import type { GeneratedPractice, PracticeMode } from "@/lib/project-check/generated-practice";
import {
  acknowledgePracticeDraft,
  emptyPracticeDraft,
  practiceContent,
  practiceDraftIndex,
  practiceDraftKey,
  practiceDraftSchema,
  practiceDraftView,
  resolvePracticeDraft,
  updatePracticeDraft,
  type PracticeDraft,
  type PracticeDraftEntry,
} from "@/lib/project-check/practice-draft";
const draftChanged = "codefit:practice-draft-changed";

function readPracticeDraft(key: string): PracticeDraft | null {
  const parsed = practiceDraftSchema.safeParse(JSON.parse(sessionStorage.getItem(key) || "null"));
  return parsed.success ? parsed.data : null;
}

export function usePracticeDraft(
  scope: string,
  id: string,
  mode: PracticeMode,
  saved: GeneratedPractice,
) {
  const key = practiceDraftKey(scope, id, mode);
  const content = practiceContent(saved, mode);
  const progress = saved.progress[mode];
  const [initial] = useState(() => {
    try {
      const stored = readPracticeDraft(key);
      return {
        draft: stored?.content === content ? stored : emptyPracticeDraft(content, progress),
        failed: false,
      };
    } catch {
      return { draft: emptyPracticeDraft(content, progress), failed: true };
    }
  });
  const [draft, setDraft] = useState(initial.draft);
  const latest = useRef(draft);
  const [storageError, setStorageError] = useState(initial.failed);
  useEffect(() => {
    const refresh = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== key) return;
      try {
        const next = readPracticeDraft(key);
        if (next?.content === content) {
          latest.current = next;
          setDraft(next);
        }
      } catch {
        setStorageError(true);
      }
    };
    window.addEventListener(draftChanged, refresh);
    return () => window.removeEventListener(draftChanged, refresh);
  }, [key, content]);
  function persist(next: PracticeDraft) {
    latest.current = next;
    setDraft(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
      window.dispatchEvent(new CustomEvent(draftChanged, { detail: key }));
    } catch {
      setStorageError(true);
    }
  }
  const index = practiceDraftIndex(draft, progress);
  const view = practiceDraftView(draft, progress, index);
  function update(
    patch: Partial<Pick<PracticeDraftEntry, "choice" | "reason" | "note" | "stage">>,
  ) {
    persist(updatePracticeDraft(latest.current, progress, index, patch, crypto.randomUUID()));
  }
  function select(next: number) {
    persist({ ...latest.current, active: next });
  }
  function resolve(restore: boolean) {
    persist(resolvePracticeDraft(latest.current, progress, index, restore, crypto.randomUUID()));
  }
  function capture() {
    const token = crypto.randomUUID();
    persist(updatePracticeDraft(latest.current, progress, index, {}, token));
    return token;
  }
  function acknowledge(
    next: GeneratedPractice,
    submittedIndex: number,
    token: string,
    finish: boolean,
  ) {
    // The component may have unmounted while the user opened this track again.
    // Re-read its latest draft before clearing the request's submitted version.
    let current = latest.current;
    if (practiceContent(next, mode) !== content) return;
    try {
      const stored = readPracticeDraft(key);
      if (stored && stored.content !== content) return;
      current = stored ?? current;
    } catch {
      setStorageError(true);
    }
    const acknowledged = acknowledgePracticeDraft(
      current,
      next.progress[mode],
      submittedIndex,
      token,
      finish,
    );
    if (acknowledged !== current) persist(acknowledged);
  }
  return { index, ...view, storageError, update, select, resolve, capture, acknowledge };
}

"use client";
import { useRef, useState } from "react";
import {
  emptyReview,
  mergeReviewDraft,
  reviewDraftSchema,
  type ReviewDraft,
  type ReviewEntry,
} from "@/lib/project-check/review-draft";
export const reviewStorageKey = (scope: string, id: string) =>
  `codefit-project-review:${scope}:${id}`;
function read(key: string) {
  const parsed = reviewDraftSchema.safeParse(JSON.parse(localStorage.getItem(key) || "null"));
  return parsed.success ? parsed.data : emptyReview();
}
export function useProjectReview(scope: string, id: string) {
  const key = reviewStorageKey(scope, id);
  const [initial] = useState(() => {
    try {
      return { value: read(key), failed: false };
    } catch {
      return { value: emptyReview(), failed: true };
    }
  });
  const [saved, setSaved] = useState(initial.value);
  const latest = useRef(saved);
  const sequence = useRef(0);
  const pending = useRef<
    {
      ticket: number;
      base: ReviewDraft;
      active: string;
      patch: Partial<ReviewEntry>;
      reset: boolean;
    }[]
  >([]);
  const [failed, setFailed] = useState(initial.failed);
  const [saving, setSaving] = useState(false);
  function persist(base: ReviewDraft, active: string, patch: Partial<ReviewEntry>, reset = false) {
    const ticket = ++sequence.current;
    pending.current.push({ ticket, base, active, patch, reset });
    const optimistic = reset
      ? { ...emptyReview(), active }
      : mergeReviewDraft(latest.current, base, active, patch);
    latest.current = optimistic;
    setSaved(optimistic);
    setSaving(true);
    // An exclusive browser lock makes the read/merge/write atomic across tabs.
    const operation = navigator.locks
      ? navigator.locks.request(key, () => {
          const remote = read(key);
          const next = pending.current
            .filter((edit) => edit.ticket <= ticket)
            .reduce(
              (value, edit) =>
                edit.reset
                  ? { ...emptyReview(), active: edit.active }
                  : mergeReviewDraft(value, edit.base, edit.active, edit.patch),
              remote,
            );
          localStorage.setItem(key, JSON.stringify(next));
          pending.current = pending.current.filter((edit) => edit.ticket > ticket);
          return next;
        })
      : Promise.reject(new Error("Browser locks unavailable"));
    void operation
      .then((next) => {
        if (ticket === sequence.current) {
          latest.current = next;
          setSaved(next);
          setFailed(false);
        }
      })
      .catch(() => {
        if (ticket === sequence.current) setFailed(true);
      })
      .finally(() => {
        if (ticket === sequence.current) setSaving(false);
      });
  }
  function update(active: string, patch: Partial<ReviewEntry> = {}) {
    persist(latest.current, active, patch);
  }
  function reset(active: string) {
    persist(latest.current, active, {}, true);
  }
  return { saved, update, reset, failed, saving };
}

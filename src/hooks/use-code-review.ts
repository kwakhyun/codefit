"use client";

import { useRef, useState, type RefObject } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { missingHandoffFields, readHandoffDraft, handoffMissingMessage } from "@/lib/handoff/draft";
import type { Attempt, Progress } from "@/lib/problem";

type ReviewResult = { attempt: Attempt; progress: Progress };

/** Owns submission exclusion and retry identity; the workspace owns displayed results. */
export function useCodeReview({
  id,
  scope,
  aiReady,
  handoff,
  mounted,
  saveBeforeReview,
  onReviewed,
  onError,
}: {
  id: string;
  scope: string;
  aiReady: boolean;
  handoff: boolean;
  mounted: RefObject<boolean>;
  saveBeforeReview: () => Promise<void>;
  onReviewed: (result: ReviewResult) => void;
  onError: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const request = useRef<{ code: string; id: string } | null>(null);

  async function review(value: string) {
    if (pending.current || value.trim().length < 5 || !aiReady) return;
    if (handoff) {
      const missing = missingHandoffFields(readHandoffDraft(value).notes);
      if (missing.length) {
        onError(handoffMissingMessage(missing) + " 내용의 정확성은 AI가 별도로 검토합니다.");
        return;
      }
    }
    pending.current = true;
    setBusy(true);
    onError("");
    try {
      await saveBeforeReview();
      if (!mounted.current) return;
      if (request.current?.code !== value)
        request.current = { code: value, id: crypto.randomUUID() };
      const result = await api<ReviewResult>(`/api/problems/${encodeURIComponent(id)}/review`, {
        method: "POST",
        scope,
        body: { code: value, requestId: request.current.id },
      });
      if (!mounted.current) return;
      request.current = null;
      onReviewed(result);
    } catch (error) {
      if (mounted.current) onError(errorMessage(error));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { busy, review };
}

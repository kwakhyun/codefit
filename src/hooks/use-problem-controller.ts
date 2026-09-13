"use client";

import type { ConfirmationAction, WorkspaceTab } from "@/components/workspace/types";

import { useCodeDraft } from "@/hooks/use-code-draft";
import { api, errorMessage } from "@/lib/client-api";
import type { Attempt, Progress, PublicProblem } from "@/lib/problem";
import { latestProgress } from "@/lib/progress";
import { useCallback, useEffect, useRef, useState } from "react";
type Detail = {
  problem: PublicProblem;
  progress: Progress | null;
  hints: string[];
  solution: { code: string; explanation: string } | null;
  attempts: Attempt[];
};

export function useProblemController({
  id,
  scope,
  onProgress,
  aiReady,
  initialAttemptId,
}: {
  id: string;
  scope: string;
  onProgress: (p: Progress, attempt?: Attempt) => void;
  aiReady: boolean;
  initialAttemptId?: string;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);

  const [tab, setTab] = useState<WorkspaceTab>(initialAttemptId ? "history" : "problem");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmationAction>(null);
  const [selectedAttempt, setSelectedAttempt] = useState<Attempt | null>(null);
  const [undoCode, setUndoCode] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [bookmarkBusy, setBookmarkBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const pending = useRef(false);
  const reviewRequest = useRef<{ code: string; id: string } | null>(null);

  const mounted = useRef(true);

  const onSaved = useCallback(
    (progress: Progress) => {
      setDetail((prev) =>
        prev ? { ...prev, progress: latestProgress(prev.progress, progress) } : prev,
      );
      onProgress(progress);
    },
    [onProgress],
  );
  const {
    code,
    saveState,
    initialize,
    changeCode,
    flush,
    saveNow,
    saveBeforeReview,
    restoreImportedCode,
    getCode,
  } = useCodeDraft({ id, scope, mounted, onSaved, onError: setError });
  const load = useCallback(async () => {
    try {
      const next = await api<Detail>(
        `/api/problems/${encodeURIComponent(id)}${initialAttemptId ? `?attempt=${encodeURIComponent(initialAttemptId)}` : ""}`,
      );
      if (!mounted.current) return;
      setLoadError("");
      const localNewer = initialize(next.progress, next.problem.starterCode);
      setDetail(next);
      setSelectedAttempt(
        next.attempts.find((a) => a.id === initialAttemptId) || next.attempts[0] || null,
      );

      if (localNewer) setNotice("이 브라우저에 남아 있던 미저장 코드를 복구했습니다.");
    } catch (e) {
      if (mounted.current) setLoadError(errorMessage(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [id, initialAttemptId, initialize]);
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(load);
    return () => {
      mounted.current = false;
      void flush();
    };
  }, [load, flush]);
  useEffect(() => {
    if (!loading) void flush();
  }, [loading, flush]);
  useEffect(() => {
    const refreshImported = async () => {
      try {
        const next = await api<Detail>(
          `/api/problems/${encodeURIComponent(id)}${initialAttemptId ? `?attempt=${encodeURIComponent(initialAttemptId)}` : ""}`,
        );
        if (!mounted.current) return;
        restoreImportedCode(next.progress?.code);
        setDetail((prev) => ({
          ...next,
          progress:
            prev?.progress && next.progress && prev.progress.updatedAt > next.progress.updatedAt
              ? prev.progress
              : next.progress,
        }));
        setSelectedAttempt(
          (prev) => next.attempts.find((a) => a.id === prev?.id) || next.attempts[0] || null,
        );
        setNotice("가져온 힌트와 제출 기록을 반영했습니다.");
      } catch (e) {
        if (mounted.current) setError(errorMessage(e));
      }
    };
    window.addEventListener("codefit:backup-imported", refreshImported);
    return () => window.removeEventListener("codefit:backup-imported", refreshImported);
  }, [id, initialAttemptId, restoreImportedCode]);
  async function review(value: string) {
    if (pending.current || value.trim().length < 5 || !aiReady) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      await saveBeforeReview(value);
      if (reviewRequest.current?.code !== value)
        reviewRequest.current = { code: value, id: crypto.randomUUID() };
      const result = await api<{ attempt: Attempt; progress: Progress }>(
        `/api/problems/${encodeURIComponent(id)}/review`,
        { method: "POST", body: { code: value, requestId: reviewRequest.current.id } },
      );
      if (!mounted.current) return;
      reviewRequest.current = null;
      setSelectedAttempt(result.attempt);
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              progress: latestProgress(prev.progress, result.progress),
              attempts: [
                result.attempt,
                ...prev.attempts.filter((a) => a.id !== result.attempt.id),
              ],
            }
          : prev,
      );
      onProgress(result.progress, result.attempt);
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function reveal(kind: "hint" | "solution") {
    if (revealing) return;
    setRevealing(true);
    setError("");
    setConfirm(null);
    try {
      const result = await api<Pick<Detail, "hints" | "solution"> & { progress: Progress }>(
        `/api/problems/${encodeURIComponent(id)}/reveal`,
        { method: "POST", body: { kind } },
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              ...result,
              progress: latestProgress(prev.progress, result.progress),
            }
          : prev,
      );
      onProgress(result.progress);
      setTab(kind === "hint" ? "hints" : "solution");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRevealing(false);
    }
  }
  async function bookmark() {
    if (!detail || bookmarkBusy) return;
    setBookmarkBusy(true);
    try {
      const { progress } = await api<{ progress: Progress }>(
        `/api/progress/${encodeURIComponent(id)}`,
        { method: "PUT", body: { bookmarked: !detail.progress?.bookmarked } },
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              progress: latestProgress(prev.progress, progress),
            }
          : prev,
      );
      onProgress(progress);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBookmarkBusy(false);
    }
  }
  function replaceCode(value: string, message: string) {
    setUndoCode(getCode());
    changeCode(value);
    setNotice(message);
    setConfirm(null);
  }

  return {
    detail,
    code,
    tab,
    setTab,
    error,
    setError,
    loadError,
    setLoadError,
    loading,
    setLoading,
    saveState,
    busy,
    revealing,
    confirm,
    setConfirm,
    selectedAttempt,
    setSelectedAttempt,
    undoCode,
    setUndoCode,
    notice,
    setNotice,
    bookmarkBusy,
    copied,
    setCopied,
    load,
    changeCode,
    review,
    reveal,
    bookmark,
    replaceCode,
    saveNow,
  };
}

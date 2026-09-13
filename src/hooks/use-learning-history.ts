"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import type { HistoryPage } from "@/lib/problem";

export function useLearningHistory(revision: unknown) {
  const [page, setPage] = useState<HistoryPage>({ attempts: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const load = useCallback(async (cursor?: string | null) => {
    active.current?.abort();
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setError("");
    try {
      const next = await api<HistoryPage>(
        `/api/history${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        { signal: controller.signal },
      );
      if (!controller.signal.aborted)
        setPage((old) => ({
          ...next,
          attempts: cursor
            ? [
                ...old.attempts,
                ...next.attempts.filter((a) => !old.attempts.some((p) => p.id === a.id)),
              ]
            : next.attempts,
        }));
    } catch (err) {
      if (!controller.signal.aborted) setError(errorMessage(err));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    void Promise.resolve().then(() => load());
    return () => active.current?.abort();
  }, [revision, load]);
  return { ...page, loading, error, loadMore: () => load(page.nextCursor) };
}

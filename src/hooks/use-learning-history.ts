"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import type { HistoryPage } from "@/lib/problem";

export type HistoryFilter = "all" | "unsolved";

/** Paged review history. "unsolved" lists the latest review of each problem not yet solved. */
export function useLearningHistory(revision: unknown, filter: HistoryFilter = "all") {
  const [page, setPage] = useState<HistoryPage>({ attempts: [], nextCursor: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const active = useRef<AbortController | null>(null);
  const load = useCallback(
    async (cursor?: string | null) => {
      active.current?.abort();
      const controller = new AbortController();
      active.current = controller;
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (filter === "unsolved") params.set("filter", "unsolved");
      try {
        const next = await api<HistoryPage>(`/api/history${params.size ? `?${params}` : ""}`, {
          signal: controller.signal,
        });
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
    },
    [filter],
  );
  useEffect(() => {
    void Promise.resolve().then(() => load());
    return () => active.current?.abort();
  }, [revision, load]);
  return { ...page, loading, error, loadMore: () => load(page.nextCursor) };
}

"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage, setWorkspaceScope } from "@/lib/client-api";
import { appendPage, mergeFirstPage } from "@/lib/project-check/overview-merge";
import type { CheckOverview } from "@/lib/project-check/types";

/** Bursts of focus events (window switching) collapse into one first-page read. */
const FOCUS_DEBOUNCE_MS = 400;

/**
 * The project list shared by /project-check, /projects and /project-practice: one first-page
 * read on entry, debounced focus refreshes that re-read only the first page (older pages that are
 * already shown are kept), immediate refreshes after a backup import or a finished analysis, and
 * paging that appends older items.
 */
export function useProjectOverview() {
  const [data, setData] = useState<CheckOverview>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState("");
  const [revision, setRevision] = useState(0);
  const pageRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    let timer: number | undefined;
    const now = () => setRevision((n) => n + 1);
    const focus = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(now, FOCUS_DEBOUNCE_MS);
    };
    window.addEventListener("focus", focus);
    window.addEventListener("codefit:backup-imported", now);
    window.addEventListener("codefit:analysis-changed", now);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", focus);
      window.removeEventListener("codefit:backup-imported", now);
      window.removeEventListener("codefit:analysis-changed", now);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    api<CheckOverview>("/api/project-check", {
      scope: null,
      // Only the first visible load joins the global progress bar.
      track: revision === 0,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then((first) => {
        if (controller.signal.aborted) return;
        setWorkspaceScope(first.scope);
        setData((current) => {
          if (current && current.scope !== first.scope) pageRequest.current?.abort();
          return mergeFirstPage(current, first);
        });
        setError("");
      })
      .catch((e) => {
        // Keep the shown list when a background refresh fails.
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [revision]);
  useEffect(() => () => pageRequest.current?.abort(), []);
  async function loadMore() {
    if (!data?.nextCursor || pageRequest.current) return;
    const controller = new AbortController();
    pageRequest.current = controller;
    setPaging(true);
    setPageError("");
    try {
      const page = await api<CheckOverview>(
        `/api/project-check?cursor=${encodeURIComponent(data.nextCursor)}`,
        {
          scope: data.scope,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        },
      );
      if (controller.signal.aborted) return;
      if (page.scope !== data.scope) {
        setRevision((n) => n + 1);
        return;
      }
      setData((current) => (current ? appendPage(current, page) : current));
    } catch (e) {
      if (!controller.signal.aborted) setPageError(errorMessage(e));
    } finally {
      if (pageRequest.current === controller) pageRequest.current = null;
      setPaging(false);
    }
  }
  return {
    data,
    /** Applies an optimistic change to the list of the same account. */
    update: (change: (current: CheckOverview) => CheckOverview) =>
      setData((current) => (current ? change(current) : current)),
    error,
    loading,
    refresh: () => {
      setLoading(true);
      setRevision((n) => n + 1);
    },
    loadMore,
    paging,
    pageError,
  };
}

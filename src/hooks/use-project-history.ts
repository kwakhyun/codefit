"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errorMessage } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
import { z } from "zod";
export type UpdateOverview = (update: (current: CheckOverview) => CheckOverview) => void;
export function useProjectHistory(data: CheckOverview, onChange: UpdateOverview) {
  const selected = useSearchParams().get("check");
  const selectionKey = `codefit-project-selection:${data.scope}`;
  const initialized = useRef(false);
  const [detail, setDetail] = useState<{ id: string; check?: Check; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState("");
  const pageRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    // Restore once on entry. Later URL changes (including Back to a new draft)
    // are explicit navigation and must never be replaced by an older selection.
    if (!initialized.current) {
      initialized.current = true;
      if (!selected) {
        try {
          const saved = z.uuid().safeParse(sessionStorage.getItem(selectionKey));
          if (saved.success) {
            const url = new URL(window.location.href);
            url.searchParams.set("check", saved.data);
            window.history.replaceState(null, "", url);
            return;
          }
        } catch {}
      }
    }
    try {
      if (selected) sessionStorage.setItem(selectionKey, selected);
      else sessionStorage.removeItem(selectionKey);
    } catch {
      // The server record and its direct URL remain usable when tab storage is blocked.
    }
  }, [selected, selectionKey]);
  useEffect(() => {
    // A refreshed first page invalidates any in-flight older-page request.
    pageRequest.current?.abort();
    pageRequest.current = null;
    return () => pageRequest.current?.abort();
  }, [data.scope, data.nextCursor, data.checks]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    api<Check>(`/api/project-check/${encodeURIComponent(selected)}`, {
      scope: data.scope,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then((check) => {
        if (!controller.signal.aborted) {
          setDetail({ id: selected, check });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setDetail({ id: selected, error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [selected, data.scope, retry, data.checks]);
  function select(id: string | null, replace = false) {
    try {
      if (id) sessionStorage.setItem(selectionKey, id);
      else sessionStorage.removeItem(selectionKey);
    } catch {}
    const url = new URL(window.location.href);
    if (id) url.searchParams.set("check", id);
    else url.searchParams.delete("check");
    url.hash = "";
    if (url.href === window.location.href) return;
    window.history[replace ? "replaceState" : "pushState"](null, "", url);
  }
  async function loadMore() {
    if (!data.nextCursor || pageRequest.current) return;
    const controller = new AbortController();
    pageRequest.current = controller;
    setPaging(true);
    setPageError("");
    try {
      const result = await api<CheckOverview>(
        `/api/project-check?cursor=${encodeURIComponent(data.nextCursor)}`,
        {
          scope: data.scope,
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
        },
      );
      if (controller.signal.aborted) return;
      onChange((current) => ({
        ...current,
        checks: [
          ...current.checks,
          ...result.checks.filter((c) => !current.checks.some((known) => known.id === c.id)),
        ],
        nextCursor: result.nextCursor,
      }));
    } catch (e) {
      if (!controller.signal.aborted) setPageError(errorMessage(e));
    } finally {
      if (pageRequest.current === controller) pageRequest.current = null;
      setPaging(false);
    }
  }
  return {
    selected,
    check: detail?.id === selected ? detail.check : undefined,
    detailError: detail?.id === selected ? detail.error : undefined,
    select,
    reloadDetail: () => {
      setDetail(undefined);
      setRetry((n) => n + 1);
    },
    updateDetail: (check: Check) => {
      setDetail({ id: check.id, check });
    },
    loadMore,
    paging,
    pageError,
  };
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api, errorMessage } from "@/lib/client-api";
import type { Check, CheckOverview } from "@/lib/project-check/types";
export type UpdateOverview = (update: (current: CheckOverview) => CheckOverview) => void;
export function useProjectHistory(data: CheckOverview, onChange: UpdateOverview) {
  const selected = useSearchParams().get("check");
  const listed = data.checks.find((c) => c.id === selected);
  const [detail, setDetail] = useState<{ id: string; check?: Check; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [paging, setPaging] = useState(false);
  const [pageError, setPageError] = useState("");
  const pageRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    // A refreshed first page invalidates any in-flight older-page request.
    pageRequest.current?.abort();
    pageRequest.current = null;
    return () => pageRequest.current?.abort();
  }, [data.scope, data.nextCursor, data.checks]);
  useEffect(() => {
    if (!selected || listed) return;
    const controller = new AbortController();
    api<Check>(`/api/project-check/${encodeURIComponent(selected)}`, {
      scope: data.scope,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then((check) => {
        if (!controller.signal.aborted) setDetail({ id: selected, check });
      })
      .catch((e) => {
        if (!controller.signal.aborted) setDetail({ id: selected, error: errorMessage(e) });
      });
    return () => controller.abort();
  }, [selected, listed, data.scope, retry, data.checks]);
  function select(id: string | null, replace = false) {
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
    check: listed ?? (detail?.id === selected ? detail.check : undefined),
    detailError: !listed && detail?.id === selected ? detail.error : undefined,
    select,
    reloadDetail: () => {
      setDetail(undefined);
      setRetry((n) => n + 1);
    },
    updateDetail: (check: Check) => setDetail({ id: check.id, check }),
    loadMore,
    paging,
    pageError,
  };
}

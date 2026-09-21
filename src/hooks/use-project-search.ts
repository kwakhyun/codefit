"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import type { CheckOverview } from "@/lib/project-check/types";
export function useProjectSearch(query: string, overview: CheckOverview) {
  const term = query.trim();
  const [result, setResult] = useState<{ term: string; page: CheckOverview }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ term: string; message: string }>();
  const [revision, setRevision] = useState(0);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!term) return;
    const controller = new AbortController();
    request.current = controller;
    const timer = setTimeout(() => {
      setBusy(true);
      void api<CheckOverview>(`/api/project-check?q=${encodeURIComponent(term)}`, {
        scope: overview.scope,
        signal: controller.signal,
      })
        .then((page) => {
          if (controller.signal.aborted) return;
          if (page.scope !== overview.scope)
            throw new Error("계정이 변경되었습니다. 목록을 다시 열어 주세요.");
          setResult({ term, page });
          setError(undefined);
        })
        .catch((e) => {
          if (!controller.signal.aborted) setError({ term, message: errorMessage(e) });
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setBusy(false);
            request.current = null;
          }
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
      request.current?.abort();
    };
  }, [term, overview, revision]);
  const current = result?.term === term ? result.page : undefined;
  async function more() {
    if (!current?.nextCursor || busy || request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    try {
      const page = await api<CheckOverview>(
        `/api/project-check?q=${encodeURIComponent(term)}&cursor=${encodeURIComponent(current.nextCursor)}`,
        { scope: overview.scope, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      if (page.scope !== overview.scope)
        throw new Error("계정이 변경되었습니다. 목록을 다시 열어 주세요.");
      setResult({
        term,
        page: {
          ...page,
          checks: [
            ...current.checks,
            ...page.checks.filter((item) => !current.checks.some((old) => old.id === item.id)),
          ],
        },
      });
      setError(undefined);
    } catch (e) {
      if (!controller.signal.aborted) setError({ term, message: errorMessage(e) });
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        request.current = null;
      }
    }
  }
  const message = error?.term === term ? error.message : "";
  return {
    page: current,
    busy: !!term && (busy || (!current && !message)),
    error: message,
    more,
    retry: () => setRevision((v) => v + 1),
  };
}

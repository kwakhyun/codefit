"use client";
import { useEffect, useRef, useState } from "react";
import { api, dateLabel, errorMessage } from "@/lib/client-api";
import type { CheckListItem } from "@/lib/project-check/types";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { AppLink, Button, Card } from "@/components/ui/primitives";
type Versions = { checks: CheckListItem[]; nextCursor: string | null };
export function ProjectVersions({ id, scope }: { id: string; scope: string }) {
  const [page, setPage] = useState<Versions>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const loadedPages = useRef(1);
  const active = useRef<AbortController | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const refresh = () => {
      active.current?.abort();
      setBusy(true);
      setRetry((value) => value + 1);
    };
    window.addEventListener("focus", refresh);
    window.addEventListener("codefit:backup-imported", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("codefit:backup-imported", refresh);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    active.current = controller;
    async function refresh() {
      const first = await api<Versions>(`/api/projects/${id}/versions`, {
        scope,
        signal: controller.signal,
      });
      const checks = [...first.checks];
      let cursor = first.nextCursor;
      for (let index = 1; index < loadedPages.current && cursor; index++) {
        const next = await api<Versions>(
          `/api/projects/${id}/versions?cursor=${encodeURIComponent(cursor)}`,
          { scope, signal: controller.signal },
        );
        checks.push(...next.checks.filter((item) => !checks.some((old) => old.id === item.id)));
        cursor = next.nextCursor;
      }
      return { checks, nextCursor: cursor };
    }
    void refresh()
      .then((value) => {
        if (!controller.signal.aborted) {
          setPage(value);
          setError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setBusy(false);
          active.current = null;
        }
      });
    return () => active.current?.abort();
  }, [id, scope, retry]);
  async function more() {
    if (!page?.nextCursor || busy || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    try {
      const next = await api<Versions>(
        `/api/projects/${id}/versions?cursor=${encodeURIComponent(page.nextCursor)}`,
        { scope, signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      loadedPages.current++;
      setPage({
        ...next,
        checks: [
          ...page.checks,
          ...next.checks.filter((item) => !page.checks.some((old) => old.id === item.id)),
        ],
      });
      setError("");
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        active.current = null;
      }
    }
  }
  if (!error && page && page.checks.every((item) => item.id === id) && !page.nextCursor)
    return null;
  return (
    <Card className="class-versions">
      <h3>같은 저장소의 분석 기록</h3>
      <p>같은 주소로 분석한 기록입니다. 분석 시점을 비교하고 이전 학습으로 돌아갈 수 있어요.</p>
      {!page && !error && <ScreenSkeleton variant="response" label="분석 기록 불러오는 중" />}
      <ul>
        {page?.checks.map((item) => (
          <li key={item.id}>
            {item.id === id ? (
              <span aria-current="page">현재 클래스 — {dateLabel(item.createdAt)}</span>
            ) : (
              <AppLink href={`/projects?class=${item.id}`}>
                {item.classMetadata?.name || item.analysis.title} — {dateLabel(item.createdAt)}
              </AppLink>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">{error}</p>}
      {error && (
        <Button
          disabled={busy}
          onClick={() => {
            setBusy(true);
            setRetry((v) => v + 1);
          }}
        >
          다시 불러오기
        </Button>
      )}
      {page?.nextCursor && (
        <Button disabled={busy} onClick={more}>
          {busy ? "불러오는 중…" : "이전 분석 더 보기"}
        </Button>
      )}
    </Card>
  );
}

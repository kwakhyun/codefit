"use client";
import { useEffect, useState } from "react";
import { api, dateLabel, errorMessage } from "@/lib/client-api";
import type { CheckListItem } from "@/lib/project-check/types";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { AppLink, Button, Card } from "@/components/ui/primitives";
type Versions = { checks: CheckListItem[]; nextCursor: string | null };
export function ProjectVersions({ id, scope }: { id: string; scope: string }) {
  const [page, setPage] = useState<Versions>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<Versions>(`/api/projects/${id}/versions`, { scope, signal: controller.signal })
      .then((value) => {
        setPage(value);
        setError("");
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, [id, scope, retry]);
  async function more() {
    if (!page?.nextCursor || busy) return;
    setBusy(true);
    try {
      const next = await api<Versions>(
        `/api/projects/${id}/versions?cursor=${encodeURIComponent(page.nextCursor)}`,
        { scope },
      );
      setPage({
        ...next,
        checks: [
          ...page.checks,
          ...next.checks.filter((item) => !page.checks.some((old) => old.id === item.id)),
        ],
      });
      setError("");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
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
      {error && !page && <Button onClick={() => setRetry((v) => v + 1)}>다시 불러오기</Button>}
      {page?.nextCursor && (
        <Button disabled={busy} onClick={more}>
          {busy ? "불러오는 중…" : "이전 분석 더 보기"}
        </Button>
      )}
    </Card>
  );
}

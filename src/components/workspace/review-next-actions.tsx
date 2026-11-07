"use client";
import { AppLink as Link } from "@/components/ui/primitives";
import { api } from "@/lib/client-api";
import { domainLabel } from "@/lib/catalog";
import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary } from "@/lib/problem";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

type Next = { recommended: ProblemSummary | null; sameDomain: ProblemSummary | null };

/** After a passing review: the overall next recommendation and the next problem in the domain. */
export function ReviewNextActions({
  problemId,
  scope,
  returnTo,
}: {
  problemId: string;
  scope: string;
  returnTo: string;
}) {
  const [next, setNext] = useState<Next | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    api<Next>(`/api/problems/${encodeURIComponent(problemId)}/next`, {
      scope,
      signal: controller.signal,
      track: false,
    })
      .then(setNext)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [problemId, scope]);
  if (failed)
    return (
      <Link className="secondary-button" href={returnTo}>
        다른 문제 고르기 <ArrowRight size={16} />
      </Link>
    );
  if (!next) return <span className="review-next-loading">다음 문제를 찾는 중…</span>;
  const sameDomain = next.sameDomain?.id !== next.recommended?.id ? next.sameDomain : null;
  if (!next.recommended && !sameDomain)
    return (
      <p className="review-next-done">
        아직 풀지 않은 코딩 문제가 없습니다.{" "}
        <Link href={returnTo}>문제 목록에서 다시 풀 문제를 골라 보세요.</Link>
      </p>
    );
  return (
    <nav className="review-next-links" aria-label="다음 연습">
      {next.recommended && (
        <Link className="primary-button" href={problemUrl(next.recommended.id, returnTo)}>
          <span>
            <small>다음 추천 문제</small>
            {next.recommended.title}
          </span>
          <ArrowRight size={16} />
        </Link>
      )}
      {sameDomain && (
        <Link className="secondary-button" href={problemUrl(sameDomain.id, returnTo)}>
          <span>
            <small>같은 분야 다음 문제 · {domainLabel(sameDomain.domain)}</small>
            {sameDomain.title}
          </span>
          <ArrowRight size={16} />
        </Link>
      )}
    </nav>
  );
}

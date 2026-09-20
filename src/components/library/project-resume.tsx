"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client-api";
import type { CheckOverview } from "@/lib/project-check/types";
export function ProjectResume({ scope }: { scope: string }) {
  const [overview, setOverview] = useState<CheckOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!scope.startsWith("user:")) return;
    const controller = new AbortController();
    api<CheckOverview>("/api/project-check", { scope, signal: controller.signal })
      .then((value) => {
        if (!controller.signal.aborted && value.scope === scope) setOverview(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [scope]);
  const check = overview?.scope === scope ? overview.checks[0] : undefined;
  return (
    <section className="persona-project-resume" aria-label="내 프로젝트 점검 이어하기">
      <span className="eyebrow">{check ? "최근 프로젝트 기록" : "내 프로젝트로 시작하기"}</span>
      <h2>{check?.analysis.title || "내가 만든 서비스로 질문받아 보세요"}</h2>
      <p>
        {check
          ? check.review
            ? "받은 피드백을 바탕으로 실제 확인 결과와 보완 답변을 남겨보세요."
            : "저장된 설계 질문에 답하며 프로젝트 점검을 이어가세요."
          : "질문, 부족한 답변과 구체적인 피드백 예시를 먼저 살펴볼 수 있습니다."}
      </p>
      <Link
        className="primary-button"
        href={
          check
            ? `/project-check?check=${check.id}${check.review ? "#project-follow-up" : ""}`
            : "/project-check"
        }
      >
        {check ? "최근 프로젝트 이어서 점검" : "프로젝트 질문과 피드백 예시 보기"} →
      </Link>
      <small>
        {failed
          ? "기록을 불러오지 못했습니다. 프로젝트 점검에서 다시 확인할 수 있습니다."
          : "실제 분석은 로그인 필요 · 24시간에 프로젝트 2개까지"}
      </small>
    </section>
  );
}

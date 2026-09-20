"use client";
import { Card } from "@/components/ui/primitives";
import { useEffect, useState } from "react";
import { AppLink as Link } from "@/components/ui/primitives";
import { api } from "@/lib/client-api";
import type { CheckOverview } from "@/lib/project-check/types";
export function ProjectResume({ scope }: { scope: string }) {
  const [overview, setOverview] = useState<CheckOverview | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
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
  if (!check && !failed) return null;
  return (
    <Card as="section" className="project-resume-strip" aria-label="내 프로젝트 점검 이어하기">
      <div>
        <span className="eyebrow">{check ? "이어서 확인하기" : "점검 기록 확인"}</span>
        <h2>{check?.analysis.title || "이전 기록을 불러오지 못했어요"}</h2>
        <p>
          {check
            ? check.review
              ? "피드백을 읽고 확인 결과와 보완 답변을 남겨보세요."
              : "저장된 질문과 작성하던 답변부터 이어가세요."
            : "프로젝트 점검에서 다시 불러올 수 있습니다."}
        </p>
      </div>
      <Link
        className="secondary-button"
        href={
          check
            ? `/project-check?check=${check.id}${check.review ? "#project-follow-up" : ""}`
            : "/project-check"
        }
      >
        {check ? "최근 프로젝트 이어서 점검" : "기록 다시 확인"} →
      </Link>
    </Card>
  );
}

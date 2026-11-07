"use client";
import type { MouseEvent } from "react";
import { Anchor } from "@/components/ui/primitives";
import type { Check } from "@/lib/project-check/types";

/** Opens a collapsed section before jumping to it, so the index always lands on content. */
function openTarget(event: MouseEvent<HTMLAnchorElement>) {
  const id = event.currentTarget.hash.slice(1);
  const target = id ? document.getElementById(id) : null;
  if (target instanceof HTMLDetailsElement) target.open = true;
}

/** Summary facts and the section index; the stage actions live in each section. */
export function AnalysisOverview({ check }: { check: Check }) {
  const review = check.review;
  return (
    <div className="analysis-overview">
      <p className="analysis-lead">{check.analysis.summary}</p>
      <dl className="analysis-facts">
        <div>
          <dt>분석 자료</dt>
          <dd>{check.page.repository ? "공개 코드 발췌" : "공개 서비스 화면"}</dd>
        </div>
        <div>
          <dt>점검할 관점</dt>
          <dd>5가지 설계 질문</dd>
        </div>
        <div>
          <dt>현재 단계</dt>
          <dd>{review ? "확인하고 보완하기" : "설계 질문에 답하기"}</dd>
        </div>
      </dl>
      <nav className="analysis-journey" aria-label="프로젝트 점검 순서">
        <Anchor
          href="#project-question-workspace"
          aria-current={!review ? "step" : undefined}
          onClick={openTarget}
        >
          <span>01</span>
          <strong>{review ? "평가 결과" : "설계 질문에 답하기"}</strong>
          <small>{review ? "질문별 피드백과 점수" : "한 번에 한 질문씩"}</small>
        </Anchor>
        {review ? (
          <Anchor href="#project-follow-up" aria-current="step" onClick={openTarget}>
            <span>02</span>
            <strong>확인하고 보완하기</strong>
            <small>확인 기록, 수정 요청, 보완 답변</small>
          </Anchor>
        ) : (
          <span className="analysis-journey-locked">
            <span>02</span>
            <strong>확인하고 보완하기</strong>
            <small>답변 평가 후 열립니다</small>
          </span>
        )}
        <Anchor href="#project-analysis-material" onClick={openTarget}>
          <span>03</span>
          <strong>분석 자료와 근거</strong>
          <small>{check.page.repository ? "수집한 코드와 인용 위치" : "수집한 화면과 범위"}</small>
        </Anchor>
      </nav>
    </div>
  );
}

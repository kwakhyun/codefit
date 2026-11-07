"use client";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import { Disclosure, DisclosureSummary, Button } from "@/components/ui/primitives";
import { formatHandoffDraft } from "@/lib/handoff/draft";
import { HANDOFF_CRITERIA } from "@/lib/handoff/catalog";
import { AppLink as Link } from "@/components/ui/primitives";
import type { ConfirmationAction } from "@/components/workspace/types";
import type { Dispatch, SetStateAction } from "react";
import { ReviewNextActions } from "./review-next-actions";

import { dateLabel } from "@/lib/client-api";
import type { Attempt } from "@/lib/problem";
import {
  AlertCircle,
  CheckCircle2,
  History,
  LoaderCircle,
  PencilLine,
  Terminal,
} from "lucide-react";
interface ReviewPanelProps {
  handoff?: boolean;
  busy: boolean;
  selectedAttempt: Attempt | null;
  code: string;
  setConfirm: Dispatch<SetStateAction<ConfirmationAction>>;
  /** Requirement sentences, so each criterion shows what it was checked against. */
  requirements: string[];
  problemId: string;
  scope: string;
  returnTo: string;
  /** Coding problems only: go back to the editor with the feedback kept in view. */
  onRetry?: (attempt: Attempt) => void;
}
/** Unmet criteria first, each in requirement order. */
function orderedCriteria(criteria: Attempt["review"]["criteria"]) {
  return [...criteria].sort(
    (a, b) => Number(a.passed) - Number(b.passed) || a.requirementIndex - b.requirementIndex,
  );
}
export function ReviewPanel({
  handoff = false,
  busy,
  selectedAttempt,
  code,
  setConfirm,
  requirements,
  problemId,
  scope,
  returnTo,
  onRetry,
}: ReviewPanelProps) {
  const fade = useFadeTransition<HTMLElement>(`${busy}:${selectedAttempt?.id || "empty"}`);
  const review = selectedAttempt?.review;
  return (
    <section ref={fade} className="review-console" aria-label="AI 검토 결과" aria-live="polite">
      <div className="console-heading">
        <Terminal size={14} />
        <strong>검토 결과</strong>
        <span>AI 코드 리뷰 · 실행 검증 아님</span>
      </div>
      {busy ? (
        <div className="console-idle">
          <p>
            <LoaderCircle size={15} className="spin" />
            요구사항과 경계 조건을 하나씩 살펴보고 있습니다.
          </p>
          <small>검토 중에도 코드를 수정할 수 있습니다. 제출 시점의 코드로 검토합니다.</small>
        </div>
      ) : selectedAttempt && review ? (
        <div className="review-result">
          <div className="review-result-title">
            <span className={review.passed ? "success-text" : "warning-text"}>
              {review.passed ? <CheckCircle2 size={22} /> : <AlertCircle size={22} />}
              <strong>
                {review.passed
                  ? "AI 검토 기준을 모두 충족했습니다."
                  : "보완할 내용을 확인해 보세요."}
              </strong>
            </span>
            <b>
              {review.score}
              <small>%</small>
            </b>
          </div>
          <p>{review.summary}</p>
          {selectedAttempt.code !== code && (
            <p className="review-stale">
              <History size={14} /> 현재 코드와 다른 제출본의 검토 결과입니다.
            </p>
          )}
          {review.exampleTests && (
            <p className="review-example-tests">
              제출 시점 예시 테스트 {review.exampleTests.passed}/{review.exampleTests.total}개 통과
              <small> · 브라우저에서 실행한 결과로, AI 검토와 별개입니다.</small>
            </p>
          )}
          {!handoff && onRetry && (
            <div className="review-next">
              {review.passed ? (
                <ReviewNextActions problemId={problemId} scope={scope} returnTo={returnTo} />
              ) : (
                <Button className="primary-button" onClick={() => onRetry(selectedAttempt)}>
                  <PencilLine size={16} />
                  보완할 점 보며 다시 풀기
                </Button>
              )}
            </div>
          )}
          <ul className="review-criteria">
            {orderedCriteria(review.criteria).map((c) => (
              <li key={c.requirementIndex} className={c.passed ? "met" : "unmet"}>
                {c.passed ? (
                  <CheckCircle2 className="success-text" size={16} aria-hidden="true" />
                ) : (
                  <AlertCircle className="warning-text" size={16} aria-hidden="true" />
                )}
                <div>
                  <strong>
                    {handoff
                      ? HANDOFF_CRITERIA[c.requirementIndex]
                      : `요구사항 ${c.requirementIndex + 1}`}
                    <span className={`criterion-state ${c.passed ? "met" : "unmet"}`}>
                      {c.passed ? "충족" : "미충족"}
                    </span>
                  </strong>
                  {requirements[c.requirementIndex] && (
                    <p className="review-requirement">{requirements[c.requirementIndex]}</p>
                  )}
                  <p>{c.feedback}</p>
                </div>
              </li>
            ))}
          </ul>
          {review.improvements.length > 0 && (
            <div className="review-improvements">
              <strong>보완할 점</strong>
              <ul>
                {review.improvements.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {review.strengths.length > 0 && (
            <div className="review-strengths">
              <strong>잘한 점</strong>
              <ul>
                {review.strengths.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {handoff && (
            <p>
              <Link href="/handoff?source=sample">과제별 피드백과 복습할 문제 보기 →</Link>
            </p>
          )}
          <Disclosure className="submitted-code">
            <DisclosureSummary>
              제출했던 코드 보기 <span>{dateLabel(selectedAttempt.createdAt)}</span>
            </DisclosureSummary>
            <pre>
              <code>
                {handoff ? formatHandoffDraft(selectedAttempt.code) : selectedAttempt.code}
              </code>
            </pre>
            <Button
              className="secondary-button"
              disabled={busy || selectedAttempt.code === code}
              onClick={() => setConfirm("restore")}
            >
              <History size={15} />이 제출본으로 이어 풀기
            </Button>
          </Disclosure>
        </div>
      ) : (
        <div className="console-idle">
          <span className="mono">
            <span className="success-text">❯</span> 준비되었습니다.
            <span className="blink">_</span>
          </span>
          <p>코드를 작성한 뒤 검토를 요청해 보세요.</p>
          <small>문자열 일치가 아닌 요구사항 충족 여부를 확인합니다.</small>
        </div>
      )}
    </section>
  );
}

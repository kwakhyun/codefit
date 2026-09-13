"use client";
import type { ConfirmationAction } from "@/components/workspace/types";
import type { Dispatch, SetStateAction } from "react";

import { dateLabel } from "@/lib/client-api";
import type { Attempt } from "@/lib/problem";
import { AlertCircle, CheckCircle2, History, LoaderCircle, Terminal } from "lucide-react";
interface ReviewPanelProps {
  busy: boolean;
  selectedAttempt: Attempt | null;
  code: string;
  setConfirm: Dispatch<SetStateAction<ConfirmationAction>>;
}
export function ReviewPanel({ busy, selectedAttempt, code, setConfirm }: ReviewPanelProps) {
  return (
    <section className="review-console" aria-label="AI 검토 결과" aria-live="polite">
      <div className="console-heading">
        <Terminal size={14} />
        <strong>검토 결과</strong>
        <span>AI 코드 리뷰 · 실행 검증 아님</span>
      </div>
      {busy ? (
        <div className="console-idle">
          <span className="mono success-text">$ review --requirements</span>
          <p>
            <LoaderCircle size={15} className="spin" />
            요구사항과 경계 조건을 하나씩 살펴보고 있습니다.
          </p>
          <small>검토 중에도 코드를 수정할 수 있습니다. 제출 시점의 코드로 검토합니다.</small>
        </div>
      ) : selectedAttempt ? (
        <div className="review-result">
          <div className="review-result-title">
            <span className={selectedAttempt.review.passed ? "success-text" : "warning-text"}>
              {selectedAttempt.review.passed ? (
                <CheckCircle2 size={22} />
              ) : (
                <AlertCircle size={22} />
              )}
              <strong>
                {selectedAttempt.review.passed
                  ? "모든 요구사항을 충족했습니다."
                  : "조금 더 다듬어 볼까요?"}
              </strong>
            </span>
            <b>
              {selectedAttempt.review.score}
              <small>%</small>
            </b>
          </div>
          <p>{selectedAttempt.review.summary}</p>
          {selectedAttempt.code !== code && (
            <p className="review-stale">
              <History size={14} /> 현재 코드와 다른 제출본의 검토 결과입니다.
            </p>
          )}
          <ul className="review-criteria">
            {selectedAttempt.review.criteria.map((c) => (
              <li key={c.requirementIndex}>
                {c.passed ? (
                  <CheckCircle2 className="success-text" size={16} />
                ) : (
                  <AlertCircle className="warning-text" size={16} />
                )}
                <div>
                  <strong>요구사항 {c.requirementIndex + 1}</strong>
                  <p>{c.feedback}</p>
                </div>
              </li>
            ))}
          </ul>
          {selectedAttempt.review.improvements.length > 0 && (
            <div className="review-improvements">
              <strong>다음 시도에서</strong>
              <ul>
                {selectedAttempt.review.improvements.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          {selectedAttempt.review.strengths.length > 0 && (
            <div className="review-strengths">
              <strong>잘한 점</strong>
              <ul>
                {selectedAttempt.review.strengths.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}
          <details className="submitted-code">
            <summary>
              제출했던 코드 보기 <span>{dateLabel(selectedAttempt.createdAt)}</span>
            </summary>
            <pre>
              <code>{selectedAttempt.code}</code>
            </pre>
            <button
              className="secondary-button"
              disabled={busy || selectedAttempt.code === code}
              onClick={() => setConfirm("restore")}
            >
              <History size={15} />이 제출본으로 이어 풀기
            </button>
          </details>
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

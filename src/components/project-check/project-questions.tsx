"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { evidenceLabels, type Check } from "@/lib/project-check/types";
function loadDraft(key: string) {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      Array.isArray(value?.answers) &&
      value.answers.length === 5 &&
      value.answers.every((s: unknown) => typeof s === "string" && s.length <= 1500)
    )
      return { answers: value.answers as string[], submitted: value.submitted === true };
  } catch {}
  return { answers: ["", "", "", "", ""], submitted: false };
}
export function ProjectQuestions({
  check,
  scope,
  enabled,
  onReviewed,
}: {
  check: Check;
  scope: string;
  enabled: boolean;
  onReviewed: (review: NonNullable<Check["review"]>) => Promise<void>;
}) {
  const draftKey = `codefit-project:${scope}:${check.id}`;
  const [draft, setDraft] = useState(() => loadDraft(draftKey));
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (check.review) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    }
  }, [check.review, draftKey]);
  function saveDraft(next: typeof draft) {
    setDraft(next);
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      setStorageError(true);
    }
  }
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) heading.current?.focus();
    previousStep.current = step;
  }, [step]);
  const hasReview = Boolean(check.review);
  useEffect(() => {
    if (hasReview) result.current?.focus();
  }, [hasReview]);
  const q = check.analysis.questions[step];
  const answers = check.review?.answers || draft.answers;
  function move(next: number) {
    setStep(next);
  }
  async function submit() {
    setBusy(true);
    setError("");
    saveDraft({ ...draft, submitted: true });
    try {
      const review = await api<NonNullable<Check["review"]>>("/api/project-check", {
        method: "PATCH",
        scope,
        body: { id: check.id, answers: draft.answers },
      });
      await onReviewed(review);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  if (check.review)
    return (
      <section className="project-panel project-results">
        <span className="eyebrow">이번 답변에서 확인한 이해도</span>
        <h2 ref={result} tabIndex={-1}>
          설계 설명 점수 <strong>{check.review.assessment.score}</strong>
          <small> / 100</small>
        </h2>
        <p>{check.review.assessment.summary}</p>
        <p className="project-help">
          서비스 품질이나 보안을 인증하는 점수가 아닙니다. 답변에 드러난 흐름 설명, 선택 이유, 오류
          대응과 검증 계획을 평가했습니다.
        </p>
        <a className="primary-button" href="#training">
          맞춤 실습으로 확인하기 →
        </a>
        <details className="project-feedback-list">
          <summary>질문별 AI 피드백 5개 보기</summary>
          {check.review.assessment.feedback.map((f) => (
            <article key={f.questionIndex} className="project-feedback">
              <header>
                <h3>{check.analysis.questions[f.questionIndex].area}</h3>
                <span>{f.level} / 4단계</span>
              </header>
              <div className="project-score-track" aria-hidden="true">
                <span style={{ width: `${f.level * 25}%` }} />
              </div>
              <p>{check.analysis.questions[f.questionIndex].question}</p>
              <details>
                <summary>내 답변 보기</summary>
                <p className="project-answer">{answers[f.questionIndex] || "답변하지 않음"}</p>
              </details>
              {f.blockingIssue && (
                <div className="project-assessment-issue">
                  <strong>먼저 바로잡을 설명</strong>
                  <p>{f.blockingIssue.explanation}</p>
                  {f.blockingIssue.evidence.map((quote, index) => (
                    <blockquote key={index}>{quote}</blockquote>
                  ))}
                  <p className="project-help">
                    AI가 핵심 설명에 오류나 모순이 있다고 판단해 최대 1단계로 평가했습니다. 실제
                    구현을 검사한 결과는 아니며, 인용문과 해석을 함께 확인해 주세요.
                  </p>
                </div>
              )}
              {f.evidence && (
                <details className="project-assessment-evidence">
                  <summary>평가에 사용한 내 설명 보기</summary>
                  <p className="project-help">
                    인용문은 제출한 답변과 대조했습니다. 기준에 맞는 설명인지는 AI가 판단하므로 잘못
                    해석할 수 있습니다.
                  </p>
                  <dl>
                    {Object.entries(evidenceLabels).map(([key, label]) => (
                      <div key={key}>
                        <dt>{label}</dt>
                        <dd>
                          {f.evidence?.[key as keyof typeof evidenceLabels] ? (
                            <blockquote>
                              {f.evidence[key as keyof typeof evidenceLabels]}
                            </blockquote>
                          ) : (
                            "이번 답변에서 확인하지 못함"
                          )}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </details>
              )}
              <p>{f.feedback}</p>
              <div className="project-next-step">
                <strong>프로젝트에서 확인할 것</strong>
                <p>{f.nextStep}</p>
              </div>
            </article>
          ))}
        </details>
        <details className="project-help">
          <summary>점수는 어떻게 정하나요?</summary>
          <p>
            질문당 0~4단계입니다. 근거 없음 → 기능 식별 → 흐름 설명 → 이유와 실패 상황 → 구체적인
            확인 방법과 대안 비교 순으로 평가하며 각 단계는 5점입니다. 다른 설계 방식도 타당한
            설명이 있으면 인정합니다.
          </p>
          {check.review.assessment.rubricVersion === "evidence-v3" && (
            <p>
              핵심 작동 원리에 해결되지 않은 오류나 모순이 있으면 최대 1단계입니다. 아직 확인하지
              못한 부분, 타당한 검증 계획, 답변 안에서 바로잡은 과거의 오해는 이 제한의 사유가
              아닙니다.
            </p>
          )}
        </details>
      </section>
    );
  return (
    <section className="project-panel project-questions">
      <div className="project-question-top">
        <strong>설계 질문 {step + 1} / 5</strong>
        <span>{answers.filter((a) => a.trim()).length}개 답변 작성</span>
      </div>
      <nav className="project-question-nav" aria-label="설계 질문 이동">
        {check.analysis.questions.map((item, i) => (
          <button
            key={item.area}
            aria-current={i === step ? "step" : undefined}
            onClick={() => move(i)}
          >
            {i + 1}. {item.area}
            {answers[i].trim() ? " ✓" : ""}
          </button>
        ))}
      </nav>
      <h2 ref={heading} tabIndex={-1}>
        {q.question}
      </h2>
      <div className="project-evidence">
        <strong>
          {q.basis === "page"
            ? "공개 페이지에서 확인한 내용"
            : q.basis === "description"
              ? "작성한 설명에서 참고한 내용"
              : "직접 설명이 필요한 내용"}
        </strong>
        <p>{q.evidence}</p>
      </div>
      <label htmlFor="project-answer">내 설계 설명</label>
      <textarea
        id="project-answer"
        rows={7}
        maxLength={1500}
        value={answers[step]}
        readOnly={draft.submitted}
        onChange={(e) =>
          saveDraft({ ...draft, answers: answers.map((a, i) => (i === step ? e.target.value : a)) })
        }
        placeholder="사용자가 행동하면 어떤 일이 순서대로 일어나나요? 그렇게 만든 이유와 확인 방법을 내 말로 적어보세요. 모르는 부분은 모른다고 적어도 괜찮습니다."
        aria-describedby="answer-help"
      />
      <p id="answer-help" className="project-help">
        {answers[step].length} / 1500자 · 모르는 질문은 비워 두고 넘어갈 수 있습니다. 제출 전 답변은
        현재 탭에 보관됩니다.
      </p>
      {storageError && (
        <p role="alert">
          브라우저 보관 공간을 사용할 수 없습니다. 화면을 닫기 전에 답변을 복사해 주세요.
        </p>
      )}
      {draft.submitted && (
        <p className="project-help">
          제출한 답변을 보존했습니다. 오류가 났다면 같은 답변으로 다시 요청하거나 기록을
          새로고침하세요. 분석당 평가는 한 번만 저장됩니다.
        </p>
      )}
      {error && (
        <p role="alert" className="project-error">
          {error}
        </p>
      )}
      <div className="project-question-actions">
        <button
          className="secondary-button"
          disabled={step === 0 || busy}
          onClick={() => move(step - 1)}
        >
          이전 질문
        </button>
        {step < 4 ? (
          <button className="primary-button" onClick={() => move(step + 1)}>
            다음 질문 →
          </button>
        ) : (
          <button
            className="primary-button"
            disabled={busy || !enabled || !answers.some((a) => a.trim())}
            onClick={submit}
          >
            {busy
              ? "답변을 검토하고 있습니다…"
              : draft.submitted
                ? "같은 답변으로 다시 요청"
                : "이 답변으로 이해도 확인"}
          </button>
        )}
      </div>
      <p className="project-help">
        AI 평가를 요청하면 이용 횟수 1회가 차감됩니다. 제출 이후에는 답변을 수정할 수 없습니다.{" "}
        {busy ? "검토 중에도 다른 질문과 작성한 답변을 살펴볼 수 있습니다." : ""}
      </p>
    </section>
  );
}

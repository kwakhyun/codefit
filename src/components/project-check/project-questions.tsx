"use client";
import { ProjectCodeDialogue } from "./project-dialogue";
import { SourceEvidence } from "./project-repository";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import {
  Card,
  Anchor,
  Disclosure,
  DisclosureSummary,
  Button,
  FieldLabel,
  Textarea,
  Status,
} from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { dateLabel } from "@/lib/client-api";
import { runGeneration } from "@/lib/generation-activity";
import { VoiceInput } from "@/components/ui/voice-input";
import { evidenceLabels, type Check, type CheckOverview } from "@/lib/project-check/types";
import { assessmentLevels } from "@/lib/project-check/display";
import {
  pollReview,
  readReviewStatus,
  requestReview,
  ReviewOutcomeError,
  type ReviewOutcome,
} from "@/lib/project-check/review-request";
import { RequestStatus } from "./request-status";
import { AllowanceCost } from "./allowance-cost";
/**
 * editing: free to edit. pending: the server accepted the evaluation (locked, polling resumes
 * after a reload). unknown: the response was lost (locked until the status is read).
 * failed: the server reported a failure (editable; the same or edited answers can be sent).
 */
type ReviewState = "editing" | "pending" | "unknown" | "failed";
type Draft = { answers: string[]; step: number; status: ReviewState; message?: string };
function loadDraft(key: string, previous?: string[]): Draft {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      Array.isArray(value?.answers) &&
      value.answers.length === 5 &&
      value.answers.every((s: unknown) => typeof s === "string" && s.length <= 1500)
    )
      return {
        answers: value.answers as string[],
        // Drafts saved before background evaluation only knew "submitted".
        status: ["editing", "pending", "unknown", "failed"].includes(value.status)
          ? (value.status as ReviewState)
          : value.submitted === true
            ? "unknown"
            : "editing",
        ...(typeof value.message === "string" ? { message: value.message.slice(0, 500) } : {}),
        step:
          Number.isInteger(value.step) && value.step >= 0 && value.step < 5
            ? (value.step as number)
            : 0,
      };
  } catch {}
  return { answers: previous || ["", "", "", "", ""], status: "editing", step: 0 };
}
export function ProjectQuestions({
  check,
  scope,
  aiReady,
  review: usage,
  onReviewed,
  onUsage,
}: {
  check: Check;
  scope: string;
  aiReady: boolean;
  review: CheckOverview["usage"]["review"];
  onUsage?: () => Promise<void>;
  onReviewed: (review: NonNullable<Check["review"]>) => Promise<void>;
}) {
  const draftKey = `codefit-project:${scope}:${check.id}`;
  const [draft, setDraft] = useState(() => loadDraft(draftKey, check.previousReview?.answers));
  const currentDraft = useRef(draft);
  const { step } = draft;
  const fade = useFadeTransition<HTMLElement>(`${check.id}:${step}:${Boolean(check.review)}`);
  // Only the request that hands the answers to the server cannot survive leaving the page.
  const [requesting, setRequesting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState("");
  const active = useRef(false);
  const alive = useRef(true);
  const [storageError, setStorageError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const result = useRef<HTMLHeadingElement>(null);
  const answerField = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (check.review) {
      try {
        sessionStorage.removeItem(draftKey);
      } catch {}
    }
  }, [check.review, draftKey]);
  function saveDraft(change: (value: Draft) => Draft) {
    const next = change(currentDraft.current);
    currentDraft.current = next;
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
  const locked = draft.status === "pending" || draft.status === "unknown";
  function move(next: number) {
    saveDraft((value) => ({ ...value, step: next }));
  }
  async function settle(outcome: ReviewOutcome) {
    if (!alive.current) return;
    if (outcome.state === "done") {
      saveDraft((value) => ({ ...value, status: "editing", message: undefined }));
      await onReviewed(outcome.review);
      return;
    }
    if (outcome.state === "pending") {
      saveDraft((value) => ({ ...value, status: "pending", message: undefined }));
      follow();
      return;
    }
    saveDraft((value) => ({ ...value, status: outcome.state, message: outcome.message }));
    // A provider rejection may have returned the unit; show the current count either way.
    await onUsage?.().catch(() => {});
  }
  /** Polls in the background; the global activity keeps showing it on other screens. */
  function follow() {
    setWaiting(true);
    runGeneration(
      {
        id: `review:${check.id}`,
        scope,
        label: "답변 평가",
        href: `/project-check?check=${check.id}`,
      },
      async () => {
        const outcome = await pollReview(check.id, scope);
        if (outcome.state !== "done") throw new ReviewOutcomeError(outcome);
        return outcome;
      },
    )
      .then((outcome) => settle(outcome))
      .catch((error) =>
        settle(
          error instanceof ReviewOutcomeError
            ? error.outcome
            : { state: "unknown", message: String(error?.message || "") },
        ),
      )
      .finally(() => {
        if (alive.current) setWaiting(false);
      });
  }
  const resumed = useRef(false);
  useEffect(() => {
    // A reload during evaluation resumes reading its status instead of losing the result.
    if (resumed.current || check.review || currentDraft.current.status !== "pending") return;
    resumed.current = true;
    follow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [check.review]);
  async function recheck() {
    if (active.current) return;
    active.current = true;
    setChecking(true);
    setNotice("");
    try {
      const outcome = await readReviewStatus(check.id, scope);
      if (!outcome)
        setNotice("상태를 읽지 못했습니다. 연결을 확인한 뒤 다시 눌러 주세요. 답변은 보관됩니다.");
      else await settle(outcome);
    } finally {
      active.current = false;
      if (alive.current) setChecking(false);
    }
  }
  async function submit() {
    if (active.current) return;
    active.current = true;
    setRequesting(true);
    setNotice("");
    const sent = currentDraft.current.answers;
    // Lock first: until the server answers, the outcome of this paid request is unknown.
    saveDraft((value) => ({ ...value, status: "unknown", message: undefined }));
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    let outcome: ReviewOutcome;
    try {
      outcome = await requestReview(check.id, sent, scope);
    } finally {
      window.removeEventListener("beforeunload", warn);
      active.current = false;
      if (alive.current) setRequesting(false);
    }
    await settle(outcome);
  }
  if (check.review)
    return (
      <Card
        ref={fade}
        as="section"
        id="project-question-workspace"
        className="project-panel project-results"
      >
        <span className="eyebrow">이번 답변에서 확인한 이해도</span>
        <h2 ref={result} tabIndex={-1}>
          설계 설명 점수 <strong>{check.review.assessment.score}</strong>
          <small> / 100</small>
        </h2>
        <p className="analysis-lead">{check.review.assessment.summary}</p>
        <div className="review-area-grid" aria-label="영역별 설명 수준">
          {check.review.assessment.feedback.map((item) => (
            <div key={item.questionIndex}>
              <span>{check.analysis.questions[item.questionIndex].area}</span>
              <strong>{assessmentLevels[item.level]}</strong>
              <small>{item.level} / 4단계</small>
            </div>
          ))}
        </div>
        {check.previousReview && (
          <div className="project-next-step">
            <strong>
              바로 이전 답변 {check.previousReview.assessment.score}점 → 이번 보완 답변{" "}
              {check.review.assessment.score}점
            </strong>
            <p className="project-help">
              모든 차수의 점수는 위의 보완 답변 기록에서 비교할 수 있습니다. AI 판단은 달라질 수
              있으며 점수 변화가 실제 기능 개선을 증명하지는 않습니다.
            </p>
          </div>
        )}
        <p className="project-help">
          서비스 품질이나 보안을 인증하는 점수가 아닙니다. 답변에 드러난 흐름 설명, 선택 이유, 오류
          대응과 검증 계획을 평가했습니다.
        </p>
        <Anchor className="primary-button" href="#project-follow-up">
          내 프로젝트에서 확인하고 보완하기 →
        </Anchor>
        <Disclosure className="project-feedback-list" open>
          <DisclosureSummary>질문별 AI 피드백 5개 보기</DisclosureSummary>
          {check.review.assessment.feedback.map((f) => (
            <Disclosure
              key={f.questionIndex}
              className="project-feedback project-feedback-item"
              open={f.level < 3}
            >
              <DisclosureSummary>
                <strong>{check.analysis.questions[f.questionIndex].area}</strong>
                <span>{f.level} / 4단계</span>
              </DisclosureSummary>
              <div className="project-score-track" aria-hidden="true">
                <span style={{ width: `${f.level * 25}%` }} />
              </div>
              <p>{check.analysis.questions[f.questionIndex].question}</p>
              <Disclosure>
                <DisclosureSummary>내 답변 보기</DisclosureSummary>
                <p className="project-answer">{answers[f.questionIndex] || "답변하지 않음"}</p>
              </Disclosure>
              {check.previousReview && (
                <Disclosure>
                  <DisclosureSummary>이전 답변과 비교</DisclosureSummary>
                  <p>
                    이전{" "}
                    {check.previousReview.assessment.feedback.find(
                      (p) => p.questionIndex === f.questionIndex,
                    )?.level ?? 0}{" "}
                    / 4단계 → 현재 {f.level} / 4단계
                  </p>
                  <strong>이전 설명</strong>
                  <p className="project-answer">
                    {check.previousReview.answers[f.questionIndex] || "답변하지 않음"}
                  </p>
                  <strong>이전 피드백</strong>
                  <p>
                    {
                      check.previousReview.assessment.feedback.find(
                        (p) => p.questionIndex === f.questionIndex,
                      )?.feedback
                    }
                  </p>
                  {f.evidence &&
                    check.previousReview.assessment.feedback.find(
                      (p) => p.questionIndex === f.questionIndex,
                    )?.evidence && (
                      <p>
                        새로 근거가 확인된 항목:{" "}
                        {Object.entries(evidenceLabels)
                          .filter(
                            ([key]) =>
                              f.evidence?.[key as keyof typeof evidenceLabels] &&
                              !check.previousReview?.assessment.feedback.find(
                                (p) => p.questionIndex === f.questionIndex,
                              )?.evidence?.[key as keyof typeof evidenceLabels],
                          )
                          .map(([, label]) => label)
                          .join(", ") || "없음"}
                      </p>
                    )}
                </Disclosure>
              )}
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
                <Disclosure className="project-assessment-evidence">
                  <DisclosureSummary>평가에 사용한 내 설명 보기</DisclosureSummary>
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
                </Disclosure>
              )}
              <p>{f.feedback}</p>
              {check.page.repository && (
                <ProjectCodeDialogue
                  check={check}
                  index={f.questionIndex}
                  answer={answers[f.questionIndex]}
                  scope={scope}
                  enabled={false}
                  readOnly
                />
              )}
              <div className="project-next-step">
                <strong>프로젝트에서 확인할 것</strong>
                <p>{f.nextStep}</p>
              </div>
            </Disclosure>
          ))}
        </Disclosure>
        <Disclosure className="project-help">
          <DisclosureSummary>점수는 어떻게 정하나요?</DisclosureSummary>
          <p>
            질문당 0~4단계입니다.{" "}
            {assessmentLevels.map((label, i) => `${i}단계 ${label}`).join(" → ")} 순으로 평가하며 각
            단계는 5점입니다. 다른 설계 방식도 타당한 설명이 있으면 인정합니다.
          </p>
          {check.review.assessment.rubricVersion === "evidence-v3" && (
            <p>
              핵심 작동 원리에 해결되지 않은 오류나 모순이 있으면 최대 1단계입니다. 아직 확인하지
              못한 부분, 타당한 검증 계획, 답변 안에서 바로잡은 과거의 오해는 이 제한의 사유가
              아닙니다.
            </p>
          )}
        </Disclosure>
      </Card>
    );
  const unavailable = !aiReady
    ? "지금은 AI 평가를 요청할 수 없습니다. 작성한 답변은 이 탭에 보관됩니다."
    : usage.remaining < 1
      ? `평가 횟수를 모두 사용했습니다. ${usage.resetsAt ? `${dateLabel(usage.resetsAt)}에 다시 채워집니다.` : "첫 사용부터 24시간이 지나면 다시 채워집니다."}`
      : "";
  const submitBlocked =
    requesting || locked
      ? "locked"
      : unavailable ||
        (!answers.some((a) => a.trim())
          ? "한 질문 이상 답변하거나 모르는 이유를 적어 주세요."
          : "");
  return (
    <Card
      ref={fade}
      as="section"
      id="project-question-workspace"
      className="project-panel project-questions"
    >
      {check.previousReview && (
        <p className="project-next-step">
          보완 답변 {check.revisionNumber}차입니다. 이전 답변을 불러왔습니다. 확인한 내용과 아직
          모르는 부분을 구분해 수정하세요. 질문과 이전 화면 자료는 그대로 사용합니다.
        </p>
      )}
      <div className="project-question-top">
        <strong>설계 질문 {step + 1} / 5</strong>
        <span>{answers.filter((a) => a.trim()).length}개 답변 작성</span>
      </div>
      <nav className="project-question-nav" aria-label="설계 질문 이동">
        {check.analysis.questions.map((item, i) => (
          <Button
            key={item.area}
            aria-current={i === step ? "step" : undefined}
            onClick={() => move(i)}
          >
            {i + 1}. {item.area}
            {answers[i].trim() ? " ✓" : ""}
          </Button>
        ))}
      </nav>
      <h2 ref={heading} tabIndex={-1}>
        {q.question}
      </h2>
      {q.learning && (
        <div className="question-learning-goal">
          <strong>이 질문으로 확인할 것</strong>
          <p>{q.learning.goal}</p>
        </div>
      )}
      <div className="question-study-layout">
        <aside className="question-context" aria-label="질문을 이해하는 자료">
          {q.learning && (
            <section>
              <h3>생각해 볼 상황</h3>
              <p>{q.learning.situation}</p>
            </section>
          )}
          <div className="project-evidence">
            <strong>
              {q.basis === "page"
                ? check.page.source === "repository"
                  ? "수집한 코드에서 확인한 근거"
                  : check.page.source === "rendered"
                    ? "로그인 없이 렌더링한 화면 본문"
                    : check.page.source === "metadata"
                      ? "사이트가 등록한 공개 소개 정보"
                      : "HTML에서 추출한 문구 (화면 표시 여부 미확인)"
                : q.basis === "description"
                  ? "작성한 설명에서 참고한 내용"
                  : "직접 설명이 필요한 내용"}
            </strong>
            {!(check.page.repository && q.basis === "page") && <p>{q.evidence}</p>}
            {check.page.repository && q.basis === "page" && (
              <SourceEvidence repository={check.page.repository} evidence={q.evidence} />
            )}
          </div>
          {!!q.learning?.terms.length && (
            <section className="question-terms">
              <h3>먼저 알아둘 말</h3>
              <dl>
                {q.learning.terms.map(({ term, meaning }) => (
                  <div key={term}>
                    <dt>{term}</dt>
                    <dd>{meaning}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </aside>
        <div className="question-writing">
          <section className="question-writing-guide">
            <h3>이 순서로 정리해 보세요</h3>
            <ol>
              {(
                q.learning?.prompts ?? [
                  "사용자의 행동 뒤에 어떤 처리가 이어지는지 적어보세요.",
                  "그렇게 동작한다고 생각한 근거와 아직 확인하지 못한 내용을 나누어 적어보세요.",
                  "어떤 결과를 관찰하면 내 설명을 확인할 수 있을지 적어보세요.",
                ]
              ).map((prompt, i) => (
                <li key={i}>{prompt}</li>
              ))}
            </ol>
          </section>
          <FieldLabel htmlFor="project-answer">내 설계 설명</FieldLabel>
          <Textarea
            ref={answerField}
            id="project-answer"
            rows={7}
            maxLength={1500}
            value={answers[step]}
            readOnly={locked || requesting}
            onChange={(e) =>
              saveDraft((value) => ({
                ...value,
                // Editing after a reported failure starts a new submission.
                status: value.status === "failed" ? "editing" : value.status,
                answers: value.answers.map((a, i) => (i === step ? e.target.value : a)),
              }))
            }
            placeholder="사용자가 행동하면 어떤 일이 순서대로 일어나나요? 그렇게 만든 이유와 확인 방법을 내 말로 적어보세요. 모르는 부분은 모른다고 적어도 괜찮습니다."
            aria-describedby="answer-help"
          />
          <VoiceInput
            key={`${check.id}:${step}`}
            targetId="project-answer"
            disabled={locked || requesting}
            onTranscript={(text) =>
              saveDraft((value) => ({
                ...value,
                status: value.status === "failed" ? "editing" : value.status,
                answers: value.answers.map((answer, i) =>
                  i === step ? `${answer}${answer ? " " : ""}${text}`.slice(0, 1500) : answer,
                ),
              }))
            }
          />
          <p id="answer-help" className="project-help">
            {answers[step].length} / 1500자 · 모르는 질문은 비워 두고 넘어갈 수 있습니다.{" "}
            {locked
              ? "평가 결과를 확인할 때까지 답변을 고정합니다."
              : "제출 전 답변은 현재 탭에 보관됩니다."}
          </p>
          {check.page.repository && (
            <ProjectCodeDialogue
              key={`dialogue:${check.id}:${step}`}
              check={check}
              index={step}
              answer={answers[step]}
              scope={scope}
              enabled={aiReady && usage.remaining > 0}
              disabledReason={unavailable}
              onUsage={onUsage}
              remaining={usage.remaining}
            />
          )}
        </div>
      </div>
      {storageError && (
        <Status role="alert">
          브라우저 보관 공간을 사용할 수 없습니다. 화면을 닫기 전에 답변을 복사해 주세요.
        </Status>
      )}
      {locked && !requesting && (
        <div className="project-recovery" role="group" aria-label="평가 진행 상태">
          <p className="project-help">
            {draft.status === "pending"
              ? "평가가 접수되어 처리 중입니다. 화면을 새로고침하거나 다른 화면으로 이동해도 결과를 이어서 확인합니다."
              : draft.message ||
                "평가 요청의 응답을 받지 못했습니다. 서버에서 처리 중일 수 있으니 상태를 먼저 확인해 주세요."}
          </p>
          {draft.status === "unknown" && (
            <Button
              type="button"
              className="secondary-button"
              disabled={checking}
              onClick={() => void recheck()}
            >
              {checking ? "평가 상태 확인 중…" : "평가 상태 다시 확인"}
            </Button>
          )}
          <p className="project-help">
            상태 확인은 AI를 다시 호출하거나 이용 횟수를 차감하지 않습니다. 분석당 평가는 한 번만
            저장됩니다.
          </p>
        </div>
      )}
      {draft.status === "failed" && (
        <div className="project-recovery" role="alert">
          <strong>평가를 완료하지 못했습니다</strong>
          <p>{draft.message}</p>
          <p className="project-help">
            답변을 수정해 다시 요청하거나 같은 답변으로 다시 요청할 수 있습니다.
          </p>
          <Button
            type="button"
            className="secondary-button"
            onClick={() => {
              saveDraft((value) => ({ ...value, status: "editing", message: undefined }));
              answerField.current?.focus();
            }}
          >
            답변 수정하기
          </Button>
        </div>
      )}
      {notice && <Status role="status">{notice}</Status>}
      {(requesting || (waiting && draft.status === "pending")) && (
        <RequestStatus
          label={
            requesting
              ? "답변을 서버에 전달하고 있습니다. 이 단계가 끝날 때까지 화면을 닫지 마세요"
              : "작성한 설명을 바탕으로 피드백을 준비하고 있습니다"
          }
        />
      )}
      <div className="project-question-actions">
        <Button className="secondary-button" disabled={step === 0} onClick={() => move(step - 1)}>
          이전 질문
        </Button>
        {step < 4 ? (
          <Button className="primary-button" onClick={() => move(step + 1)}>
            다음 질문 →
          </Button>
        ) : (
          <Button
            className="primary-button"
            disabled={!!submitBlocked}
            aria-describedby="review-submit-cost review-submit-reason"
            onClick={() => void submit()}
          >
            {requesting || draft.status === "pending"
              ? "답변을 검토하고 있습니다…"
              : draft.status === "failed"
                ? "다시 평가 요청"
                : "이 답변으로 이해도 확인"}
          </Button>
        )}
      </div>
      {step === 4 && (
        <>
          <AllowanceCost
            id="review-submit-cost"
            label="평가 횟수"
            cost={1}
            remaining={usage.remaining}
            resetsAt={usage.resetsAt}
          />
          <p id="review-submit-reason" className="project-help">
            {submitBlocked && submitBlocked !== "locked" ? submitBlocked : ""}
          </p>
        </>
      )}
      <p className="project-help">
        제출한 답변은 보관되며, 평가 후 같은 질문에 보완 답변을 추가할 수 있습니다.
        {locked ? " 평가 중에도 다른 질문과 작성한 답변을 살펴볼 수 있습니다." : ""}
      </p>
    </Card>
  );
}

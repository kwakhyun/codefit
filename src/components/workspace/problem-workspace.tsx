"use client";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import {
  Button,
  Card,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Textarea,
  Status,
} from "@/components/ui/primitives";

import { HandoffExport } from "@/components/handoff/handoff-export";
import { HandoffFields, HandoffGuide } from "@/components/handoff/handoff-fields";
import { LearningLab, LabTests } from "@/components/handoff/learning-lab";
import { useLearningLab } from "@/hooks/use-learning-lab";
import { HANDOFF_TRACKS, handoffId } from "@/lib/handoff/catalog";
import { problemUrl } from "@/lib/library-state";
import { HandoffReadiness, focusHandoffField } from "@/components/handoff/handoff-readiness";
import {
  type HandoffField,
  missingHandoffFields,
  handoffMissingMessage,
  readHandoffDraft,
  writeHandoffDraft,
  formatHandoffDraft,
} from "@/lib/handoff/draft";
import { DraftConflict } from "./draft-conflict";
import { SaveStatus } from "./save-status";
import { CodingChecks } from "./coding-checks";
import {
  MobileActionBar,
  MobilePaneTabs,
  RetryFeedback,
  type MobilePane,
} from "./mobile-workbench";
import { ReviewAction } from "./review-action";
import { ProblemMaterials } from "@/components/workspace/problem-materials";
import { ReviewPanel } from "@/components/workspace/review-panel";
import { WorkspaceConfirmation } from "@/components/workspace/workspace-confirmation";
import { useProblemController } from "@/hooks/use-problem-controller";
import { useExampleTests } from "@/hooks/use-example-tests";
import { exampleTestsFor } from "@/lib/example-tests";
import { reviewResetLabel } from "@/lib/review-quota";
import { allowanceWindow } from "@/lib/ai-access";

import { DifficultyBadge, KindBadge } from "@/components/ui/problem-badges";
import { domainLabel, LANGUAGES } from "@/lib/catalog";
import type { Attempt, Progress, ProblemDetail } from "@/lib/problem";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  ChevronRight,
  CircleCheck,
  EyeOff,
  Clock3,
  ListChecks,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
} from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import { AppLink as Link } from "@/components/ui/primitives";
const CodeEditor = dynamic(() => import("@/components/code-editor").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <ScreenSkeleton variant="code" label="코드 편집기 준비 중…" />
    </div>
  ),
});
export function ProblemWorkspace({
  id,
  scope,
  onProgress,
  fontSize,
  focus,
  setFocus,
  aiReady,
  returnTo = "/",
  initialAttemptId,
  initialDetail,
}: {
  id: string;
  scope: string;
  onProgress: (p: Progress, attempt?: Attempt) => void;
  fontSize: number;
  focus: boolean;
  setFocus: (value: boolean) => void;
  aiReady: boolean;
  returnTo?: string;
  initialAttemptId?: string;
  initialDetail?: ProblemDetail;
}) {
  const [editorFocusRequest, setEditorFocusRequest] = useState(0);
  const [missingField, setMissingField] = useState<HandoffField | null>(null);
  const {
    detail,
    code,
    tab,
    setTab,
    error,
    setError,
    loadError,
    setLoadError,
    missing,
    loading,
    setLoading,
    saveState,
    draftStatus,
    localSaved,
    resolveConflict,
    recoverable,
    orphan,
    loadOrphan,
    discardDraft,
    busy,
    reviewsLeft,
    reviewsResetAt,
    updateCheck,
    hiding,
    toggleHidden,
    revealing,
    confirm,
    setConfirm,
    selectedAttempt,
    setSelectedAttempt,
    undoCode,
    setUndoCode,
    notice,
    setNotice,
    bookmarkBusy,
    copied,
    setCopied,
    load,
    changeCode,
    review,
    reveal,
    bookmark,
    replaceCode,
    saveNow,
  } = useProblemController({ id, scope, onProgress, aiReady, initialAttemptId, initialDetail });
  const learningEnabled = Boolean(
    detail?.problem.handoff &&
    HANDOFF_TRACKS.some((t) => id === handoffId(t.key) || id === handoffId(t.key, true)),
  );
  const labControl = useLearningLab({
    id,
    scope,
    enabled: learningEnabled,
    value: code,
    starterCode: detail?.problem.starterCode ?? "",
    onChange: changeCode,
    initialStage: initialAttemptId ? 3 : 0,
  });
  const tests = detail ? exampleTestsFor(detail.problem) : null;
  const exampleTests = useExampleTests({
    problemId: id,
    scope,
    language: detail?.problem.language ?? "javascript",
    tests,
    code,
    onRecorded: updateCheck,
  });
  // Phone-width coding problems switch between 문제 / 코드 / 결과; other layouts ignore it.
  const [mobilePane, setMobilePane] = useState<MobilePane>(initialAttemptId ? "result" : "problem");
  const [retryAttempt, setRetryAttempt] = useState<Attempt | null>(null);
  const [undoHide, setUndoHide] = useState(false);
  if (loading) return <ScreenSkeleton variant="editor" label="문제와 저장된 풀이를 불러오는 중" />;
  if (missing)
    return (
      <div className="empty-state">
        <AlertCircle size={32} />
        <h2>문제를 찾을 수 없습니다.</h2>
        <p>주소가 잘못되었거나 더 이상 제공하지 않는 문제입니다.</p>
        <Link className="secondary-button" href={returnTo}>
          <ArrowLeft size={16} />
          {returnTo.startsWith("/handoff") ? "AI 코드 이해 훈련으로" : "분야별 코딩 연습으로"}
        </Link>
      </div>
    );
  if (loadError || !detail)
    return (
      <div className="empty-state">
        <AlertCircle size={32} />
        <h2>문제를 불러오지 못했습니다.</h2>
        <p>{loadError}</p>
        <Button
          className="secondary-button"
          onClick={() => {
            setLoading(true);
            setLoadError("");
            void load();
          }}
        >
          다시 시도
        </Button>
        <Link href={returnTo}>
          {returnTo.startsWith("/handoff") ? "AI 코드 이해 훈련으로" : "분야별 코딩 연습으로"}
        </Link>
      </div>
    );
  const { problem, hints, solution, attempts, progress } = detail;
  const archived = recoverable.filter((draft) => draft.key !== orphan?.key);
  const handoffDraft = problem.handoff ? readHandoffDraft(code) : null;
  const inputError =
    missingField && handoffDraft && missingHandoffFields(handoffDraft.notes).includes(missingField)
      ? handoffMissingMessage([missingField])
      : "";
  function requestReview(value: string) {
    if (learningEnabled) labControl.setStage(3);
    if (problem.handoff) {
      const draft = readHandoffDraft(value);
      const missing = missingHandoffFields(draft.notes)[0];
      if (missing) {
        setMissingField(missing);
        if (learningEnabled) labControl.setStage(3);
        requestAnimationFrame(() => focusHandoffField(missing.key));
        return;
      }
    }
    if (aiReady && reviewsLeft === 0) {
      const reset = reviewResetLabel(reviewsResetAt);
      setError(
        `AI 검토 횟수를 모두 사용했습니다. ${reset ? `${reset} 이후` : `첫 검토부터 ${allowanceWindow("review")}이 지나면`} 다시 검토할 수 있어요.`,
      );
      return;
    }
    setMissingField(null);
    setRetryAttempt(null);
    void review(value, problem.handoff ? undefined : exampleTests.summaryFor(value));
  }
  const coding = !problem.handoff;
  const reviewBlocked =
    busy ||
    code.trim().length < 5 ||
    !aiReady ||
    saveState === "conflict" ||
    saveState === "resolving";
  function retry(attempt: Attempt) {
    setRetryAttempt(attempt);
    setMobilePane("code");
    setEditorFocusRequest((n) => n + 1);
  }
  return (
    <div className={`workspace ${focus ? "is-focused" : ""}`}>
      <div className="workspace-breadcrumb">
        <Link href={returnTo}>
          <ArrowLeft size={15} />{" "}
          {returnTo.startsWith("/handoff") ? "AI 코드 이해 훈련" : "분야별 코딩 연습"}
        </Link>
        <ChevronRight size={13} />
        <span>{domainLabel(problem.domain)}</span>
        <span className="workspace-id mono">
          {problem.source === "ai" ? "AI 생성 문제" : "기본 문제"}
        </span>
      </div>
      <div className="workspace-heading">
        <div>
          <div className="problem-meta">
            <DifficultyBadge level={problem.difficulty} />
            <KindBadge kind={problem.kind} />
            <span>{LANGUAGES[problem.language].label}</span>
            <span>
              <Clock3 size={13} /> 약 {problem.minutes}분
            </span>
            {progress?.status === "solved" ? (
              <span className="problem-check solved">
                <CircleCheck size={13} aria-hidden="true" /> 해결
              </span>
            ) : detail.check ? (
              <span className="problem-check">
                <ListChecks size={13} aria-hidden="true" />
                {detail.check.kind === "tests" ? "예시 테스트 통과" : "직접 확인함"}
              </span>
            ) : null}
          </div>
          <h1>{problem.title}</h1>
          {problem.source === "ai" && (
            <p className="ai-problem-note">
              학습자 요청으로 AI가 만든 공개 문제입니다. 기본 문제와 달리 별도 검수를 거치지
              않았습니다. 내용이 이상하면 오른쪽 숨기기 버튼으로 내 목록에서 뺄 수 있습니다.
            </p>
          )}
        </div>
        <div className="workspace-heading-actions">
          {problem.source === "ai" && (
            <Button
              className={`icon-button ${detail.hidden ? "active" : ""}`}
              aria-label={detail.hidden ? "내 목록에 다시 표시" : "내 목록에서 숨기기"}
              aria-pressed={Boolean(detail.hidden)}
              title="AI 생성 문제를 내 문제 목록에서 숨깁니다. 다른 학습자에게는 계속 보입니다."
              onClick={async () => {
                const hide = !detail.hidden;
                if (await toggleHidden()) setUndoHide(hide);
              }}
              disabled={hiding}
            >
              <EyeOff size={20} />
            </Button>
          )}
          <Button
            className={`icon-button ${progress?.bookmarked ? "active" : ""}`}
            aria-label={progress?.bookmarked ? "북마크 해제" : "북마크"}
            onClick={bookmark}
            disabled={bookmarkBusy}
          >
            <Bookmark size={20} fill={progress?.bookmarked ? "currentColor" : "none"} />
          </Button>
          <Button
            className="icon-button"
            aria-label={focus ? "집중 모드 종료" : "집중 모드"}
            onClick={() => setFocus(!focus)}
          >
            {focus ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </Button>
        </div>
      </div>
      {notice && (
        <Card as="div" className="draft-notice" role="status">
          <Save size={15} />
          <span>{notice}</span>
          {undoHide && detail.hidden && (
            <Button
              className="text-button"
              onClick={async () => {
                if (await toggleHidden()) setUndoHide(false);
              }}
              disabled={hiding}
            >
              되돌리기
            </Button>
          )}
          {undoCode !== null && (
            <Button
              className="text-button"
              onClick={() => {
                changeCode(undoCode);
                setUndoCode(null);
                setNotice("변경 전 코드로 되돌렸습니다.");
              }}
            >
              변경 취소
            </Button>
          )}
          <Button className="icon-button" aria-label="안내 닫기" onClick={() => setNotice("")}>
            ×
          </Button>
        </Card>
      )}
      {orphan && (
        <Card as="div" className="draft-notice" role="status">
          <Save size={15} />
          <span>
            닫은 창에 저장하지 않은 초안이 남아 있습니다. 불러오면 편집기의 코드를 바꾸며, 변경
            취소로 되돌릴 수 있습니다.
          </span>
          <Button className="text-button" onClick={loadOrphan}>
            불러오기
          </Button>
          <Button className="text-button" onClick={() => discardDraft(orphan.key)}>
            버리기
          </Button>
        </Card>
      )}
      {learningEnabled ? (
        <LearningLab
          problemId={id}
          controller={labControl}
          starterCode={problem.starterCode}
          aiReady={aiReady}
          blocked={saveState === "conflict" || saveState === "resolving"}
        />
      ) : problem.handoff ? (
        <HandoffGuide starterCode={problem.starterCode} />
      ) : null}
      {coding && (
        <MobilePaneTabs pane={mobilePane} onChange={setMobilePane} resultCount={attempts.length} />
      )}
      <div
        className={`workbench ${learningEnabled ? `lab-workbench lab-stage-${labControl.stage}` : ""} ${coding ? "mobile-tabs" : ""}`}
        data-pane={coding ? mobilePane : undefined}
      >
        <ProblemMaterials
          tab={tab}
          setTab={setTab}
          hints={hints}
          attempts={attempts}
          problem={problem}
          revealing={revealing}
          reveal={reveal}
          solution={solution}
          setConfirm={setConfirm}
          setCopied={setCopied}
          setError={setError}
          copied={copied}
          selectedAttempt={selectedAttempt}
          setSelectedAttempt={(next) => {
            setSelectedAttempt(next);
            if (learningEnabled) labControl.setStage(3);
          }}
        />
        <section className="editor-pane" aria-label="풀이 작업 공간">
          <div className="editor-topbar">
            <span>코드 작성</span>
            <div>
              <SaveStatus state={saveState} localSaved={localSaved} />
              {(saveState === "failed" || saveState === "local" || saveState === "offline") && (
                <Button className="text-button" onClick={() => void saveNow()}>
                  지금 저장
                </Button>
              )}
              <Button
                className="icon-button"
                aria-label="시작 코드로 초기화"
                onClick={() => setConfirm("reset")}
                disabled={busy}
              >
                <RotateCcw size={14} />
              </Button>
            </div>
          </div>
          <DraftConflict
            handoff={Boolean(problem.handoff)}
            status={draftStatus}
            localSaved={localSaved}
            code={code}
            onChange={changeCode}
            onResolve={resolveConflict}
            onResolvedFocus={
              learningEnabled
                ? () => {
                    labControl.setStage(2, false);
                    setEditorFocusRequest((n) => n + 1);
                  }
                : undefined
            }
          />
          {archived.length > 0 && (
            <Disclosure className="draft-recovery">
              <DisclosureSummary>다른 창에서 보관한 초안 {archived.length}개</DisclosureSummary>
              <p>
                필요한 코드를 복사해 현재 초안에 합칠 수 있습니다. 원본은 삭제하기 전까지
                보관됩니다.
              </p>
              {archived.map((draft, index) => (
                <div key={draft.key}>
                  <FieldLabel>
                    보관한 초안 {index + 1}
                    {draft.live && " · 다른 창에서 편집 중"}
                    <Textarea
                      aria-label={`보관한 초안 ${index + 1}`}
                      value={
                        problem.handoff ? formatHandoffDraft(draft.record.code) : draft.record.code
                      }
                      readOnly
                    />
                  </FieldLabel>
                  {!draft.live && (
                    <Button
                      className="text-button"
                      aria-label={`보관한 초안 ${index + 1} 삭제`}
                      onClick={() => discardDraft(draft.key)}
                    >
                      삭제
                    </Button>
                  )}
                </div>
              ))}
            </Disclosure>
          )}
          {problem.handoff && !learningEnabled && (
            <HandoffFields value={code} onChange={changeCode} section="before" />
          )}
          <div className="workspace-code-section" id="workspace-code">
            {coding && retryAttempt && (
              <RetryFeedback
                attempt={retryAttempt}
                requirements={problem.requirements}
                onClose={() => setRetryAttempt(null)}
              />
            )}
            {(!learningEnabled || labControl.editorSeen) && (
              <CodeEditor
                focusRequest={
                  learningEnabled
                    ? labControl.stage === 2
                      ? editorFocusRequest
                      : 0
                    : editorFocusRequest
                }
                value={handoffDraft?.implementation ?? code}
                language={problem.language}
                problemId={id}
                onChange={(value) =>
                  changeCode(
                    handoffDraft
                      ? writeHandoffDraft(value, handoffDraft.notes, handoffDraft.training)
                      : value,
                  )
                }
                onCheck={(value) =>
                  requestReview(
                    handoffDraft
                      ? writeHandoffDraft(value, handoffDraft.notes, handoffDraft.training)
                      : value,
                  )
                }
                onSave={saveNow}
                fontSize={fontSize}
              />
            )}
            {learningEnabled && <LabTests controller={labControl} />}
          </div>
          <div className="workspace-report-section" id="workspace-result">
            {coding && (
              <CodingChecks
                problemId={id}
                scope={scope}
                tests={tests}
                controller={exampleTests}
                check={detail.check}
                onCheck={updateCheck}
                onError={setError}
              />
            )}
            {learningEnabled && attempts.length > 0 && (
              <div className="lab-history-action">
                <Button
                  className="text-button"
                  onClick={() => {
                    setTab("history");
                    labControl.setStage(2);
                    requestAnimationFrame(() => document.getElementById("tab-history")?.focus());
                  }}
                >
                  이전 검토 기록 {attempts.length}개 보기 →
                </Button>
              </div>
            )}
            {problem.handoff && (
              <HandoffFields
                value={code}
                onChange={changeCode}
                section={learningEnabled ? undefined : "after"}
              />
            )}
            {problem.handoff && (
              <>
                <HandoffReadiness value={code} />
                <HandoffExport title={problem.title} id={problem.id} value={code} />
              </>
            )}
            <ReviewAction
              busy={busy}
              disabled={reviewBlocked}
              aiReady={aiReady}
              remaining={reviewsLeft}
              resetsAt={reviewsResetAt}
              member={scope.startsWith("user:")}
              loginReturnTo={problemUrl(id, returnTo)}
              alternative={
                problem.handoff ? "실행 테스트" : tests ? "예시 테스트" : "직접 확인 표시"
              }
              onReview={() => requestReview(code)}
            />
            {!aiReady && (
              <p className="inline-warning">
                현재 AI 풀이 검토를 사용할 수 없습니다. 코드 작성과 저장은 계속 이용할 수 있습니다.
              </p>
            )}
            {(inputError || error) && (
              <Status className="inline-error workspace-error" role="alert">
                <AlertCircle size={16} />
                {inputError || error}
                <Button
                  aria-label="오류 메시지 닫기"
                  onClick={() => {
                    setError("");
                    setMissingField(null);
                  }}
                >
                  ×
                </Button>
              </Status>
            )}
            <ReviewPanel
              handoff={Boolean(problem.handoff)}
              busy={busy}
              selectedAttempt={selectedAttempt}
              code={code}
              setConfirm={setConfirm}
              requirements={problem.requirements}
              problemId={id}
              scope={scope}
              returnTo={returnTo}
              onRetry={coding ? retry : undefined}
            />
            {learningEnabled && problem.handoff && (
              <aside className="lab-transfer">
                <span className="eyebrow">다음 연습</span>
                <h3>
                  {problem.handoff.variant
                    ? "다른 주제로 분석 범위 넓히기"
                    : HANDOFF_TRACKS.find((t) => t.key === problem.handoff?.track)?.variantTitle}
                </h3>
                <p>
                  이전 풀이를 보지 않고 새 코드의 결과부터 예상해 보세요. 지금 연습할 수 있으며, 7일
                  뒤 첫 재도전 기록과는 구분됩니다.
                </p>
                <Link
                  className="secondary-button"
                  href={
                    problem.handoff.variant
                      ? "/handoff?source=sample"
                      : problemUrl(handoffId(problem.handoff.track, true), "/handoff?source=sample")
                  }
                >
                  {problem.handoff.variant ? "훈련 목록으로" : "새 상황에서 응용하기"}{" "}
                  <ArrowRight size={16} />
                </Link>
              </aside>
            )}
          </div>
        </section>
      </div>
      {coding && (
        <MobileActionBar
          testsAvailable={Boolean(tests)}
          testsRunning={exampleTests.running}
          reviewBusy={busy}
          reviewDisabled={reviewBlocked || (aiReady && reviewsLeft === 0)}
          onTests={() => {
            setMobilePane("result");
            void exampleTests.run();
          }}
          onReview={() => {
            setMobilePane("result");
            requestReview(code);
          }}
        />
      )}
      <WorkspaceConfirmation
        code={code}
        confirm={confirm}
        setConfirm={setConfirm}
        reveal={reveal}
        selectedAttempt={selectedAttempt}
        replaceCode={replaceCode}
        problem={problem}
      />
    </div>
  );
}

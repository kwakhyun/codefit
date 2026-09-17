"use client";

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
import { ProblemMaterials } from "@/components/workspace/problem-materials";
import { ReviewPanel } from "@/components/workspace/review-panel";
import { WorkspaceConfirmation } from "@/components/workspace/workspace-confirmation";
import { useProblemController } from "@/hooks/use-problem-controller";

import { DifficultyBadge, KindBadge } from "@/components/ui/problem-badges";
import { domainLabel, LANGUAGES } from "@/lib/catalog";
import type { Attempt, Progress, ProblemDetail } from "@/lib/problem";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  Check,
  ChevronRight,
  Clock3,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Save,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
const CodeEditor = dynamic(() => import("@/components/code-editor").then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => (
    <div className="editor-loading">
      <span className="blink">▋</span> 코드 편집기 준비 중…
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
    loading,
    setLoading,
    saveState,
    draftStatus,
    localSaved,
    resolveConflict,
    recoverable,
    busy,
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
  if (loading)
    return (
      <div className="content-loader" role="status">
        <LoaderCircle className="spin" size={25} />
        <p>문제와 저장된 풀이를 불러오는 중</p>
      </div>
    );
  if (loadError || !detail)
    return (
      <div className="empty-state">
        <AlertCircle size={32} />
        <h2>문제를 불러오지 못했습니다.</h2>
        <p>{loadError}</p>
        <button
          className="secondary-button"
          onClick={() => {
            setLoading(true);
            setLoadError("");
            void load();
          }}
        >
          다시 시도
        </button>
        <Link href={returnTo}>문제 보관함으로</Link>
      </div>
    );
  const { problem, hints, solution, attempts, progress } = detail;
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
    setMissingField(null);
    void review(value);
  }
  return (
    <div className={`workspace ${focus ? "is-focused" : ""}`}>
      <div className="workspace-breadcrumb">
        <Link href={returnTo}>
          <ArrowLeft size={15} /> {returnTo === "/handoff" ? "인수인계 훈련" : "문제 보관함"}
        </Link>
        <ChevronRight size={13} />
        <span>{domainLabel(problem.domain)}</span>
        <span className="workspace-id mono">
          {problem.id.startsWith("ai-") ? "AI CHALLENGE" : "CURATED CHALLENGE"}
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
          </div>
          <h1>{problem.title}</h1>
        </div>
        <div className="workspace-heading-actions">
          <button
            className={`icon-button ${progress?.bookmarked ? "active" : ""}`}
            aria-label={progress?.bookmarked ? "북마크 해제" : "북마크"}
            onClick={bookmark}
            disabled={bookmarkBusy}
          >
            <Bookmark size={20} fill={progress?.bookmarked ? "currentColor" : "none"} />
          </button>
          <button
            className="icon-button"
            aria-label={focus ? "집중 모드 종료" : "집중 모드"}
            onClick={() => setFocus(!focus)}
          >
            {focus ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>
      {notice && (
        <div className="draft-notice" role="status">
          <Save size={15} />
          <span>{notice}</span>
          {undoCode !== null && (
            <button
              className="text-button"
              onClick={() => {
                changeCode(undoCode);
                setUndoCode(null);
                setNotice("변경 전 코드로 되돌렸습니다.");
              }}
            >
              변경 취소
            </button>
          )}
          <button className="icon-button" aria-label="안내 닫기" onClick={() => setNotice("")}>
            ×
          </button>
        </div>
      )}
      {learningEnabled ? (
        <LearningLab
          controller={labControl}
          starterCode={problem.starterCode}
          aiReady={aiReady}
          blocked={saveState === "conflict" || saveState === "resolving"}
        />
      ) : problem.handoff ? (
        <HandoffGuide starterCode={problem.starterCode} />
      ) : null}
      <div
        className={`workbench ${learningEnabled ? `lab-workbench lab-stage-${labControl.stage}` : ""}`}
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
            <span>
              <span className="status-dot" /> CODE WORKSPACE
            </span>
            <div>
              <span
                className={`save-indicator ${saveState === "failed" ? "failed" : ""}`}
                role="status"
              >
                {saveState === "saving" ? (
                  <LoaderCircle size={12} className="spin" />
                ) : saveState === "saved" ? (
                  <Check size={12} />
                ) : (
                  <Save size={12} />
                )}
                {!localSaved
                  ? "브라우저 보관 실패"
                  : {
                      saved: "저장됨",
                      saving: "저장 중",
                      local: "저장 대기",
                      failed: "저장 실패",
                      offline: "오프라인 보관",
                      conflict: "충돌 · 초안 보관",
                      resolving: "충돌 확인 중",
                    }[saveState]}
              </span>
              {(saveState === "failed" || saveState === "local" || saveState === "offline") && (
                <button className="text-button" onClick={() => void saveNow()}>
                  지금 저장
                </button>
              )}
              <button
                className="icon-button"
                aria-label="시작 코드로 초기화"
                onClick={() => setConfirm("reset")}
                disabled={busy}
              >
                <RotateCcw size={14} />
              </button>
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
          {recoverable.length > 0 && (
            <details className="draft-recovery">
              <summary>다른 창에서 보관한 초안 {recoverable.length}개</summary>
              <p>필요한 코드를 복사해 현재 초안에 합칠 수 있습니다. 원본은 계속 보관됩니다.</p>
              {recoverable.map((draft, index) => (
                <label key={draft.key}>
                  보관한 초안 {index + 1}
                  <textarea
                    aria-label={`보관한 초안 ${index + 1}`}
                    value={
                      problem.handoff ? formatHandoffDraft(draft.record.code) : draft.record.code
                    }
                    readOnly
                  />
                </label>
              ))}
            </details>
          )}
          {problem.handoff && !learningEnabled && (
            <HandoffFields value={code} onChange={changeCode} section="before" />
          )}
          <div className="workspace-code-section">
            {(!learningEnabled || labControl.editorSeen) && (
              <CodeEditor
                focusRequest={learningEnabled && labControl.stage === 2 ? editorFocusRequest : 0}
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
          <div className="workspace-report-section">
            {learningEnabled && attempts.length > 0 && (
              <div className="lab-history-action">
                <button
                  className="text-button"
                  onClick={() => {
                    setTab("history");
                    labControl.setStage(2);
                    requestAnimationFrame(() => document.getElementById("tab-history")?.focus());
                  }}
                >
                  이전 검토 기록 {attempts.length}개 보기 →
                </button>
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
            <div className="review-action">
              <span>
                <kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd>
                <small>AI가 요구사항을 검토합니다.</small>
              </span>
              <button
                className="primary-button"
                onClick={() => requestReview(code)}
                disabled={
                  busy ||
                  code.trim().length < 5 ||
                  !aiReady ||
                  saveState === "conflict" ||
                  saveState === "resolving"
                }
              >
                {busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
                {busy ? "풀이 검토 중" : "AI 풀이 검토"}
                {!busy && <ArrowRight size={16} />}
              </button>
            </div>
            {!aiReady && (
              <p className="inline-warning">
                AI 연결 설정 후 풀이 검토를 사용할 수 있습니다. 코드 작성과 저장은 가능합니다.
              </p>
            )}
            {(inputError || error) && (
              <p className="inline-error workspace-error" role="alert">
                <AlertCircle size={16} />
                {inputError || error}
                <button
                  aria-label="오류 메시지 닫기"
                  onClick={() => {
                    setError("");
                    setMissingField(null);
                  }}
                >
                  ×
                </button>
              </p>
            )}
            <ReviewPanel
              handoff={Boolean(problem.handoff)}
              busy={busy}
              selectedAttempt={selectedAttempt}
              code={code}
              setConfirm={setConfirm}
            />
            {learningEnabled && problem.handoff && (
              <aside className="lab-transfer">
                <span className="eyebrow">NEXT / 다른 상황에서도 이해했을까?</span>
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
                      ? "/handoff"
                      : problemUrl(handoffId(problem.handoff.track, true), "/handoff")
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

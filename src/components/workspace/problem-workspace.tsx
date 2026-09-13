"use client";

import { ProblemMaterials } from "@/components/workspace/problem-materials";
import { ReviewPanel } from "@/components/workspace/review-panel";
import { WorkspaceConfirmation } from "@/components/workspace/workspace-confirmation";
import { useProblemController } from "@/hooks/use-problem-controller";

import { DifficultyBadge, KindBadge } from "@/components/ui/problem-badges";
import { domainLabel, LANGUAGES } from "@/lib/catalog";
import type { Attempt, Progress } from "@/lib/problem";
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
  onProgress,
  fontSize,
  focus,
  setFocus,
  aiReady,
  returnTo = "/",
  initialAttemptId,
}: {
  id: string;
  onProgress: (p: Progress, attempt?: Attempt) => void;
  fontSize: number;
  focus: boolean;
  setFocus: (value: boolean) => void;
  aiReady: boolean;
  returnTo?: string;
  initialAttemptId?: string;
}) {
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
  } = useProblemController({ id, onProgress, aiReady, initialAttemptId });
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
  return (
    <div className={`workspace ${focus ? "is-focused" : ""}`}>
      <div className="workspace-breadcrumb">
        <Link href={returnTo}>
          <ArrowLeft size={15} /> 문제 보관함
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
      <div className="workbench">
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
          setSelectedAttempt={setSelectedAttempt}
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
                {
                  { saved: "저장됨", saving: "저장 중", local: "저장 대기", failed: "저장 실패" }[
                    saveState
                  ]
                }
              </span>
              {(saveState === "failed" || saveState === "local") && (
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
          <CodeEditor
            value={code}
            language={problem.language}
            problemId={id}
            onChange={changeCode}
            onCheck={review}
            onSave={saveNow}
            fontSize={fontSize}
          />
          <div className="review-action">
            <span>
              <kbd>⌘ / Ctrl</kbd> + <kbd>Enter</kbd>
              <small>AI가 요구사항을 검토합니다.</small>
            </span>
            <button
              className="primary-button"
              onClick={() => review(code)}
              disabled={busy || code.trim().length < 5 || !aiReady}
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
          {error && (
            <p className="inline-error workspace-error" role="alert">
              <AlertCircle size={16} />
              {error}
              <button aria-label="오류 메시지 닫기" onClick={() => setError("")}>
                ×
              </button>
            </p>
          )}
          <ReviewPanel
            busy={busy}
            selectedAttempt={selectedAttempt}
            code={code}
            setConfirm={setConfirm}
          />
        </section>
      </div>
      <WorkspaceConfirmation
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

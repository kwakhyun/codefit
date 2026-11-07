"use client";
import { LoadingState } from "@/components/ui/loading-state";
import { Button, Status } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/modal";
import { useEditorPreferences } from "@/hooks/use-editor-preferences";
import { LearningHistory } from "@/components/library/learning-history";
import { ProblemLibrary } from "@/components/library/problem-library";
import { HeaderActions, useFocusMode, useNavInfo } from "@/components/shell/shell-context";
import { usePracticeSession } from "@/hooks/use-practice-session";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { type DomainId } from "@/lib/catalog";
import { defaultFilters, libraryUrl, problemUrl, type LibraryFilters } from "@/lib/library-state";
import { AlertCircle, MoreHorizontal, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Generator } from "./library/problem-generator";
import { ProblemWorkspace } from "./workspace/problem-workspace";
import { useLibraryController } from "@/hooks/use-library-controller";
import type { LibraryView } from "@/lib/library-state";

/** Coding home, its list views and the problem workspace. The app shell surrounds it. */
export function PracticeApp({
  initialProblemId,
  initialDomain = "all",
  initialView = "library",
  initialFilters = defaultFilters,
  returnTo = "/",
  initialAttemptId,
}: {
  initialProblemId?: string;
  initialDomain?: DomainId | "all";
  initialView?: LibraryView;
  initialFilters?: LibraryFilters;
  returnTo?: string;
  initialAttemptId?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const { type } = useLearningPreference();

  const [generatorOpen, setGeneratorOpen] = useState(params.get("generate") === "1");
  const [focus, setFocus] = useState(false);
  const { fontSize } = useEditorPreferences();
  useFocusMode(focus && Boolean(initialProblemId));

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
        return;
      const target = event.target as HTMLElement;
      const typing =
        target.matches("input, textarea, select") ||
        target.isContentEditable ||
        document.querySelector("dialog[open]");
      if (typing || initialProblemId) return;
      const search = document.getElementById("problem-search");
      if (!search) return;
      event.preventDefault();
      search.focus();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [initialProblemId]);

  const { data, loadError, refreshing, load, onProgress } = usePracticeSession(
    initialProblemId,
    libraryUrl(initialFilters, initialDomain, initialView),
    initialAttemptId,
  );
  useEffect(() => {
    // A restored backup changes problems, progress and history at once.
    const refresh = () => void load({ background: true });
    window.addEventListener("codefit:backup-imported", refresh);
    return () => window.removeEventListener("codefit:backup-imported", refresh);
  }, [load]);
  const { bookmarking, bookmark, exportData, exporting } = useWorkspaceActions({
    onProgress,
    scope: data?.scope,
  });
  const library = useLibraryController({
    data,
    initialFilters,
    initialDomain,
    initialView,
    initialProblemId,
  });
  const { libraryHref, saved } = library;
  const activeProblem = data?.activeProblem || undefined;
  useNavInfo(data ? saved : undefined, activeProblem?.domain);
  return (
    <>
      <PracticeHeaderActions
        problemPage={Boolean(initialProblemId)}
        canGenerate={type === "code"}
        ready={Boolean(data)}
        refreshing={refreshing}
        onRefresh={() => void load()}
        onGenerate={() => setGeneratorOpen(true)}
      />
      <main
        id="main-content"
        tabIndex={-1}
        className={initialProblemId ? "practice-main" : "library-main"}
      >
        {loadError && data && (
          <Status className="inline-error" role="alert">
            {loadError}{" "}
            <Button className="text-button" onClick={() => void load()}>
              다시 연결
            </Button>
          </Status>
        )}
        {loadError && !data ? (
          <div className="empty-state">
            <AlertCircle size={32} aria-hidden="true" />
            <h1>문제와 학습 기록을 불러오지 못했습니다.</h1>
            <p>{loadError}</p>
            <Button className="secondary-button" onClick={() => void load()}>
              <RotateCcw size={16} aria-hidden="true" />
              다시 연결
            </Button>
          </div>
        ) : !data ? (
          <LoadingState variant={initialProblemId ? "editor" : "cards"}>
            문제와 학습 기록을 불러오는 중입니다.
          </LoadingState>
        ) : initialProblemId ? (
          <ProblemWorkspace
            key={`${data.scope}:${initialProblemId}:${initialAttemptId || ""}`}
            initialDetail={data.bootstrap?.detail}
            id={initialProblemId}
            scope={data.scope}
            returnTo={returnTo}
            initialAttemptId={initialAttemptId}
            onProgress={onProgress}
            fontSize={fontSize}
            focus={focus}
            setFocus={setFocus}
            aiReady={data.aiReady}
          />
        ) : initialView === "history" ? (
          <LearningHistory data={data} library={library} />
        ) : (
          <ProblemLibrary
            initialView={initialView}
            initialDomain={initialDomain}
            data={data}
            library={library}
            onGenerate={() => setGeneratorOpen(true)}
            bookmarking={bookmarking}
            bookmark={(problem, bookmarked) =>
              bookmark(problem, bookmarked, (value) => library.setBookmarked(problem.id, value))
            }
            exportData={exportData}
            exporting={exporting}
          />
        )}
      </main>
      <Generator
        key={`${data?.scope}:${initialDomain}:${activeProblem?.domain || "frontend"}`}
        open={generatorOpen && Boolean(data)}
        onClose={() => setGeneratorOpen(false)}
        initialDomain={
          initialDomain === "all" ? activeProblem?.domain || "frontend" : initialDomain
        }
        account={data?.account || { user: null, providers: [] }}
        aiReady={Boolean(data?.aiReady)}
        onCreated={(problem) => {
          void load({ background: true });
          setGeneratorOpen(false);
          router.push(problemUrl(problem.id, initialProblemId ? returnTo : libraryHref));
        }}
      />
    </>
  );
}

/** Refresh and AI generation join the shared header; on phones they move into one menu. */
function PracticeHeaderActions({
  problemPage,
  canGenerate,
  ready,
  refreshing,
  onRefresh,
  onGenerate,
}: {
  problemPage: boolean;
  canGenerate: boolean;
  ready: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onGenerate: () => void;
}) {
  const [quickOpen, setQuickOpen] = useState(false);
  const quickTrigger = useRef<HTMLButtonElement>(null);
  if (problemPage && !canGenerate) return null;
  function closeQuick() {
    setQuickOpen(false);
    requestAnimationFrame(() => quickTrigger.current?.focus());
  }
  return (
    <HeaderActions>
      <Button
        ref={quickTrigger}
        className="icon-button mobile-header-more"
        aria-label="빠른 작업"
        aria-haspopup="dialog"
        aria-expanded={quickOpen}
        onClick={() => setQuickOpen(true)}
      >
        <MoreHorizontal size={22} aria-hidden="true" />
      </Button>
      <Modal
        open={quickOpen}
        onClose={closeQuick}
        title="빠른 작업"
        className="header-quick-dialog"
      >
        <div className="header-quick-actions">
          {canGenerate && (
            <Button
              disabled={!ready}
              onClick={() => {
                closeQuick();
                onGenerate();
              }}
            >
              <Sparkles size={20} aria-hidden="true" /> AI 문제 생성
            </Button>
          )}
          {!problemPage && (
            <Button
              disabled={refreshing}
              onClick={() => {
                closeQuick();
                onRefresh();
              }}
            >
              <RefreshCw size={20} aria-hidden="true" /> 문제와 기록 새로고침
            </Button>
          )}
        </div>
      </Modal>
      {!problemPage && (
        <Button
          className="icon-button desktop-header-action"
          aria-label="문제와 기록 새로고침"
          title="문제와 기록 새로고침"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw size={17} className={refreshing ? "spin" : ""} aria-hidden="true" />
        </Button>
      )}
      {canGenerate && (
        <Button
          className="secondary-button small desktop-header-action"
          aria-haspopup="dialog"
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            onGenerate();
          }}
          disabled={!ready}
        >
          <Sparkles size={15} aria-hidden="true" />
          AI 문제 생성
        </Button>
      )}
    </HeaderActions>
  );
}

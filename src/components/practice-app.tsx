"use client";

import { useEditorPreferences } from "@/hooks/use-editor-preferences";

import { LearningHistory } from "@/components/library/learning-history";
import { ProblemLibrary } from "@/components/library/problem-library";
import { AppFooter } from "@/components/shell/app-footer";
import { AppHeader } from "@/components/shell/app-header";
import { HelpDialog } from "@/components/shell/help-dialog";
import { SettingsDialog } from "@/components/shell/settings-dialog";
import { Sidebar } from "@/components/shell/sidebar";
import { usePracticeSession } from "@/hooks/use-practice-session";
import { useWorkspaceActions } from "@/hooks/use-workspace-actions";

import { type DomainId } from "@/lib/catalog";
import { defaultFilters, libraryUrl, problemUrl, type LibraryFilters } from "@/lib/library-state";
import { AlertCircle, Check, RotateCcw, Terminal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Generator } from "./library/problem-generator";
import { ProblemWorkspace } from "./workspace/problem-workspace";

import { useLibraryController } from "@/hooks/use-library-controller";
import type { LibraryView } from "@/lib/library-state";
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

  const [generatorOpen, setGeneratorOpen] = useState(params.get("generate") === "1");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [focus, setFocus] = useState(false);
  const { fontSize, changeFontSize: setFontSize } = useEditorPreferences();

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const typing =
        target.matches("input, textarea, select") ||
        target.isContentEditable ||
        document.querySelector("dialog[open]");
      if (event.key === "/" && !typing && !initialProblemId) {
        event.preventDefault();
        document.getElementById("problem-search")?.focus();
      }
      if (event.key === "Escape") setMobileMenu(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [initialProblemId]);
  useEffect(() => {
    if (!mobileMenu) return;
    const before = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(".sidebar a")?.focus(),
    );
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = overflow;
      before?.focus({ preventScroll: true });
    };
  }, [mobileMenu]);

  const { data, loadError, refreshing, load, onProgress } = usePracticeSession(
    initialProblemId,
    libraryUrl(initialFilters, initialDomain, initialView),
    initialAttemptId,
  );
  const actions = useWorkspaceActions({ load, onProgress });
  const {
    toast,
    setToast,
    toastError,
    settingsNotice,
    exporting,
    importing,
    importFile,
    bookmarking,
    bookmark,
    exportData,
    importBackup,
  } = actions;
  const library = useLibraryController({
    data,
    initialFilters,
    initialDomain,
    initialView,
    initialProblemId,
  });
  const { libraryHref, saved, title } = library;
  const activeProblem = data?.activeProblem || undefined;
  return (
    <div className={`lab-shell ${focus && initialProblemId ? "focus-mode" : ""}`}>
      <a className="skip-link" href="#main-content">
        본문으로 이동
      </a>
      {mobileMenu && (
        <button
          className="sidebar-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMobileMenu(false)}
        />
      )}
      <Sidebar
        mobileMenu={mobileMenu}
        setMobileMenu={setMobileMenu}
        initialProblemId={initialProblemId}
        initialView={initialView}
        initialDomain={initialDomain}
        data={data}
        saved={saved}
        activeProblem={activeProblem}
        setSettingsOpen={setSettingsOpen}
      />
      <div className="main-shell">
        <AppHeader
          setMobileMenu={setMobileMenu}
          initialProblemId={initialProblemId}
          title={title}
          data={data}
          refreshing={refreshing}
          load={load}
          setHelpOpen={setHelpOpen}
          setGeneratorOpen={setGeneratorOpen}
        />
        <main id="main-content" className={initialProblemId ? "practice-main" : "library-main"}>
          {loadError ? (
            <div className="empty-state">
              <AlertCircle size={32} />
              <h1>저장소에 연결하지 못했습니다.</h1>
              <p>{loadError}</p>
              <button className="secondary-button" onClick={load}>
                <RotateCcw size={16} />
                다시 연결
              </button>
            </div>
          ) : !data ? (
            <div className="content-loader" role="status">
              <span className="terminal-icon">
                <Terminal size={26} />
              </span>
              <span className="mono">연습실을 준비하고 있어요</span>
              <p>문제와 학습 기록을 불러오는 중입니다.</p>
            </div>
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
              bookmark={bookmark}
              exportData={exportData}
              exporting={exporting}
            />
          )}
        </main>
        <AppFooter />
      </div>
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
          void load();
          setGeneratorOpen(false);
          router.push(problemUrl(problem.id, initialProblemId ? returnTo : libraryHref));
        }}
      />
      <SettingsDialog
        settingsOpen={settingsOpen}
        setSettingsOpen={setSettingsOpen}
        fontSize={fontSize}
        setFontSize={setFontSize}
        data={data}
        exportData={exportData}
        exporting={exporting}
        importFile={importFile}
        importBackup={importBackup}
        importing={importing}
        settingsNotice={settingsNotice}
      />
      <HelpDialog helpOpen={helpOpen} setHelpOpen={setHelpOpen} />
      {toast && (
        <div
          className={`toast ${toastError ? "toast-error" : ""}`}
          role={toastError ? "alert" : "status"}
        >
          {toastError ? <AlertCircle size={16} /> : <Check size={16} />}
          <span>{toast}</span>
          <button className="icon-button" aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

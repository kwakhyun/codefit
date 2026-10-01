"use client";

import { domainLabel, type DomainId } from "@/lib/catalog";
import type { LibraryView } from "@/lib/library-state";
import { libraryUrl, type LibraryFilters } from "@/lib/library-state";
import type { LibraryPage, Workspace } from "@/lib/problem";
import { trainingSummary } from "@/lib/training";
import { api, errorMessage } from "@/lib/client-api";
import { useEffect, useState, useRef } from "react";
export function useLibraryController({
  data,
  initialFilters,
  initialDomain,
  initialView,
  initialProblemId,
}: {
  data: Workspace | null;
  initialFilters: LibraryFilters;
  initialDomain: DomainId | "all";
  initialView: LibraryView;
  initialProblemId?: string;
}) {
  const [search, setSearch] = useState(initialFilters.search);
  const [level, setLevel] = useState(initialFilters.level);
  const [kind, setKind] = useState(initialFilters.kind);
  const [language, setLanguage] = useState(initialFilters.language);
  const [source, setSource] = useState(initialFilters.source);
  const [status, setStatus] = useState(initialFilters.status);
  const [sort, setSort] = useState(initialFilters.sort);
  const [page, setPage] = useState(initialFilters.page);
  // A link to this same view (e.g. the menu) navigates with new URL filters; follow them.
  const filtersKey = JSON.stringify(initialFilters);
  const [navigated, setNavigated] = useState(filtersKey);
  if (navigated !== filtersKey) {
    setNavigated(filtersKey);
    setSearch(initialFilters.search);
    setLevel(initialFilters.level);
    setKind(initialFilters.kind);
    setLanguage(initialFilters.language);
    setSource(initialFilters.source);
    setStatus(initialFilters.status);
    setSort(initialFilters.sort);
    setPage(initialFilters.page);
  }
  const libraryHref = libraryUrl(
    { search, level, kind, language, source, status, sort, page },
    initialDomain,
    initialView,
  );
  useEffect(() => {
    if (
      !initialProblemId &&
      window.location.pathname === "/" &&
      window.location.pathname + window.location.search !== libraryHref
    )
      window.history.replaceState(null, "", libraryHref);
  }, [initialProblemId, libraryHref]);
  const [result, setResult] = useState<{ href: string; value: LibraryPage } | null>(null);
  // Read by the fetch effect without refetching on every result change.
  const shown = useRef(result);
  useEffect(() => {
    shown.current = result;
  }, [result]);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState(true);
  const [retry, setRetry] = useState(0);
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (!data || initialProblemId || initialView === "history") return;
    if (!bootstrapped.current && data.bootstrap?.library?.href === libraryHref && retry === 0) {
      bootstrapped.current = true;
      const initial = data.bootstrap.library;
      void Promise.resolve().then(() => {
        setResult(initial);
        setPending(false);
      });
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // Refreshing the same page (e.g. after a bookmark) keeps the rows and their focus.
      const background = shown.current?.href === libraryHref;
      if (!background) setPending(true);
      setLoadError("");
      try {
        const value = await api<LibraryPage>(`/api/library${libraryHref.slice(1)}`, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setResult({ href: libraryHref, value });
      } catch (error) {
        if (!controller.signal.aborted && !background) setLoadError(errorMessage(error));
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [data, initialProblemId, initialView, libraryHref, retry]);
  const loading = pending || (result?.href !== libraryHref && !loadError);
  const currentPage = result?.value.page || page;
  const total = result?.value.total || 0;
  const pageProblems = result?.value.problems || [];
  const progress = result?.value.progress || {};
  const solved = data?.stats.solved || 0;
  const inProgress = data?.stats.inProgress || 0;
  const saved = data?.stats.bookmarked || 0;
  const aiCount = data?.stats.ai || 0;
  const hasFilters = Boolean(
    search ||
    level !== "all" ||
    kind !== "all" ||
    language !== "all" ||
    source !== "all" ||
    status !== "all" ||
    sort !== "recommended",
  );
  const resume = data?.resume || undefined;
  const recommended = data?.recommended || undefined;
  const training = data?.training || trainingSummary([]);
  const title =
    initialView === "bookmarks"
      ? "북마크"
      : initialView === "history"
        ? "학습 기록"
        : initialView === "browse"
          ? "전체 문제 탐색"
          : initialDomain === "all"
            ? "문제 보관함"
            : domainLabel(initialDomain);
  function setBookmarked(problemId: string, bookmarked: boolean) {
    setResult((current) => {
      const previous = current?.value.progress[problemId];
      if (!current) return current;
      const next = previous
        ? { ...previous, bookmarked }
        : {
            problemId,
            codeRevision: 0,
            bookmarked,
            hintsViewed: 0,
            solutionViewed: false,
            status: "new" as const,
            updatedAt: new Date(0).toISOString(),
          };
      return {
        ...current,
        value: { ...current.value, progress: { ...current.value.progress, [problemId]: next } },
      };
    });
  }
  function resetFilters() {
    setSearch("");
    setLevel("all");
    setKind("all");
    setLanguage("all");
    setSource("all");
    setStatus("all");
    setSort("recommended");
    setPage(1);
  }
  return {
    search,
    setSearch,
    level,
    setLevel,
    kind,
    setKind,
    language,
    setLanguage,
    source,
    setSource,
    status,
    setStatus,
    sort,
    setSort,
    page,
    setPage,
    libraryHref,
    solved,
    inProgress,
    saved,
    aiCount,
    total,
    progress,
    loading,
    loadError,
    retry: () => setRetry((value) => value + 1),
    currentPage,
    pageProblems,
    hasFilters,
    resume,
    recommended,
    training,
    title,
    resetFilters,
    setBookmarked,
  };
}
export type LibraryController = ReturnType<typeof useLibraryController>;

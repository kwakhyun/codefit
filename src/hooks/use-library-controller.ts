"use client";

import { domainLabel, LANGUAGES, LEVELS, type DomainId } from "@/lib/catalog";
import type { LibraryView } from "@/lib/library-state";
import { libraryUrl, type LibraryFilters } from "@/lib/library-state";
import type { Workspace } from "@/lib/problem";
import { recommendProblem, trainingSummary } from "@/lib/training";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  const query = useDeferredValue(search);
  const [level, setLevel] = useState(initialFilters.level);
  const [kind, setKind] = useState(initialFilters.kind);
  const [language, setLanguage] = useState(initialFilters.language);
  const [source, setSource] = useState(initialFilters.source);
  const [status, setStatus] = useState(initialFilters.status);
  const [sort, setSort] = useState(initialFilters.sort);
  const [page, setPage] = useState(initialFilters.page);
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
  const progressList = useMemo(() => Object.values(data?.progress || {}), [data?.progress]);
  const solved = progressList.filter((p) => p.status === "solved").length;
  const inProgress = progressList.filter((p) => p.status === "in-progress").length;
  const saved = progressList.filter((p) => p.bookmarked).length;
  const aiCount = data?.problems.filter((p) => p.source === "ai").length || 0;
  const filtered = useMemo(() => {
    const list = (data?.problems || []).filter((p) => {
      const progress = data?.progress[p.id];
      return (
        (initialDomain === "all" || p.domain === initialDomain) &&
        (level === "all" || p.difficulty === level) &&
        (kind === "all" || p.kind === kind) &&
        (language === "all" || p.language === language) &&
        (source === "all" || p.source === source) &&
        (status === "all" || (progress?.status || "new") === status) &&
        (initialView !== "bookmarks" || progress?.bookmarked) &&
        (!query.trim() ||
          [p.title, p.summary, p.tags.join(" "), LANGUAGES[p.language].label, domainLabel(p.domain)]
            .join(" ")
            .toLowerCase()
            .includes(query.trim().toLowerCase()))
      );
    });
    return list.sort((a, b) => {
      if (sort === "easy") return LEVELS.indexOf(a.difficulty) - LEVELS.indexOf(b.difficulty);
      if (sort === "short") return a.minutes - b.minutes;
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      if (a.id === "fe-search-race") return -1;
      if (b.id === "fe-search-race") return 1;
      if (a.source !== b.source) return a.source === "ai" ? -1 : 1;
      return a.createdAt.localeCompare(b.createdAt);
    });
  }, [data, initialDomain, initialView, kind, language, level, query, sort, source, status]);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(filtered.length / 8)));
  const pageProblems = filtered.slice((currentPage - 1) * 8, currentPage * 8);
  const hasFilters = Boolean(
    search ||
    level !== "all" ||
    kind !== "all" ||
    language !== "all" ||
    source !== "all" ||
    status !== "all" ||
    sort !== "recommended",
  );
  const resume = progressList
    .filter((p) => p.status === "in-progress")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const recommended = data ? recommendProblem(data.problems, data.progress) : undefined;
  const training = useMemo(() => trainingSummary(data?.attempts || []), [data?.attempts]);
  const title =
    initialView === "bookmarks"
      ? "북마크"
      : initialView === "history"
        ? "학습 기록"
        : initialDomain === "all"
          ? "문제 보관함"
          : domainLabel(initialDomain);
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
    filtered,
    currentPage,
    pageProblems,
    hasFilters,
    resume,
    recommended,
    training,
    title,
    resetFilters,
  };
}
export type LibraryController = ReturnType<typeof useLibraryController>;

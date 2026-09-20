"use client";
import { Button, Input, ToggleButton } from "@/components/ui/primitives";
import { useEffect, useRef } from "react";
import { useLearningPreference } from "@/hooks/use-learning-preference";

import type { LibraryController } from "@/hooks/use-library-controller";

import { LibraryFilters } from "@/components/library/library-filters";
import { ProblemTable } from "@/components/library/problem-table";
import { TrainingHero } from "@/components/library/training-hero";

import { domainLabel, KIND_LABELS, KINDS, type DomainId } from "@/lib/catalog";
import type { ProblemSummary, Workspace } from "@/lib/problem";
import {
  ArrowDownToLine,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FolderCode,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
interface ProblemLibraryProps {
  initialView: "library" | "bookmarks" | "browse";
  initialDomain: DomainId | "all";
  data: Workspace;
  library: LibraryController;
  onGenerate: () => void;
  bookmarking: string | null;
  bookmark: (p: ProblemSummary, bookmarked: boolean) => Promise<void>;
  exportData: () => Promise<void>;
  exporting: boolean;
}
export function ProblemLibrary({
  initialView,
  initialDomain,
  data,
  library,
  onGenerate,
  bookmarking,
  bookmark,
  exportData,
  exporting,
}: ProblemLibraryProps) {
  const searchInput = useRef<HTMLInputElement>(null);
  const { type } = useLearningPreference();
  const isHome =
    initialView === "library" &&
    initialDomain === "all" &&
    !library.hasFilters &&
    library.page === 1;
  const showCatalog = !isHome || type === "code";
  useEffect(() => {
    // The workspace gate can mount the library after the browser's initial anchor lookup.
    const anchor = window.location.hash.slice(1);
    if (["problem-library", "learning-preference"].includes(anchor))
      document.getElementById(anchor)?.scrollIntoView();
  }, []);
  const {
    recommended,
    libraryHref,
    resume,
    solved,
    inProgress,
    aiCount,
    title,
    total,
    search,
    setSearch,
    setPage,
    kind,
    setKind,
    currentPage,
  } = library;
  return (
    <>
      {isHome ? (
        <TrainingHero
          scope={data.scope}
          recommended={recommended}
          libraryHref={libraryHref}
          resume={resume}
          onGenerate={onGenerate}
        />
      ) : (
        <div className="page-title">
          <span className="eyebrow">
            {initialView === "bookmarks" ? "SAVED FOR LATER" : "EXPLORE YOUR DOMAIN"}
          </span>
          <h1>
            {initialView === "bookmarks"
              ? "북마크한 문제"
              : initialDomain === "all"
                ? "전체 문제 탐색"
                : `${domainLabel(initialDomain as DomainId)} 코딩 문제`}
          </h1>
          <p>
            {initialView === "bookmarks"
              ? "저장해 둔 문제를 골라 이어서 풀거나 다시 연습하세요."
              : "기능 구현, 오류 수정, 리팩터링 문제로 직접 코드를 작성하고 검토해 보세요."}
          </p>
        </div>
      )}
      {
        showCatalog ? (
          <>
            <div className="stats-row library-stats" aria-label="코딩 문제 현황">
              <div>
                <span>
                  <FolderCode size={16} />
                  전체 문제
                </span>
                <strong>
                  {data.stats.total}
                  <small>문제</small>
                </strong>
                <span className="stat-note">기본 문제와 AI 생성 문제</span>
              </div>
              <div>
                <span>
                  <CheckCircle2 size={16} />
                  해결한 문제
                </span>
                <strong className="accent">
                  {solved}
                  <small>/ {data.stats.total}</small>
                </strong>
                <div className="stat-progress">
                  <i style={{ width: `${(solved / Math.max(1, data.stats.total)) * 100}%` }} />
                </div>
              </div>
              <div>
                <span>
                  <Clock3 size={16} />
                  진행 중
                </span>
                <strong>
                  {inProgress}
                  <small>문제</small>
                </strong>
                <span className="stat-note">작성한 코드부터 이어서</span>
              </div>
              <div>
                <span>
                  <Sparkles size={16} />
                  AI 생성 문제
                </span>
                <strong>
                  {aiCount}
                  <small>문제</small>
                </strong>
                <span className="stat-note">
                  <span className="status-dot" />
                  함께 푸는 공개 문제
                </span>
              </div>
            </div>
            <section id="problem-library" className="problem-library" aria-label="문제 목록">
              <div className="section-heading">
                <div>
                  <h2>
                    {title}
                    <span>{total}</span>
                  </h2>
                  <p>연습할 분야와 난이도에 맞는 문제를 골라보세요.</p>
                </div>
                <Button className="text-button" onClick={onGenerate}>
                  <Sparkles size={14} />
                  원하는 문제가 없다면 직접 생성
                  <ArrowRight size={14} />
                </Button>
              </div>
              <div className="filter-top">
                <div className="search-box">
                  <Search size={17} />
                  <Input
                    ref={searchInput}
                    id="problem-search"
                    maxLength={200}
                    value={search}
                    placeholder="제목, 기술, 키워드로 검색"
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    aria-label="문제 검색"
                  />
                  {search ? (
                    <Button
                      className="icon-button"
                      aria-label="검색어 지우기"
                      onClick={() => {
                        setSearch("");
                        setPage(1);
                        searchInput.current?.focus();
                      }}
                    >
                      <X size={14} />
                    </Button>
                  ) : (
                    <kbd>/</kbd>
                  )}
                </div>
                <div className="type-filters">
                  <ToggleButton
                    className={kind === "all" ? "selected" : ""}
                    aria-pressed={kind === "all"}
                    onClick={() => {
                      setKind("all");
                      setPage(1);
                    }}
                  >
                    전체 유형
                  </ToggleButton>
                  {KINDS.map((k) => (
                    <ToggleButton
                      key={k}
                      className={kind === k ? "selected" : ""}
                      aria-pressed={kind === k}
                      onClick={() => {
                        setKind(k);
                        setPage(1);
                      }}
                    >
                      {KIND_LABELS[k]}
                    </ToggleButton>
                  ))}
                </div>
              </div>
              <LibraryFilters library={library} />
              <ProblemTable
                library={library}
                initialView={initialView}
                bookmarking={bookmarking}
                bookmark={bookmark}
              />
              <div className="table-footer">
                <span>
                  {total > 0
                    ? `${(currentPage - 1) * 8 + 1}–${Math.min(currentPage * 8, total)}`
                    : "0"}{" "}
                  <span className="muted">/ {total}개 문제</span>
                </span>
                <div className="pagination">
                  <Button
                    className="icon-button"
                    aria-label="이전 페이지"
                    disabled={currentPage <= 1}
                    onClick={() => setPage(currentPage - 1)}
                  >
                    <ChevronLeft size={16} />
                  </Button>
                  <span>
                    {currentPage}{" "}
                    <span className="muted">/ {Math.max(1, Math.ceil(total / 8))}</span>
                  </span>
                  <Button
                    className="icon-button"
                    aria-label="다음 페이지"
                    disabled={currentPage * 8 >= total}
                    onClick={() => setPage(currentPage + 1)}
                  >
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>
            </section>
            <div className="library-bottom-note">
              <span>
                <ShieldCheck size={14} />
                생성한 문제와 학습 기록은 서버에 보관됩니다.
              </span>
              <Button className="text-button" onClick={exportData} disabled={exporting}>
                <ArrowDownToLine size={13} />내 기록 내보내기
              </Button>
            </div>
          </>
        ) : null /* Other workspaces link to the catalog in their navigation. */
      }
    </>
  );
}

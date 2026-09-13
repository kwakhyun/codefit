"use client";

import type { LibraryController } from "@/hooks/use-library-controller";

import { DifficultyBadge, DomainIcon, KindBadge } from "@/components/ui/problem-badges";
import { domainLabel, LANGUAGES } from "@/lib/catalog";
import { problemUrl } from "@/lib/library-state";
import type { ProblemSummary, Workspace } from "@/lib/problem";
import { Bookmark, CheckCircle2, Clock3, Search, Sparkles } from "lucide-react";
import Link from "next/link";
interface ProblemTableProps {
  library: LibraryController;
  initialView: "library" | "bookmarks";
  data: Workspace;
  bookmarking: string | null;
  bookmark: (p: ProblemSummary) => Promise<void>;
}
export function ProblemTable({
  library,
  initialView,
  data,
  bookmarking,
  bookmark,
}: ProblemTableProps) {
  const { pageProblems, hasFilters, resetFilters, libraryHref } = library;
  return (
    <div className="problem-table">
      <div className="table-header">
        <span>상태</span>
        <span>문제</span>
        <span>유형</span>
        <span>난이도</span>
        <span>예상 시간</span>
        <span className="sr-only">북마크</span>
      </div>
      {pageProblems.length === 0 ? (
        <div className="empty-state">
          <Search size={32} />
          <h3>
            {initialView === "bookmarks" && !hasFilters
              ? "아직 북마크한 문제가 없습니다."
              : "조건에 맞는 문제가 없습니다."}
          </h3>
          <p>
            {initialView === "bookmarks" && !hasFilters
              ? "문제 옆 북마크 아이콘을 눌러 모아 보세요."
              : "검색 조건을 바꾸거나 원하는 주제로 새 문제를 만들어 보세요."}
          </p>
          {hasFilters ? (
            <button className="secondary-button" onClick={resetFilters}>
              필터 초기화
            </button>
          ) : (
            <Link href="/" className="secondary-button">
              전체 문제 보기
            </Link>
          )}
        </div>
      ) : (
        pageProblems.map((p) => {
          const progress = data.progress[p.id];
          return (
            <div className="problem-row" key={p.id}>
              <span
                className={`problem-status ${progress?.status || "new"}`}
                title={
                  progress?.status === "solved"
                    ? "해결 완료"
                    : progress?.status === "in-progress"
                      ? "진행 중"
                      : "미해결"
                }
              >
                {progress?.status === "solved" ? (
                  <CheckCircle2 size={18} aria-label="해결 완료" />
                ) : progress?.status === "in-progress" ? (
                  <Clock3 size={17} aria-label="진행 중" />
                ) : (
                  <span className="empty-status" aria-label="미해결" role="img" />
                )}
              </span>
              <Link href={problemUrl(p.id, libraryHref)} className="problem-link">
                <div>
                  <h3>{p.title}</h3>
                  {p.source === "ai" && (
                    <span className="ai-tag">
                      <Sparkles size={10} />
                      AI
                    </span>
                  )}
                </div>
                <span>
                  <DomainIcon domain={p.domain} size={12} />
                  {domainLabel(p.domain)}
                  <i />
                  {LANGUAGES[p.language].label}
                  <span className="row-tags">
                    {p.tags.slice(1, 3).map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </span>
                </span>
              </Link>
              <KindBadge kind={p.kind} />
              <DifficultyBadge level={p.difficulty} />
              <span className="row-time mono">
                {p.minutes}
                <small> min</small>
              </span>
              <button
                className={`bookmark-button icon-button ${progress?.bookmarked ? "active" : ""}`}
                aria-label={`${p.title} ${progress?.bookmarked ? "북마크 해제" : "북마크"}`}
                disabled={bookmarking === p.id}
                onClick={() => bookmark(p)}
              >
                <Bookmark size={17} fill={progress?.bookmarked ? "currentColor" : "none"} />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}

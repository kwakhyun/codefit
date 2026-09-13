"use client";

import type { LibraryController } from "@/hooks/use-library-controller";

import { LANGUAGES, LEVELS } from "@/lib/catalog";
import { ChevronDown, RotateCcw } from "lucide-react";
interface LibraryFiltersProps {
  library: LibraryController;
}
export function LibraryFilters({ library }: LibraryFiltersProps) {
  const {
    level,
    setLevel,
    setPage,
    language,
    setLanguage,
    status,
    setStatus,
    source,
    setSource,
    hasFilters,
    resetFilters,
    sort,
    setSort,
  } = library;
  return (
    <div className="filter-bottom">
      <div className="select-filters">
        <label>
          <span className="sr-only">난이도 필터</span>
          <select
            value={level}
            onChange={(e) => {
              setLevel(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">모든 난이도</option>
            {LEVELS.map((l) => (
              <option value={l} key={l}>
                난이도 {l}
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
        </label>
        <label>
          <span className="sr-only">언어 필터</span>
          <select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">모든 언어</option>
            {Object.entries(LANGUAGES).map(([id, l]) => (
              <option key={id} value={id}>
                {l.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} />
        </label>
        <label>
          <span className="sr-only">풀이 상태 필터</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">모든 상태</option>
            <option value="new">미해결</option>
            <option value="in-progress">진행 중</option>
            <option value="solved">해결 완료</option>
          </select>
          <ChevronDown size={12} />
        </label>
        <label>
          <span className="sr-only">문제 출처 필터</span>
          <select
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">모든 출처</option>
            <option value="curated">기본 문제</option>
            <option value="ai">AI 생성</option>
          </select>
          <ChevronDown size={12} />
        </label>
        {hasFilters && (
          <button className="text-button clear-filters" onClick={resetFilters}>
            <RotateCcw size={12} />
            초기화
          </button>
        )}
      </div>
      <label className="sort-select">
        <span className="sr-only">정렬 순서</span>
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value);
            setPage(1);
          }}
        >
          <option value="recommended">추천순</option>
          <option value="newest">최신순</option>
          <option value="easy">쉬운 순</option>
          <option value="short">짧은 시간순</option>
        </select>
        <ChevronDown size={12} />
      </label>
    </div>
  );
}

"use client";
import { Button } from "@/components/ui/primitives";

import { Select } from "@/components/ui/select";
import { useState } from "react";
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
  const [expanded, setExpanded] = useState(false);
  const selected = [
    level !== "all" ? `난이도 ${level}` : "",
    language !== "all" ? LANGUAGES[language as keyof typeof LANGUAGES]?.label : "",
    status !== "all"
      ? { new: "미해결", "in-progress": "진행 중", solved: "해결 완료" }[status]
      : "",
    source !== "all" ? (source === "ai" ? "AI 생성" : "기본 문제") : "",
  ].filter(Boolean);
  return (
    <div className={`filter-bottom ${expanded ? "filters-expanded" : ""}`}>
      <Button
        className="secondary-button mobile-filter-toggle"
        aria-expanded={expanded}
        aria-controls="library-select-filters"
        onClick={() => setExpanded((value) => !value)}
      >
        상세 필터{selected.length ? ` (${selected.length})` : ""}
        <ChevronDown size={15} />
      </Button>
      {selected.length > 0 && (
        <div className="filter-summary">
          <span>{selected.join(" / ")}</span>
          <Button className="text-button" onClick={resetFilters}>
            초기화
          </Button>
        </div>
      )}
      <div className="select-filters" id="library-select-filters">
        {[
          {
            label: "난이도 필터",
            value: level,
            set: setLevel,
            options: [
              { value: "all", label: "모든 난이도" },
              ...LEVELS.map((value) => ({ value, label: `난이도 ${value}` })),
            ],
          },
          {
            label: "언어 필터",
            value: language,
            set: setLanguage,
            options: [
              { value: "all", label: "모든 언어" },
              ...Object.entries(LANGUAGES).map(([value, item]) => ({ value, label: item.label })),
            ],
          },
          {
            label: "풀이 상태 필터",
            value: status,
            set: setStatus,
            options: [
              { value: "all", label: "모든 상태" },
              { value: "new", label: "미해결" },
              { value: "in-progress", label: "진행 중" },
              { value: "solved", label: "해결 완료" },
            ],
          },
          {
            label: "문제 출처 필터",
            value: source,
            set: setSource,
            options: [
              { value: "all", label: "모든 출처" },
              { value: "curated", label: "기본 문제" },
              { value: "ai", label: "AI 생성" },
            ],
          },
        ].map((filter) => (
          <Select
            key={filter.label}
            label={filter.label}
            value={filter.value}
            options={filter.options}
            onValueChange={(value) => {
              filter.set(value);
              setPage(1);
            }}
          />
        ))}
        {hasFilters && (
          <Button className="text-button clear-filters" onClick={resetFilters}>
            <RotateCcw size={12} />
            초기화
          </Button>
        )}
      </div>
      <div className="sort-select">
        <Select
          label="정렬 순서"
          value={sort}
          onValueChange={(value) => {
            setSort(value);
            setPage(1);
          }}
          options={[
            { value: "recommended", label: "추천순" },
            { value: "newest", label: "최신순" },
            { value: "easy", label: "쉬운 순" },
            { value: "short", label: "짧은 시간순" },
          ]}
        />
      </div>
    </div>
  );
}

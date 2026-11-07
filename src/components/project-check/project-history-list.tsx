"use client";
import type { RefObject } from "react";
import { ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import {
  AppLink,
  Button,
  Disclosure,
  DisclosureSummary,
  Status,
  ToggleButton,
} from "@/components/ui/primitives";
import { dateLabel } from "@/lib/client-api";
import { displayName, displayOrigin } from "@/lib/project-check/display";
import type { CheckOverview } from "@/lib/project-check/types";

/** The saved projects beside the workspace, collapsed while one project is open. */
export function ProjectHistoryList({
  data,
  selected,
  rootId,
  panelRef,
  open,
  disabled,
  paging,
  pageError,
  onNew,
  onSelect,
  onMore,
}: {
  data: CheckOverview;
  selected: string | null;
  rootId?: string;
  panelRef: RefObject<HTMLDetailsElement | null>;
  open: boolean;
  disabled: boolean;
  paging: boolean;
  pageError: string;
  onNew: () => void;
  onSelect: (id: string) => void;
  onMore: () => void;
}) {
  const exhausted = data.usage.analysis.remaining === 0;
  return (
    <aside
      className="project-history"
      aria-label="내 프로젝트 점검 기록"
      hidden={data.checks.length === 0 && !selected && !data.nextCursor}
    >
      <Button className="secondary-button" disabled={disabled} onClick={onNew}>
        {exhausted ? "+ 다음 프로젝트 초안 작성" : "+ 새 프로젝트 점검"}
      </Button>
      <AppLink href={selected ? `/projects?class=${rootId ?? selected}` : "/projects"}>
        내 프로젝트 관리 →
      </AppLink>
      <Disclosure ref={panelRef} className="project-history-list" open={open}>
        <DisclosureSummary>
          <FolderOpen size={18} aria-hidden="true" />
          <strong>점검 기록</strong>
          <span className="project-history-count">{data.checks.length}</span>
          <ChevronDown size={16} className="project-history-chevron" aria-hidden="true" />
        </DisclosureSummary>
        <div className="project-history-items">
          {data.checks.length === 0 ? (
            <p>첫 분석을 마치면 여기에 기록이 쌓입니다.</p>
          ) : (
            data.checks.map((c) => (
              <ToggleButton
                key={c.id}
                aria-pressed={selected === c.id || rootId === c.id}
                disabled={disabled}
                onClick={() => onSelect(c.id)}
              >
                <span className="project-history-identity">
                  <strong>{displayName(c)}</strong>
                  <span>{displayOrigin(c)}</span>
                </span>
                <span className="project-history-state" data-complete={Boolean(c.review)}>
                  {c.review ? "평가 완료" : "답변 작성"}
                </span>
                <time dateTime={c.createdAt}>{dateLabel(c.createdAt)}</time>
                <ChevronRight size={16} aria-hidden="true" />
              </ToggleButton>
            ))
          )}
          {data.nextCursor && (
            <Button className="secondary-button" disabled={disabled || paging} onClick={onMore}>
              {paging ? "이전 기록 불러오는 중…" : "이전 기록 더 보기"}
            </Button>
          )}
          {pageError && <Status role="alert">{pageError}</Status>}
        </div>
      </Disclosure>
    </aside>
  );
}

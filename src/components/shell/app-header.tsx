"use client";
import type { Dispatch, SetStateAction } from "react";

import type { Workspace } from "@/lib/problem";
import { CircleHelp, Menu, RotateCcw, Sparkles } from "lucide-react";
interface AppHeaderProps {
  setMobileMenu: Dispatch<SetStateAction<boolean>>;
  initialProblemId: string | undefined;
  title: string;
  data: Workspace | null;
  refreshing: boolean;
  load: () => Promise<void>;
  setHelpOpen: Dispatch<SetStateAction<boolean>>;
  setGeneratorOpen: Dispatch<SetStateAction<boolean>>;
}
export function AppHeader({
  setMobileMenu,
  initialProblemId,
  title,
  data,
  refreshing,
  load,
  setHelpOpen,
  setGeneratorOpen,
}: AppHeaderProps) {
  return (
    <header className="topbar">
      <div className="topbar-path">
        <button
          className="mobile-menu icon-button"
          aria-label="메뉴 열기"
          onClick={() => setMobileMenu(true)}
        >
          <Menu size={21} />
        </button>
        <span className="mono path-root">workspace</span>
        <span>/</span>
        <strong>{initialProblemId ? "문제 풀이" : title}</strong>
      </div>
      <div className="topbar-actions">
        <span className="connection">
          <span className={`status-dot ${!data ? "waiting" : ""}`} />
          {data ? "저장소 연결됨" : "연결 중"}
        </span>
        {!initialProblemId && (
          <button
            className="icon-button"
            aria-label="문제와 기록 새로고침"
            disabled={refreshing}
            onClick={() => void load()}
          >
            <RotateCcw size={17} className={refreshing ? "spin" : ""} />
          </button>
        )}
        <button
          className="icon-button help-button"
          aria-label="사용 안내"
          onClick={() => setHelpOpen(true)}
        >
          <CircleHelp size={18} />
        </button>
        <button
          className="primary-button small"
          onClick={() => setGeneratorOpen(true)}
          disabled={!data}
        >
          <Sparkles size={15} />
          AI 문제 생성<span className="new-label">NEW</span>
        </button>
      </div>
    </header>
  );
}

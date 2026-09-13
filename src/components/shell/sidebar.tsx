"use client";
import type { Dispatch, SetStateAction } from "react";

import { DomainIcon } from "@/components/ui/problem-badges";
import { DOMAINS, type DomainId } from "@/lib/catalog";
import type { LibraryView } from "@/lib/library-state";
import type { ProblemSummary, Workspace } from "@/lib/problem";
import { Bookmark, History, LayoutGrid, Settings2, Terminal, X } from "lucide-react";
import Link from "next/link";
interface SidebarProps {
  mobileMenu: boolean;
  setMobileMenu: Dispatch<SetStateAction<boolean>>;
  initialProblemId: string | undefined;
  initialView: LibraryView;
  initialDomain: DomainId | "all";
  data: Workspace | null;
  saved: number;
  activeProblem: ProblemSummary | undefined;
  setSettingsOpen: Dispatch<SetStateAction<boolean>>;
}
export function Sidebar({
  mobileMenu,
  setMobileMenu,
  initialProblemId,
  initialView,
  initialDomain,
  data,
  saved,
  activeProblem,
  setSettingsOpen,
}: SidebarProps) {
  return (
    <aside
      className={`sidebar ${mobileMenu ? "open" : ""}`}
      aria-label="주 메뉴"
      onKeyDown={(event) => {
        if (!mobileMenu || event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("a, button:not(:disabled)"),
        );
        const first = controls[0],
          last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
    >
      <Link href="/" className="brand-logo">
        <span className="brand-symbol">
          <Terminal size={22} />
        </span>
        <span>
          CODE:FIT<span className="brand-cursor">_</span>
          <small>AI 시대의 코딩 근력</small>
        </span>
      </Link>
      <button
        className="sidebar-close icon-button"
        aria-label="메뉴 닫기"
        onClick={() => setMobileMenu(false)}
      >
        <X size={20} />
      </button>
      <div className="sidebar-workspace">
        <span className="workspace-avatar">F</span>
        <span>
          개인 연습실<small>Personal workspace</small>
        </span>
        <span className="status-dot" />
      </div>
      <nav>
        <span className="nav-caption">WORKSPACE</span>
        <Link
          className={`nav-item ${!initialProblemId && initialView === "library" && initialDomain === "all" ? "active" : ""}`}
          href="/"
        >
          <LayoutGrid size={17} />
          <span>문제 보관함</span>
          <small>{data?.stats.total ?? "—"}</small>
        </Link>
        <Link
          className={`nav-item ${!initialProblemId && initialView === "bookmarks" ? "active" : ""}`}
          href="/?view=bookmarks"
        >
          <Bookmark size={17} />
          <span>북마크</span>
          {saved > 0 && <small>{saved}</small>}
        </Link>
        <Link
          className={`nav-item ${!initialProblemId && initialView === "history" ? "active" : ""}`}
          href="/?view=history"
        >
          <History size={17} />
          <span>학습 기록</span>
        </Link>
        <span className="nav-caption domains-caption">
          EXPLORE BY DOMAIN <span>{DOMAINS.length}</span>
        </span>
        {DOMAINS.map((d) => (
          <Link
            key={d.id}
            href={`/?domain=${d.id}`}
            className={`nav-item domain-nav ${(!initialProblemId && initialDomain === d.id) || activeProblem?.domain === d.id ? "domain-active" : ""}`}
          >
            <DomainIcon domain={d.id} />
            <span>{d.label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note">
          <Terminal size={17} />
          <span>
            매일 한 문제,
            <br />
            <strong>코딩 근력을 지키는 시간.</strong>
          </span>
        </div>
        <button className="nav-item" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={17} />
          <span>환경 설정</span>
        </button>
        <div className="sidebar-version">
          <span>CODE:FIT v2.0</span>
          <span>
            <i />
            {data ? "CONNECTED" : "CONNECTING"}
          </span>
        </div>
      </div>
    </aside>
  );
}

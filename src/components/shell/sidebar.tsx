"use client";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { preferredDestinations } from "@/lib/learning-preference";
import type { Dispatch, SetStateAction } from "react";

import { DomainIcon } from "@/components/ui/problem-badges";
import { DOMAINS, type DomainId } from "@/lib/catalog";
import type { LibraryView } from "@/lib/library-state";
import type { ProblemSummary, Workspace } from "@/lib/problem";
import {
  ClipboardCheck,
  BookOpen,
  ShieldCheck,
  Bookmark,
  History,
  Home,
  LayoutGrid,
  Settings2,
  Terminal,
  UserRound,
  X,
} from "lucide-react";
import { BrandIcon } from "../ui/brand-icon";
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
  const { preference } = useLearningPreference();
  return (
    <aside
      className={`sidebar ${mobileMenu ? "open" : ""}`}
      aria-label="주 메뉴"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a")) setMobileMenu(false);
      }}
      onKeyDown={(event) => {
        if (!mobileMenu || event.key !== "Tab") return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>("a, button:not(:disabled), summary"),
        ).filter((element) => element.getClientRects().length > 0);
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
        <BrandIcon />
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
      <div className="sidebar-workspace" aria-label="현재 이용 상태">
        <strong>{data?.account.user?.name || "로그인 없이 이용 중"}</strong>
        <small>
          {data?.account.user
            ? "계정에 연결된 학습 기록"
            : "로그인 없이도 학습 기록을 확인할 수 있어요."}
        </small>
        {!data?.account.user && (
          <Link className="workspace-login" href="/login">
            <UserRound size={15} aria-hidden="true" />
            로그인 / 가입
          </Link>
        )}
      </div>
      <nav>
        <span className="nav-caption">나의 연습실</span>
        <Link
          className={`nav-item ${!initialProblemId && initialView === "library" && initialDomain === "all" ? "active" : ""}`}
          href="/"
        >
          <Home size={17} />
          <span>홈</span>
        </Link>
        {preferredDestinations(preference).map((item) => (
          <Link className="nav-item" href={item.href} key={item.href}>
            {item.href === "/learn" ? (
              <BookOpen size={17} />
            ) : item.href === "/handoff" ? (
              <Terminal size={17} />
            ) : item.href === "/security-check" ? (
              <ShieldCheck size={17} />
            ) : (
              <ClipboardCheck size={17} />
            )}
            <span>{item.label}</span>
          </Link>
        ))}
        <Link className="nav-item" href="/#learning-preference">
          <Settings2 size={17} />
          <span>내 시작점 변경</span>
        </Link>
        <a
          className="nav-item"
          href={
            !initialProblemId && initialView === "library" && initialDomain === "all"
              ? "#problem-library"
              : "/#problem-library"
          }
        >
          <LayoutGrid size={17} />
          <span>문제 보관함</span>
          <small>{data?.stats.total ?? "—"}</small>
        </a>
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
          <span>내 학습 기록</span>
        </Link>
        <details
          className="domain-disclosure"
          open={initialDomain !== "all" || Boolean(activeProblem)}
        >
          <summary>
            분야별 문제 <span>{DOMAINS.length}</span>
          </summary>
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
        </details>
      </nav>
      <div className="sidebar-bottom">
        {data?.account.user && (
          <Link className="nav-item" href="/profile">
            <UserRound size={17} />
            <span>내 프로필</span>
          </Link>
        )}
        <div className="sidebar-note">
          <Terminal size={17} />
          <span>
            매일 한 문제,
            <br />
            <strong>코딩 근력을 지키는 시간.</strong>
          </span>
        </div>
        <button
          className="nav-item"
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            setSettingsOpen(true);
          }}
        >
          <Settings2 size={17} />
          <span>환경 설정</span>
        </button>
        <div className="sidebar-version">
          <span>CODE:FIT</span>
          <span>
            <i />
            {data ? "CONNECTED" : "CONNECTING"}
          </span>
        </div>
      </div>
    </aside>
  );
}

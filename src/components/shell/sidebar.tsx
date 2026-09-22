"use client";
import { Button } from "@/components/ui/primitives";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { WorkspaceNavigation } from "@/components/navigation/workspace-navigation";
import type { Dispatch, SetStateAction } from "react";

import type { DomainId } from "@/lib/catalog";
import type { LibraryView } from "@/lib/library-state";
import type { ProblemSummary, Workspace } from "@/lib/problem";
import { Settings2, UserRound, X } from "lucide-react";
import { BrandIcon } from "../ui/brand-icon";
import { AppLink as Link } from "@/components/ui/primitives";
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
  const { profile, type } = useLearningPreference();
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
          event.currentTarget.querySelectorAll<HTMLElement>(
            "a, button:not(:disabled), select:not(:disabled), summary",
          ),
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
          <small>배우고, 이해하고, 검증하기</small>
        </span>
      </Link>
      <Button
        className="sidebar-close icon-button"
        aria-label="메뉴 닫기"
        onClick={() => setMobileMenu(false)}
      >
        <X size={20} />
      </Button>
      <WorkspaceNavigation
        initialProblemId={initialProblemId}
        initialView={initialView}
        initialDomain={initialDomain}
        saved={saved}
        activeProblem={activeProblem}
      />
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
      <div className="sidebar-bottom">
        {data?.account.user && (
          <Link className="nav-item" href="/profile">
            <UserRound size={17} />
            <span>내 프로필</span>
          </Link>
        )}
        <div className="sidebar-note">
          <span>
            {profile.name}
            <br />
            <strong>
              {type === "ai"
                ? "업무에 필요한 AI 활용법 배우기"
                : type === "code"
                  ? "직접 풀고 실행하며 배우기"
                  : "내 서비스의 설계와 동작 확인하기"}
            </strong>
          </span>
        </div>
        {type === "code" && (
          <Button
            className="nav-item"
            onClick={(event) => {
              // Safari does not focus buttons on pointer activation; retain a dialog return target.
              event.currentTarget.focus();
              setSettingsOpen(true);
            }}
          >
            <Settings2 size={17} />
            <span>환경 설정</span>
          </Button>
        )}
      </div>
    </aside>
  );
}

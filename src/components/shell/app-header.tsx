"use client";
import { Button } from "@/components/ui/primitives";
import { PreferenceChangeButton } from "@/components/library/learning-preference";
import { AppLink as Link } from "@/components/ui/primitives";
import type { Dispatch, SetStateAction } from "react";

import type { Workspace } from "@/lib/problem";
import { BrandIcon } from "@/components/ui/brand-icon";
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
        <Button
          className="mobile-menu icon-button"
          aria-label="메뉴 열기"
          onClick={(event) => {
            event.currentTarget.focus();
            setMobileMenu(true);
          }}
        >
          <Menu size={21} />
        </Button>
        <Link className="path-root" href="/" aria-label="CODE:FIT 홈">
          <BrandIcon size={30} />
          <span>CODE:FIT</span>
        </Link>
        <span>/</span>
        <strong>{initialProblemId ? "문제 풀이" : title === "문제 보관함" ? "홈" : title}</strong>
      </div>
      <div className="topbar-actions">
        <PreferenceChangeButton />
        {!initialProblemId && (
          <Button
            className="icon-button"
            aria-label="문제와 기록 새로고침"
            disabled={refreshing}
            onClick={() => void load()}
          >
            <RotateCcw size={17} className={refreshing ? "spin" : ""} />
          </Button>
        )}
        <Button
          className="icon-button help-button"
          aria-label="사용 안내"
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            setHelpOpen(true);
          }}
        >
          <CircleHelp size={18} />
        </Button>
        <Button
          className="secondary-button small"
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            setGeneratorOpen(true);
          }}
          disabled={!data}
        >
          <Sparkles size={15} />
          AI 문제 생성
        </Button>
      </div>
    </header>
  );
}

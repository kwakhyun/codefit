"use client";
import { Button } from "@/components/ui/primitives";
import { PreferenceChangeButton } from "@/components/library/learning-preference";
import { AppLink as Link } from "@/components/ui/primitives";
import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { Modal } from "@/components/ui/modal";

import type { Workspace } from "@/lib/problem";
import { BrandIcon } from "@/components/ui/brand-icon";
import { CircleHelp, Menu, MoreHorizontal, RotateCcw, Sparkles } from "lucide-react";
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
  const { type } = useLearningPreference();
  const [quickOpen, setQuickOpen] = useState(false);
  const quickTrigger = useRef<HTMLButtonElement>(null);
  function closeQuick() {
    setQuickOpen(false);
    requestAnimationFrame(() => quickTrigger.current?.focus());
  }
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
        <Button
          ref={quickTrigger}
          className="icon-button mobile-header-more"
          aria-label="빠른 작업"
          aria-haspopup="dialog"
          onClick={() => setQuickOpen(true)}
        >
          <MoreHorizontal size={22} aria-hidden="true" />
        </Button>
        <Modal
          open={quickOpen}
          onClose={closeQuick}
          title="빠른 작업"
          className="header-quick-dialog"
        >
          <div className="header-quick-actions">
            {type === "code" && (
              <Button
                disabled={!data}
                onClick={() => {
                  setQuickOpen(false);
                  quickTrigger.current?.focus();
                  setGeneratorOpen(true);
                }}
              >
                <Sparkles size={20} /> AI 문제 생성
              </Button>
            )}
            <Button
              onClick={() => {
                setQuickOpen(false);
                quickTrigger.current?.focus();
                setHelpOpen(true);
              }}
            >
              <CircleHelp size={20} /> 사용 안내
            </Button>
            {!initialProblemId && (
              <Button
                disabled={refreshing}
                onClick={() => {
                  closeQuick();
                  void load();
                }}
              >
                <RotateCcw size={20} /> 문제와 기록 새로고침
              </Button>
            )}
          </div>
        </Modal>
        {!initialProblemId && (
          <Button
            className="icon-button desktop-header-action"
            aria-label="문제와 기록 새로고침"
            disabled={refreshing}
            onClick={() => void load()}
          >
            <RotateCcw size={17} className={refreshing ? "spin" : ""} />
          </Button>
        )}
        <Button
          className="icon-button help-button desktop-header-action"
          aria-label="사용 안내"
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            setHelpOpen(true);
          }}
        >
          <CircleHelp size={18} />
        </Button>
        {type === "code" && (
          <Button
            className="secondary-button small desktop-header-action"
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
        )}
      </div>
    </header>
  );
}

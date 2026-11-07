"use client";
import { Button } from "@/components/ui/primitives";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { WorkspaceNavigation } from "@/components/navigation/workspace-navigation";
import { Settings2 } from "lucide-react";
import { BrandIcon } from "../ui/brand-icon";
import { AppLink as Link } from "@/components/ui/primitives";
import { AccountStatus, type ShellAccount } from "./account-status";
import type { NavInfo } from "./shell-context";

/** Shared by the desktop sidebar and the mobile menu dialog. */
export function SidebarContent({
  account,
  navInfo,
  onSettings,
}: {
  account: Promise<ShellAccount>;
  navInfo: NavInfo;
  onSettings: () => void;
}) {
  const { profile, type } = useLearningPreference();
  return (
    <>
      <Link href="/" className="brand-logo">
        <BrandIcon />
        <span>
          CODE:FIT<span className="brand-cursor">_</span>
          <small>배우고, 이해하고, 검증하기</small>
        </span>
      </Link>
      <WorkspaceNavigation navInfo={navInfo} />
      <AccountStatus account={account} />
      <div className="sidebar-bottom">
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
        <Button
          className="nav-item"
          aria-haspopup="dialog"
          onClick={(event) => {
            // Safari does not focus buttons on pointer activation; retain a dialog return target.
            event.currentTarget.focus();
            onSettings();
          }}
        >
          <Settings2 size={17} aria-hidden="true" />
          <span>환경 설정</span>
        </Button>
      </div>
    </>
  );
}

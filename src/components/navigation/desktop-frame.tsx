"use client";

import { usePathname } from "next/navigation";
import { UserRound } from "lucide-react";
import { AppLink as Link } from "@/components/ui/primitives";
import { BrandIcon } from "@/components/ui/brand-icon";
import { WorkspaceNavigation } from "./workspace-navigation";

const workspaceRoutes = [
  "/projects",
  "/project-check",
  "/project-practice",
  "/security-check",
  "/learn",
  "/handoff",
];

/** Keep product navigation stable while each page owns its content and mobile menu. */
export function DesktopFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const workspace = workspaceRoutes.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
  if (!workspace) return children;
  return (
    <div className="desktop-frame">
      <Link className="skip-link" href="#main-content">
        본문으로 이동
      </Link>
      <aside className="sidebar desktop-sidebar" aria-label="주 메뉴">
        <Link href="/" className="brand-logo">
          <BrandIcon />
          <span>
            CODE:FIT<span className="brand-cursor">_</span>
            <small>배우고, 이해하고, 검증하기</small>
          </span>
        </Link>
        <WorkspaceNavigation />
        <div className="sidebar-bottom">
          <Link className="nav-item" href="/profile">
            <UserRound size={17} />
            <span>내 계정과 기록</span>
          </Link>
        </div>
      </aside>
      <div className="desktop-content">{children}</div>
    </div>
  );
}

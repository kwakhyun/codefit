"use client";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { AppHeader } from "./app-header";
import { AppFooter } from "./app-footer";
import { HelpDialog } from "./help-dialog";
import { OfflineBanner } from "./offline-banner";
import { SettingsDialog } from "./settings-dialog";
import { SidebarContent } from "./sidebar";
import type { ShellAccount } from "./account-status";
import { ShellContext, type NavInfo } from "./shell-context";

const DESKTOP = "(min-width: 1024px)";

function typing(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  return Boolean(
    element &&
    (element.matches("input, textarea, select") ||
      element.isContentEditable ||
      element.closest(".monaco-editor")),
  );
}

/**
 * One frame for every route: sidebar (a dialog below 1024px), header, notices and footer.
 * Pages render only their own <main id="main-content">.
 */
export function AppShell({
  children,
  account,
}: {
  children: ReactNode;
  account: Promise<ShellAccount>;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [navInfo, setNavInfo] = useState<NavInfo>({});
  const [actionsSlot, setActionsSlot] = useState<HTMLDivElement | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  // The coding home and problem screens lay out their own full-width areas.
  const practice = pathname === "/" || pathname.startsWith("/problems/");
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const shell = useMemo(
    () => ({ openSettings, openHelp, setFocusMode, setNavInfo, actionsSlot }),
    [openSettings, openHelp, actionsSlot],
  );
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.isComposing || event.ctrlKey || event.metaKey || event.altKey)
        return;
      if (typing(event.target) || document.querySelector("dialog[open]")) return;
      event.preventDefault();
      setHelpOpen(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    // Widening the window to the desktop layout replaces the menu dialog with the sidebar.
    const media = window.matchMedia(DESKTOP);
    const close = () => {
      if (media.matches) setMenuOpen(false);
    };
    media.addEventListener("change", close);
    return () => media.removeEventListener("change", close);
  }, []);
  function closeMenu() {
    setMenuOpen(false);
    requestAnimationFrame(() => menuTrigger.current?.focus());
  }
  return (
    <ShellContext.Provider value={shell}>
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          // Pages own <main>; make it focusable so assistive technology lands inside it.
          const main = document.getElementById("main-content");
          if (!main) return;
          event.preventDefault();
          if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
          main.focus();
          main.scrollIntoView();
        }}
      >
        본문으로 이동
      </a>
      <div
        className={`lab-shell app-shell${focusMode ? " focus-mode" : ""}`}
        data-route={pathname.startsWith("/problems/") ? "problem" : undefined}
      >
        <aside className="sidebar" aria-label="주 메뉴">
          <SidebarContent account={account} navInfo={navInfo} onSettings={openSettings} />
        </aside>
        <div className="main-shell">
          <AppHeader
            menuOpen={menuOpen}
            menuTrigger={menuTrigger}
            onOpenMenu={() => setMenuOpen(true)}
            onHelp={openHelp}
            actionsSlot={setActionsSlot}
          />
          <OfflineBanner />
          <div className={`app-content ${practice ? "practice-frame" : "page-frame"}`}>
            {children}
          </div>
          <AppFooter />
        </div>
      </div>
      <Modal
        open={menuOpen}
        onClose={closeMenu}
        title="메뉴"
        closeLabel="메뉴 닫기"
        className="sidebar-drawer"
      >
        {menuOpen && (
          <div
            className="drawer-content"
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            <SidebarContent
              account={account}
              navInfo={navInfo}
              onSettings={() => {
                setMenuOpen(false);
                // The menu dialog closes first; settings then returns focus to the menu button.
                requestAnimationFrame(() => {
                  menuTrigger.current?.focus();
                  setSettingsOpen(true);
                });
              }}
            />
          </div>
        )}
      </Modal>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </ShellContext.Provider>
  );
}

"use client";
import { Button } from "@/components/ui/primitives";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { FitMascot } from "./fit-mascot";

const GuidePanel = dynamic(() => import("./guide-panel"), { ssr: false });
const dismissedKey = "codefit:guide-intro-dismissed:v1";
const subscribe = (listener: () => void) => {
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
};
function isDismissed() {
  try {
    return localStorage.getItem(dismissedKey) === "1";
  } catch {
    return false;
  }
}

export function GuideWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const storedDismissal = useSyncExternalStore(subscribe, isDismissed, () => true);
  const launcher = useRef<HTMLButtonElement>(null);
  // The labelled launcher only accompanies the first-visit invitation on home. Everywhere else
  // it stays a small icon so it does not cover list rows, cards or a page's primary action.
  const inviting = pathname === "/" && !dismissed && !storedDismissal && !open;
  function dismissIntro() {
    setDismissed(true);
    try {
      localStorage.setItem(dismissedKey, "1");
    } catch {
      /* Browsing without storage still works. */
    }
  }
  function close() {
    setOpen(false);
    requestAnimationFrame(() => launcher.current?.focus());
  }
  const panel = loaded && <GuidePanel open={open} onClose={close} />;
  // The editor fills the viewport with its own actions and keeps usage help in its header.
  if (pathname.startsWith("/problems/")) return panel;
  return (
    <>
      <aside className={`guide-launcher ${inviting ? "" : "is-compact"}`} aria-label="시작 가이드">
        {inviting && (
          <div className="guide-intro-hint">
            <Button
              onClick={() => {
                dismissIntro();
                setLoaded(true);
                setOpen(true);
              }}
            >
              처음이라면?
              <br />
              <strong>시작할 곳을 찾아드려요</strong>
            </Button>
            <Button
              className="guide-dismiss"
              aria-label="첫 방문 안내 숨기기"
              onClick={dismissIntro}
            >
              <X size={14} />
            </Button>
          </div>
        )}
        <Button
          ref={launcher}
          className="guide-launch-button"
          aria-label="핏 시작 가이드 열기"
          aria-haspopup="dialog"
          aria-expanded={open}
          title={inviting ? undefined : "시작 가이드"}
          onClick={() => {
            dismissIntro();
            setLoaded(true);
            setOpen(true);
          }}
        >
          <FitMascot size={inviting ? 64 : 32} />
          {inviting && <span>시작 가이드</span>}
        </Button>
      </aside>
      {panel}
    </>
  );
}

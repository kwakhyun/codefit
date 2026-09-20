"use client";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { X, Minimize2 } from "lucide-react";
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
  const practicing =
    pathname.startsWith("/problems/") ||
    pathname.startsWith("/learn/") ||
    pathname === "/project-check";
  const showInvitation = ["/", "/learn", "/handoff"].includes(pathname);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [compact, setCompact] = useState(false);
  const compactMode = compact || practicing;
  const storedDismissal = useSyncExternalStore(subscribe, isDismissed, () => true);
  const launcher = useRef<HTMLButtonElement>(null);
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
  return (
    <>
      <aside
        className={`guide-launcher ${compactMode ? "is-compact" : ""}`}
        aria-label="시작 가이드"
      >
        {showInvitation && !dismissed && !storedDismissal && !open && !compactMode && (
          <div className="guide-intro-hint">
            <button
              onClick={() => {
                dismissIntro();
                setLoaded(true);
                setOpen(true);
              }}
            >
              처음이라면?
              <br />
              <strong>시작할 곳을 찾아드려요</strong>
            </button>
            <button
              className="guide-dismiss"
              aria-label="첫 방문 안내 숨기기"
              onClick={dismissIntro}
            >
              <X size={14} />
            </button>
          </div>
        )}
        <button
          ref={launcher}
          className="guide-launch-button"
          aria-label="핏 시작 가이드 열기"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => {
            setCompact(false);
            dismissIntro();
            setLoaded(true);
            setOpen(true);
          }}
        >
          <FitMascot size={compactMode ? 32 : 64} />
          {!compactMode && <span>시작 가이드</span>}
        </button>
        {!compactMode && !open && (
          <button
            className="guide-collapse"
            aria-label="시작 가이드 작게 보기"
            onClick={() => {
              dismissIntro();
              setCompact(true);
              requestAnimationFrame(() => launcher.current?.focus());
            }}
          >
            <Minimize2 size={15} />
          </button>
        )}
      </aside>
      {loaded && <GuidePanel open={open} onClose={close} />}
    </>
  );
}

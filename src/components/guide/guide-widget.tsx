"use client";
import { Button } from "@/components/ui/primitives";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { FitMascot } from "./fit-mascot";

const GuidePanel = dynamic(() => import("./guide-panel"), { ssr: false });
/** Set once the invitation has been shown, so each browser sees it at most once. */
const seenKey = "codefit:guide-intro-dismissed:v1";
const INVITATION_MS = 8000;
const INTERACTIVE =
  "a, button, input, select, textarea, label, summary, [role='button'], [tabindex]:not([tabindex='-1'])";

// The invitation's visibility for this page load, shared across client navigations.
let intro: "unknown" | "visible" | "hidden" = "unknown";
const listeners = new Set<() => void>();
function hideIntro() {
  intro = "hidden";
  for (const listener of listeners) listener();
}
function introSnapshot() {
  if (intro === "unknown") {
    try {
      intro = localStorage.getItem(seenKey) === "1" ? "hidden" : "visible";
    } catch {
      intro = "hidden";
    }
  }
  return intro;
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function markSeen() {
  try {
    localStorage.setItem(seenKey, "1");
  } catch {
    /* Browsing without storage still works; the invitation hides for this load. */
  }
}

/** True when an interactive element sits under the launcher's resting centre or edges. */
function coversContent(launcher: HTMLElement) {
  // Offsets ignore the tuck transform, so the check does not flip once the launcher moves.
  const left = launcher.offsetLeft;
  const top = launcher.offsetTop;
  const points = [
    [left + launcher.offsetWidth / 2, top + launcher.offsetHeight / 2],
    [left + 4, top + 4],
    [left + 4, top + launcher.offsetHeight - 4],
  ];
  return points.some(([x, y]) =>
    document
      .elementsFromPoint(x, y)
      .some((element) => !launcher.contains(element) && element.closest(INTERACTIVE)),
  );
}

export function GuideWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [tucked, setTucked] = useState(false);
  const state = useSyncExternalStore(subscribe, introSnapshot, () => "hidden" as const);
  const launcher = useRef<HTMLButtonElement>(null);
  const aside = useRef<HTMLElement>(null);
  // The labelled invitation appears once, on home. Everywhere else the launcher is an icon.
  const inviting = pathname === "/" && state === "visible" && !open;
  useEffect(() => {
    if (!inviting) return;
    markSeen();
    const timer = setTimeout(hideIntro, INVITATION_MS);
    window.addEventListener("scroll", hideIntro, { once: true, passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener("scroll", hideIntro);
    };
  }, [inviting]);
  useEffect(() => {
    // Step aside while the page scrolls, and tuck in at rest when it would cover a control.
    let timer: ReturnType<typeof setTimeout> | undefined;
    function settle() {
      setScrolling(false);
      const element = aside.current;
      setTucked(
        Boolean(element && !element.contains(document.activeElement) && coversContent(element)),
      );
    }
    function onScroll() {
      setScrolling(true);
      clearTimeout(timer);
      timer = setTimeout(settle, 600);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    const initial = setTimeout(settle, 600);
    return () => {
      clearTimeout(timer);
      clearTimeout(initial);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);
  function openGuide() {
    hideIntro();
    markSeen();
    setLoaded(true);
    setOpen(true);
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
      <aside
        ref={aside}
        className={`guide-launcher ${inviting ? "" : "is-compact"}`}
        aria-label="시작 가이드"
        data-scrolling={(scrolling && !inviting) || undefined}
        data-tucked={(tucked && !inviting && !scrolling) || undefined}
      >
        {inviting && (
          <div className="guide-intro-hint">
            <Button onClick={openGuide}>
              처음이라면?
              <br />
              <strong>시작할 곳을 찾아드려요</strong>
            </Button>
            <Button className="guide-dismiss" aria-label="첫 방문 안내 숨기기" onClick={hideIntro}>
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
          title="시작 가이드"
          onClick={openGuide}
        >
          <FitMascot size={32} />
        </Button>
      </aside>
      {panel}
    </>
  );
}

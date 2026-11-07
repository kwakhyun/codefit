"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  isLongWait,
  LONG_WAIT_MS,
  requestSnapshot,
  serverRequestSnapshot,
  subscribeRequests,
} from "@/lib/request-progress";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { Progress } from "./primitives";

/**
 * Route fade plus a shared progress bar for requests that are still pending after a short
 * delay. Autosave and polling pass `track: false` and never reach it. One polite region
 * announces only the start of a long wait and a failure, not every count change.
 */
export function RouteFeedback() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { type, hasChosen } = useLearningPreference();
  // Search text and filters update the URL without leaving the current screen.
  const view = ["view", "domain", "attempt"].map((key) => search.get(key) || "");
  const destination = JSON.stringify([pathname, ...view, type, hasChosen]);
  const previous = useRef(destination);
  const requests = useSyncExternalStore(subscribeRequests, requestSnapshot, serverRequestSnapshot);
  const [now, setNow] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const shown = useRef(false);
  useEffect(() => {
    if (previous.current === destination) return;
    previous.current = destination;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = document.getElementById("main-content");
    const animation = main?.animate([{ opacity: 0.45 }, { opacity: 1 }], {
      duration: 220,
      easing: "ease-out",
    });
    return () => animation?.cancel();
  }, [destination]);
  useEffect(() => {
    if (!requests.active) return;
    // Re-render once the batch has waited long enough to be worth showing.
    const timer = setTimeout(
      () => setNow(Date.now()),
      Math.max(0, requests.startedAt + LONG_WAIT_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [requests.active, requests.startedAt]);
  const visible = isLongWait(requests, Math.max(now, requests.startedAt));
  useEffect(() => {
    if (visible && !shown.current) {
      shown.current = true;
      const timer = setTimeout(() => setAnnouncement("응답을 기다리고 있습니다."), 0);
      return () => clearTimeout(timer);
    }
    if (requests.active || !shown.current) return;
    shown.current = false;
    const message = requests.failed
      ? "요청을 완료하지 못했습니다. 화면의 안내를 확인해 주세요."
      : "";
    const timer = setTimeout(() => setAnnouncement(message), 0);
    return () => clearTimeout(timer);
  }, [visible, requests.active, requests.failed]);
  return (
    <>
      <span className="sr-only" role="status">
        {announcement}
      </span>
      {visible && (
        <aside className="ui-network-progress" aria-label="데이터 요청 진행 상황">
          <Progress
            max={requests.total}
            value={requests.settled || undefined}
            aria-label="응답 처리 진행률"
          />
          <span aria-hidden="true">
            {requests.settled
              ? `응답 처리 ${requests.settled}/${requests.total}`
              : "응답을 기다리는 중"}
          </span>
        </aside>
      )}
    </>
  );
}

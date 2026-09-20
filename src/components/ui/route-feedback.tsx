"use client";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { requestSnapshot, serverRequestSnapshot, subscribeRequests } from "@/lib/request-progress";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { Progress } from "./primitives";
export function RouteFeedback() {
  const pathname = usePathname();
  const search = useSearchParams();
  const { type, hasChosen } = useLearningPreference();
  // Search text and filters update the URL without leaving the current screen.
  const view = ["view", "domain", "attempt"].map((key) => search.get(key) || "");
  const destination = JSON.stringify([pathname, ...view, type, hasChosen]);
  const previous = useRef(destination);
  const requests = useSyncExternalStore(subscribeRequests, requestSnapshot, serverRequestSnapshot);
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
  if (!requests.active) return null;
  return (
    <aside className="ui-network-progress" aria-label="데이터 요청 진행 상황">
      <Progress
        max={requests.total}
        value={requests.settled || undefined}
        aria-label="응답 처리 진행률"
      />
      <span role="status">
        {requests.settled
          ? `응답 처리 ${requests.settled}/${requests.total}`
          : "응답을 기다리는 중"}
      </span>
    </aside>
  );
}

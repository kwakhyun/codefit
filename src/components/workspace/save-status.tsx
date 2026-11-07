"use client";
import { Check, LoaderCircle, Save } from "lucide-react";
import { useState } from "react";
import type { DraftStatus } from "@/lib/drafts/draft-controller";

const LABELS: Record<DraftStatus["kind"], string> = {
  saved: "저장됨",
  saving: "저장 중",
  local: "저장 대기",
  failed: "저장 실패",
  offline: "오프라인 보관",
  conflict: "충돌 · 초안 보관",
  resolving: "충돌 확인 중",
};

/** Text for the screen-reader announcement, or null to keep the previous one.
 * Routine autosave cycles stay silent; failures and the first save after them are announced. */
export function saveAnnouncement(
  state: DraftStatus["kind"],
  localSaved: boolean,
  failedBefore: boolean,
): { text: string; failed: boolean } | null {
  if (!localSaved)
    return { text: "브라우저 보관에 실패했습니다. 창을 닫기 전에 저장해 주세요.", failed: true };
  if (state === "failed")
    return { text: "서버 저장에 실패했습니다. 지금 저장을 눌러 다시 시도해 주세요.", failed: true };
  if (state === "offline")
    return {
      text: "오프라인 상태라 이 브라우저에 보관했습니다. 연결되면 다시 저장합니다.",
      failed: true,
    };
  if (state === "saved" && failedBefore)
    return { text: "코드를 다시 저장했습니다.", failed: false };
  return null;
}

export function SaveStatus({
  state,
  localSaved,
}: {
  state: DraftStatus["kind"];
  localSaved: boolean;
}) {
  const key = `${state}:${localSaved}`;
  const [announced, setAnnounced] = useState(() => ({
    key,
    ...(saveAnnouncement(state, localSaved, false) ?? { text: "", failed: false }),
  }));
  if (announced.key !== key) {
    const next = saveAnnouncement(state, localSaved, announced.failed);
    setAnnounced(next ? { key, ...next } : { ...announced, key });
  }
  return (
    <>
      <span className={`save-indicator ${state === "failed" || !localSaved ? "failed" : ""}`}>
        {state === "saving" ? (
          <LoaderCircle size={12} className="spin" />
        ) : state === "saved" ? (
          <Check size={12} />
        ) : (
          <Save size={12} />
        )}
        {!localSaved ? "브라우저 보관 실패" : LABELS[state]}
      </span>
      <span className="sr-only" role="status">
        {announced.text}
      </span>
    </>
  );
}

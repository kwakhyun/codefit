"use client";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { Status } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/primitives";
import { useEffect, useState } from "react";

/** `startedAt` continues the elapsed time of a request started before this screen opened. */
export function RequestStatus({ label, startedAt }: { label: string; startedAt?: number }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = startedAt ?? Date.now();
    const tick = () => setSeconds(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  return (
    <aside className="project-request-status" aria-label="AI 요청 상태">
      <strong>{label}</strong>
      <Progress aria-label="AI 응답 대기 중" />
      <ScreenSkeleton variant="response" label="답변 내용 준비 중" />
      <span aria-hidden="true">{seconds}초 경과</span>
      <Status role="status">
        {seconds < 30
          ? "응답을 기다리고 있습니다. 같은 요청을 다시 누르지 않아도 됩니다."
          : "응답이 늦어지고 있습니다. 연결이 끊겨도 다시 요청하기 전에 저장된 결과를 확인할 수 있습니다."}
      </Status>
    </aside>
  );
}

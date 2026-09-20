"use client";
import { Status } from "@/components/ui/primitives";
import { Progress } from "@/components/ui/primitives";
import { useEffect, useState } from "react";
import { SANDBOX_TIMEOUT_MS } from "@/lib/handoff/runner";

export function ExecutionWait({ paired }: { paired: boolean }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <Status className="learn-fineprint" role="status" aria-live="off">
      <Progress aria-label="코드 실행 응답 대기 중" />
      실행 환경을 준비하고 브라우저에서 코드를 실행합니다. {seconds}초 경과.
      {paired ? " 원본과 수정 코드를 차례로 실행하며, 각각" : " 준비 시간을 포함해"}{" "}
      {SANDBOX_TIMEOUT_MS / 1000}초를 넘기면 중단합니다. 취소해도 작성한 내용은 유지됩니다.
    </Status>
  );
}

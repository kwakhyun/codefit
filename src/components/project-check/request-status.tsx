"use client";
import { useEffect, useState } from "react";

export function RequestStatus({ label }: { label: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, []);
  return (
    <aside className="project-request-status" aria-label="AI 요청 상태">
      <strong>{label}</strong>
      <span aria-hidden="true">{seconds}초 경과</span>
      <p role="status">
        {seconds < 30
          ? "응답을 기다리고 있습니다. 같은 요청을 다시 누르지 않아도 됩니다."
          : "응답이 늦어지고 있습니다. 연결이 끊겨도 다시 요청하기 전에 저장된 결과를 확인할 수 있습니다."}
      </p>
    </aside>
  );
}

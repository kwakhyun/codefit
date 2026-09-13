"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, errorMessage } from "@/lib/client-api";
import type { AiUsage as Usage } from "@/lib/ai-telemetry";
import { dateLabel } from "@/lib/client-api";
export function AiUsage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api<Usage>("/api/usage", { signal: controller.signal })
      .then((value) => {
        setUsage(value);
        setError("");
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(errorMessage(err));
      });
    return () => controller.abort();
  }, [retry]);
  return (
    <section className="usage-panel" aria-label="내 AI 이용 현황">
      <h3>내 AI 이용 현황</h3>
      {error ? (
        <p role="alert">
          {error}{" "}
          <button className="text-button" onClick={() => setRetry(retry + 1)}>
            다시 확인
          </button>
        </p>
      ) : !usage ? (
        <p role="status">이용 현황 확인 중…</p>
      ) : (
        <>
          <div className="usage-grid">
            {(["generate", "review"] as const).map((kind) => (
              <div key={kind}>
                <span>{kind === "generate" ? "문제 생성" : "풀이 검토"}</span>
                <strong>
                  {kind === "generate" && !usage.canGenerate
                    ? "로그인 필요"
                    : usage.remaining[kind]}
                  {(kind !== "generate" || usage.canGenerate) && (
                    <small> / {usage.allowance[kind]}회 남음</small>
                  )}
                </strong>
                <small>
                  {kind === "generate"
                    ? "매일 00:00 KST 갱신 · 실패 시 횟수 반환"
                    : usage.resetsAt[kind]
                      ? `${dateLabel(usage.resetsAt[kind]!)} 갱신`
                      : "첫 이용부터 24시간"}
                </small>
              </div>
            ))}
          </div>
          <p className="muted">
            최근 30일 {usage.last30Days.requests}회 요청, 평균{" "}
            {(usage.last30Days.averageLatencyMs / 1000).toFixed(1)}초. 입력{" "}
            {usage.last30Days.inputTokens.toLocaleString()} / 출력{" "}
            {usage.last30Days.outputTokens.toLocaleString()} 토큰.
          </p>
        </>
      )}
      <p className="muted">
        무료 공개 연습실입니다. 접속망과 서비스 전체의 공용 한도에 먼저 도달할 수 있습니다. AI
        한도와 관계없이 기존 문제와 힌트는 이용할 수 있습니다.
      </p>
      <Link className="text-button" href="/quality">
        AI 검토 방식과 검증 결과 보기 →
      </Link>
    </section>
  );
}

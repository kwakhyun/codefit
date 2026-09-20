"use client";
import { Card, Status, Button } from "@/components/ui/primitives";
import { useEffect, useState } from "react";
import { AppLink as Link } from "@/components/ui/primitives";
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
    <Card as="section" className="usage-panel" aria-label="내 AI 이용 현황">
      <h3>내 AI 이용 현황</h3>
      {error ? (
        <Status role="alert">
          {error}{" "}
          <Button className="text-button" onClick={() => setRetry(retry + 1)}>
            다시 확인
          </Button>
        </Status>
      ) : !usage ? (
        <Status role="status">이용 현황 확인 중…</Status>
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
                    ? "매일 한국 시간 자정에 초기화 · 생성 실패 시 횟수 복구"
                    : usage.resetsAt[kind]
                      ? `${dateLabel(usage.resetsAt[kind]!)} 갱신`
                      : "첫 이용부터 24시간"}
                </small>
              </div>
            ))}
          </div>
        </>
      )}
      <p className="muted">
        모든 기능은 무료로 이용할 수 있습니다. 개인에게 남은 횟수가 있어도 같은 네트워크나 서비스
        전체의 이용 한도에 도달하면 AI 요청이 일시적으로 제한될 수 있습니다. 기존 문제와 힌트는 계속
        이용할 수 있습니다.
      </p>
      <Link className="text-button" href="/quality">
        AI 검토 방식과 검증 결과 보기 →
      </Link>
    </Card>
  );
}

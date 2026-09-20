"use client";
import { LoadingState } from "@/components/ui/loading-state";
import { Status, Button } from "@/components/ui/primitives";
import { useEffect, useState } from "react";
import { AppLink as Link } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/client-api";
import type { Mission } from "@/lib/learn/catalog";
import type { LearningSession } from "@/lib/learn/session";
import { MissionSession } from "./mission-session";
export function MissionLoader({ mission }: { mission: Mission }) {
  const [data, setData] = useState<LearningSession | null>(null),
    [error, setError] = useState(""),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    const c = new AbortController();
    api<LearningSession>(`/api/learn/${mission.id}`, { signal: c.signal })
      .then((v) => {
        setData(v);
        setError("");
      })
      .catch((e) => {
        if (!c.signal.aborted) setError(errorMessage(e));
      });
    return () => c.abort();
  }, [mission.id, retry]);
  if (!data)
    return (
      <main id="main-content" className="learn-page">
        <Link href="/learn">← 서비스 원리 배우기로</Link>
        <h1>{mission.title}</h1>
        {error ? (
          <Status role="alert">
            {error}{" "}
            <Button className="secondary-button" onClick={() => setRetry((n) => n + 1)}>
              다시 불러오기
            </Button>
          </Status>
        ) : (
          <LoadingState>나의 학습 기록을 불러오는 중…</LoadingState>
        )}
      </main>
    );
  return <MissionSession key={`${data.scope}:${mission.id}`} mission={mission} session={data} />;
}

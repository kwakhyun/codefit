"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, ApiError, errorMessage } from "@/lib/client-api";
import { HANDOFF_TRACKS } from "@/lib/handoff/catalog";
import type { HandoffDashboard as Dashboard } from "@/lib/handoff/learning";
import { problemUrl } from "@/lib/library-state";
import { HandoffCard } from "./handoff-card";

export function HandoffDashboard() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [accountChanged, setAccountChanged] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let version = 0;
    async function load() {
      const current = ++version;
      try {
        const next = await api<Dashboard>("/api/handoff", {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
        });
        if (!controller.signal.aborted && current === version) {
          setData(next);
          setError("");
          setAccountChanged(false);
        }
      } catch (e) {
        if (!controller.signal.aborted && current === version) {
          setData(null);
          setError(errorMessage(e));
          setAccountChanged(e instanceof ApiError && e.status === 409);
        }
      }
    }
    void load();
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setData(null);
        void load();
      }
    };
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [reload]);
  const recommended = data?.learning.toSorted((a, b) => a.next.priority - b.next.priority)[0];
  const recommendedTrack = HANDOFF_TRACKS.find((t) => t.key === recommended?.key);
  return (
    <>
      <section className="handoff-progress" aria-label="내 인수인계 훈련 기록">
        <h2>내 코드 판단력, 다시 확인하기</h2>
        {error ? (
          <p role="alert">
            {error}{" "}
            <button
              className="text-button"
              onClick={() => (accountChanged ? window.location.reload() : setReload((v) => v + 1))}
            >
              {accountChanged ? "계정 다시 확인" : "다시 불러오기"}
            </button>
          </p>
        ) : !data ? (
          <p role="status">
            내 훈련 기록을 불러오는 중입니다. 아래 과제는 바로 시작할 수 있습니다.
          </p>
        ) : (
          <>
            <div role="status">
              <dl className="handoff-metrics">
                <div>
                  <dt>기본 과제 검토</dt>
                  <dd>{data.learning.filter((t) => t.base).length}/6개</dd>
                </div>
                <div>
                  <dt>지금 복습할 과제</dt>
                  <dd>{data.learning.filter((t) => t.due).length}개</dd>
                </div>
                <div>
                  <dt>첫 지연 재도전 기준 충족</dt>
                  <dd>{data.learning.filter((t) => t.retention === "independent").length}개</dd>
                </div>
              </dl>
            </div>
            {recommended && recommendedTrack && (
              <div className="handoff-recommendation">
                <div>
                  <strong>다음 훈련: {recommendedTrack.title}</strong>
                  <p>{recommended.next.reason}</p>
                </div>
                <Link
                  className="secondary-button"
                  href={problemUrl(recommended.next.problemId, "/handoff")}
                >
                  {recommended.next.label} →
                </Link>
              </div>
            )}
          </>
        )}
        <details className="handoff-measurement">
          <summary>재도전 기록은 어떻게 계산하나요?</summary>
          <p>
            최초 기본 과제 검토 7일 뒤, 첫 변형 풀이에서 서비스 내 힌트와 정답 없이 AI 기준을 모두
            충족하면 기록합니다. 이후 기본 과제를 다시 풀어도 이 기록은 유지됩니다. 변형을 미리
            풀거나 실패했어도 계속 연습할 수 있으며, 최근 검토 7일 뒤 다시 복습을 권합니다. 같은
            문제의 반복 복습은 새로운 변형 첫 풀이로 계산하지 않습니다.
          </p>
          <p>
            서비스 밖의 AI 사용은 확인하지 않으며 이 기록은 실력 인증이나 실행 채점 결과가 아닙니다.
          </p>
        </details>
      </section>
      <div className="handoff-grid">
        {HANDOFF_TRACKS.map((track, index) => (
          <HandoffCard
            key={track.key}
            track={track}
            index={index}
            learning={data?.learning.find((t) => t.key === track.key)}
          />
        ))}
      </div>
    </>
  );
}

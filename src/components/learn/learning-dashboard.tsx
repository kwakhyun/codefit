"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { MISSIONS } from "@/lib/learn/catalog";
import { readLearning, canComplete } from "@/lib/learn/progress";
import type { Progress } from "@/lib/problem";
export function LearningDashboard() {
  const [data, setData] = useState<{ progress: Progress[]; signedIn: boolean } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api<{ progress: Progress[]; signedIn: boolean }>("/api/learn", { signal: controller.signal })
      .then(setData)
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e));
      });
    return () => controller.abort();
  }, []);
  const records = new Map(data?.progress.map((p) => [p.problemId, readLearning(p.code)]));
  const complete = MISSIONS.filter((m) => {
    const r = records.get(`learn:${m.id}`);
    return r?.completed && canComplete(m, r);
  }).length;
  return (
    <>
      <div className="learn-progress">
        <strong>{data ? `${complete} / 9개 미션 완료` : "학습 기록을 불러오는 중…"}</strong>
        <span>
          {data?.signedIn
            ? "같은 계정으로 로그인하면 다른 기기에서도 이어서 학습할 수 있습니다."
            : "로그인 없이 이용할 수 있습니다. 학습 기록은 현재 브라우저에서 이어서 볼 수 있습니다."}
        </span>
      </div>
      {error && (
        <p role="alert">
          기록을 불러오지 못했습니다. {error}{" "}
          <button className="text-button" onClick={() => window.location.reload()}>
            다시 불러오기
          </button>
        </p>
      )}
      {(["foundation", "lab"] as const).map((kind) => (
        <section id={kind === "lab" ? "labs" : "basics"} className="learn-course" key={kind}>
          <div className="learn-section-title">
            <span className="eyebrow">
              {kind === "foundation" ? "01 / 직접 해보며 배우기" : "02 / 배운 것을 써보기"}
            </span>
            <h2>{kind === "foundation" ? "앱의 원리 배우기" : "앱 오류 해결 실습"}</h2>
            <p>
              {kind === "foundation"
                ? "순서대로 배우거나 지금 궁금한 미션부터 시작하세요."
                : "예제 앱의 오류를 찾아 AI에게 보낼 수정 요청을 작성하고, 수정 결과를 확인합니다."}
            </p>
          </div>
          <div className="learn-cards">
            {MISSIONS.filter((m) => m.kind === kind).map((m, i) => {
              const r = records.get(`learn:${m.id}`);
              return (
                <Link href={`/learn/${m.id}`} className="learn-card" key={m.id}>
                  <div>
                    <span>
                      {String(i + 1).padStart(2, "0")} / {m.concept}
                    </span>
                    <span>{m.minutes}분</span>
                  </div>
                  <h3>{m.title}</h3>
                  <p>{m.summary}</p>
                  <strong>
                    {r?.completed && canComplete(m, r)
                      ? "완료 · 다시 살펴보기"
                      : r?.locked
                        ? "이어서 연습하기"
                        : "미션 시작하기"}{" "}
                    →
                  </strong>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

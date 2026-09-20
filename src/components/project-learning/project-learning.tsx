"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FlaskConical, RefreshCw } from "lucide-react";
import { api, errorMessage } from "@/lib/client-api";
import type { TrainingView } from "@/lib/project-learning/types";
import { ProbeForm } from "./probe-form";
import { TrainingResult } from "./training-result";
const phaseLabel = {
  baseline: "시작 전 질문",
  practice: "실습하기",
  transfer: "다른 상황에 적용",
  complete: "결과 확인",
};
export function ProjectLearning({ id, scope }: { id: string; scope: string }) {
  const [view, setView] = useState<TrainingView>();
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const refreshRequest = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    refreshRequest.current = controller;
    api<TrainingView>(`/api/project-check/training?id=${id}`, {
      scope,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    })
      .then((v) => {
        if (controller.signal.aborted) return;
        setView(v);
        setError("");
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) {
          setError(errorMessage(e));
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [id, scope, refresh]);
  const current =
    view?.modules.find((m) => m.id === selected) ??
    view?.modules.find((m) => m.phase === "transfer") ??
    view?.modules.find((m) => m.phase === "practice") ??
    view?.modules.find((m) => m.phase !== "complete") ??
    view?.modules[0];
  return (
    <section
      id="training"
      className="project-panel training-panel"
      aria-label="기초 개념 실습과 확인"
    >
      <span className="eyebrow">
        <FlaskConical size={16} /> 설명에서 실습으로
      </span>
      <h2>기초 개념을 예제로 연습해 보세요</h2>
      <p>
        낮게 평가된 영역의 기초 개념을 연습하는 공통 예제입니다. 내 프로젝트의 기술이나 설계에 맞춰
        생성한 과제는 아닙니다. 위의 프로젝트 확인 과제와 구분해서 활용하세요.
      </p>
      <p className="project-help">이 실습에는 AI 이용 횟수가 차감되지 않습니다.</p>
      {error && (
        <p role="alert" className="project-error">
          {error}
        </p>
      )}
      <button
        className="text-button"
        disabled={loading}
        onClick={() => {
          setLoading(true);
          setRefresh((n) => n + 1);
        }}
      >
        <RefreshCw size={15} />
        {loading ? "기록 확인 중…" : "실습 기록 새로고침"}
      </button>
      {!view && !error && <p role="status">기초 개념 실습을 준비하고 있습니다…</p>}
      {view && current && (
        <>
          <nav className="training-topics" aria-label="연습 영역">
            {view.modules.map((m, i) => (
              <button
                key={m.id}
                aria-pressed={m.id === current.id}
                onClick={() => {
                  setSelected(m.id);
                  requestAnimationFrame(() => heading.current?.focus());
                }}
              >
                <span>
                  {m.phase === "complete" ? <Check size={15} /> : i + 1}. {m.area}
                </span>
                <small>{phaseLabel[m.phase]}</small>
              </button>
            ))}
          </nav>
          <h3 ref={heading} tabIndex={-1}>
            {current.title}
          </h3>
          <p>{current.objective}</p>
          <details className="training-reason">
            <summary>이 연습을 추천한 이유</summary>
            <p>{current.reason}</p>
            <p className="project-help">
              이 영역의 답변은 AI 평가에서 {current.level}/4단계를 받았습니다. 평가가 낮은 영역부터
              연습을 안내하며, 실제 구현 능력을 평가한 결과는 아닙니다.
            </p>
          </details>
          <ol className="training-stages" aria-label="학습 순서">
            {["baseline", "practice", "transfer", "complete"].map((p) => (
              <li key={p} aria-current={p === current.phase ? "step" : undefined}>
                {phaseLabel[p as keyof typeof phaseLabel]}
              </li>
            ))}
          </ol>
          {current.phase === "practice" && (
            <div className="training-practice">
              <strong>시작 전 답변이 저장됐습니다.</strong>
              <p>
                이제 화면을 직접 조작하며 원리를 확인해 보세요. 실습의 마지막 단계까지 완료하고
                돌아오면 다른 상황의 질문이 열립니다.
              </p>
              <Link className="primary-button" href={`/learn/${current.missionId}?project=${id}`}>
                {current.missionTitle} <ArrowRight size={17} />
              </Link>
              <p className="project-help">
                약 {current.minutes}분 소요됩니다. 이 계정에서 실습을 완료하면 다음 질문이 열립니다.
              </p>
            </div>
          )}
          {(current.phase === "baseline" || current.phase === "transfer") && (
            <ProbeForm
              key={`${scope}:${id}:${current.id}:${current.phase}`}
              id={id}
              scope={scope}
              module={current}
              revision={view.revision}
              disabled={loading}
              onSaved={(v) => {
                refreshRequest.current?.abort();
                setLoading(false);
                setSelected(current.id);
                setView(v);
                requestAnimationFrame(() => heading.current?.focus());
              }}
            />
          )}
          {(current.phase === "transfer" || current.phase === "complete") && (
            <Link className="text-button" href={`/learn/${current.missionId}?project=${id}`}>
              연결된 실습 다시 보기 →
            </Link>
          )}
          {current.result && (
            <TrainingResult
              contentId={view.contentId}
              module={current}
              onNext={() => {
                const next = view.modules.find((m) => m.phase !== "complete");
                if (next) {
                  setSelected(next.id);
                  requestAnimationFrame(() => heading.current?.focus());
                }
              }}
              hasNext={view.modules.some((m) => m.phase !== "complete")}
            />
          )}
        </>
      )}
    </section>
  );
}

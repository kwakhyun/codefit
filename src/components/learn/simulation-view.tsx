"use client";
import { useRef, useState } from "react";
import { RotateCcw, Monitor } from "lucide-react";
import { ACTION_LABELS, type Action, type Mission } from "@/lib/learn/catalog";
import { simulate } from "@/lib/learn/simulation";
import { ServiceSurface } from "./simulation/service-surface";
import { AppSurface } from "./simulation/app-surface";
import { SimulationInspector } from "./simulation/simulation-inspector";
import { ExperimentGuide } from "./simulation/experiment-guide";
const environmentActions: Action[] = [
  "refresh",
  "other-device",
  "offline",
  "online",
  "respond-new",
  "respond-old",
];
export function SimulationView({
  mission,
  actions,
  fix = "",
  onAction,
  preview = false,
}: {
  mission: Mission;
  actions: Action[];
  fix?: string;
  onAction?: (action: Action) => void;
  preview?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const [trial, setTrial] = useState<Action[]>([]);
  const current = preview ? trial : actions;
  const state = simulate(mission, current, fix);
  const disabled = current.length >= 80;
  const tools = mission.actions.filter(
    (a) => environmentActions.includes(a) && !(mission.app === "filter" && a === "refresh"),
  );
  function act(action: Action) {
    if (disabled || !mission.actions.includes(action)) return;
    if (preview) setTrial((previous) => [...previous, action].slice(0, 80));
    else onAction?.(action);
  }
  return (
    <section
      ref={root}
      className="simulator"
      aria-label={preview ? "예제 서비스 첫 화면" : "실습 서비스"}
    >
      <div className="simulator-label">
        <span>
          <Monitor size={16} /> 실습 서비스 <small>가상 데이터</small>
        </span>
        {preview && (
          <button type="button" onClick={() => setTrial([])}>
            <RotateCcw size={14} /> 처음으로
          </button>
        )}
      </div>
      {!preview && (
        <ExperimentGuide
          key={fix}
          mission={mission}
          actions={current}
          root={root}
          result={`${mission.app === "request" || mission.app === "booking" ? `${state.online ? "온라인" : "오프라인"} 상태 · ` : mission.app === "access" ? `사용자 ${state.actor} · ` : ""}${state.message}`}
          fixed={Boolean(fix)}
          disabled={disabled}
        />
      )}
      {mission.service ? (
        <ServiceSurface mission={mission} state={state} act={act} disabled={disabled} />
      ) : (
        <AppSurface mission={mission} state={state} act={act} disabled={disabled} />
      )}
      {tools.length > 0 && (
        <div className="simulation-tools">
          <strong>상황 바꾸기</strong>
          <div>
            {tools.map((action) => (
              <button
                type="button"
                data-sim-action={action}
                key={action}
                disabled={disabled}
                onClick={() => act(action)}
              >
                {ACTION_LABELS[action]}
              </button>
            ))}
          </div>
          {mission.app === "request" || mission.app === "booking" ? (
            <span>연결 상태: {state.online ? "온라인" : "오프라인"}</span>
          ) : null}
        </div>
      )}
      {disabled && (
        <p className="learn-fineprint">
          80회 조작했습니다.{" "}
          {preview
            ? "처음으로 돌아가 다시 사용해 보세요."
            : "관찰 기록을 내려받고 다시 시작할 수 있습니다."}
        </p>
      )}
      {!preview && <SimulationInspector mission={mission} state={state} />}
    </section>
  );
}

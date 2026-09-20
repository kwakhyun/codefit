"use client";
import { Button } from "@/components/ui/primitives";
import { useRef } from "react";
import { Monitor } from "lucide-react";
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
  finishOnRequired = false,
}: {
  mission: Mission;
  actions: Action[];
  fix?: string;
  onAction?: (action: Action) => void;
  finishOnRequired?: boolean;
}) {
  const root = useRef<HTMLElement>(null);
  const current = actions;
  const state = simulate(mission, current, fix);
  const disabled = current.length >= 80;
  const tools = mission.actions.filter(
    (a) => environmentActions.includes(a) && !(mission.app === "filter" && a === "refresh"),
  );
  function act(action: Action) {
    if (disabled || !mission.actions.includes(action)) return;
    onAction?.(action);
  }
  return (
    <section ref={root} className="simulator" aria-label="실습 서비스">
      <div className="simulator-label">
        <span>
          <Monitor size={16} /> 실습 서비스{" "}
          <small>{fix ? "선택한 수정안 적용 중" : "수정 전 구현 · 조건 누락 가능"}</small>
        </span>
      </div>
      <ExperimentGuide
        key={fix}
        mission={mission}
        actions={current}
        root={root}
        result={`${mission.app === "request" || mission.app === "booking" ? `${state.online ? "온라인" : "오프라인"} 상태 · ` : mission.app === "access" ? `사용자 ${state.actor} · ` : ""}${state.message}`}
        fixed={Boolean(fix)}
        finishOnRequired={finishOnRequired}
        disabled={disabled}
      />
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
              <Button
                type="button"
                data-sim-action={action}
                key={action}
                disabled={disabled}
                onClick={() => act(action)}
              >
                {ACTION_LABELS[action]}
              </Button>
            ))}
          </div>
          {mission.app === "request" || mission.app === "booking" ? (
            <span>연결 상태: {state.online ? "온라인" : "오프라인"}</span>
          ) : null}
        </div>
      )}
      {disabled && (
        <p className="learn-fineprint">
          80회 조작했습니다. 관찰 기록을 내려받고 다시 시작할 수 있습니다.
        </p>
      )}
      <SimulationInspector mission={mission} state={state} />
    </section>
  );
}

"use client";
import { ScenarioVisual } from "@/components/ui/scenario-visual";
import { scenarioFor } from "@/lib/scenario-visuals";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Lightbulb } from "lucide-react";
import { useBeginnerMission } from "@/hooks/use-beginner-mission";
import { MISSIONS, type Mission, type Action } from "@/lib/learn/catalog";
import {
  canComplete,
  checksPassed,
  learningSummary,
  readLearning,
  requestReady,
  type LearningRecord,
} from "@/lib/learn/progress";
import { reproduced } from "@/lib/learn/simulation";
import type { LearningSession } from "@/lib/learn/session";
import { MissionPrediction } from "./mission-prediction";
import { MissionObservation } from "./mission-observation";
import { MissionRepair } from "./mission-repair";
import { MissionTransfer } from "./mission-transfer";
import { LEARNING_STAGES as stages } from "@/lib/learn/overview";
const labels = {
  saved: "서버에 저장됨",
  saving: "저장 중…",
  local: "저장 대기",
  offline: "오프라인 · 브라우저 보관",
  failed: "저장 실패 · 재시도 가능",
  conflict: "다른 곳의 기록과 충돌",
  resolving: "서버 버전 확인 중",
};
function download(mission: Mission, record: LearningRecord) {
  const blob = new Blob([learningSummary(mission, record)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `codefit-${mission.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
export function MissionSession({
  mission,
  session,
}: {
  mission: Mission;
  session: LearningSession;
}) {
  const controller = useBeginnerMission(mission, session),
    record = controller.record;
  const [observationUndo, setObservationUndo] = useState<Action[] | null>(null);
  const [sandbox, setSandbox] = useState<Action[]>([]),
    [notice, setNotice] = useState("");
  const focusPending = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    if (focusPending.current) {
      focusPending.current = false;
      heading.current?.focus();
      heading.current?.scrollIntoView({ block: "start" });
    }
  }, [record.stage]);
  function move(stage: number) {
    setNotice("");
    if (stage === record.stage) return;
    focusPending.current = true;
    controller.update((x) => ({ ...x, stage }));
  }
  const evidence = reproduced(mission, record.actions),
    passed = checksPassed(mission, record),
    next = MISSIONS[MISSIONS.findIndex((x) => x.id === mission.id) + 1];
  const allowed = [
    true,
    record.locked,
    record.locked && evidence,
    record.locked && evidence && passed && (mission.kind !== "lab" || requestReady(record)),
  ];
  const conflict =
    controller.draft.draftStatus.kind === "conflict" ||
    controller.draft.draftStatus.kind === "resolving"
      ? controller.draft.draftStatus
      : null;
  function lock() {
    if (record.prediction < 0) {
      setNotice("예상 결과를 하나 골라 주세요.");
      document.getElementById("learn-choice-0")?.focus();
      return;
    }
    focusPending.current = true;
    controller.update((x) => ({ ...x, locked: true, stage: 1 }));
    setNotice("");
  }
  function restartObservation() {
    download(mission, record);
    setObservationUndo(record.actions);
    controller.update((current) => ({ ...current, actions: [], checked: [], completed: false }));
  }
  function restoreObservation() {
    if (!observationUndo) return;
    controller.update((current) => ({
      ...current,
      actions: observationUndo,
      checked: [],
      completed: false,
    }));
    setObservationUndo(null);
  }
  function complete() {
    if (!canComplete(mission, record)) {
      setNotice("응용 답과 배운 점을 확인해 주세요. 배운 점은 10자 이상 남겨 주세요.");
      document.getElementById("learn-reflection")?.focus();
      return;
    }
    controller.update((x) => ({ ...x, completed: true }));
  }
  return (
    <main id="main-content" className="learn-page mission-page">
      <header className="learn-header">
        <Link href="/learn">
          <ArrowLeft size={16} /> 서비스 원리 배우기
        </Link>
        <div className="learn-save">
          <span role="status">{labels[controller.draft.saveState]}</span>
          <button className="text-button" onClick={() => void controller.draft.saveNow()}>
            지금 저장
          </button>
          <button
            className="icon-button"
            aria-label="학습 기록 내려받기"
            onClick={() => download(mission, record)}
          >
            <Download size={18} />
          </button>
        </div>
      </header>
      <div className="mission-title">
        <span className="eyebrow">
          {mission.kind === "lab" ? "서비스 오류 해결 실습" : "서비스 원리 배우기"} /{" "}
          {mission.minutes}분
        </span>
        <h1>{mission.title}</h1>
        <p>{mission.task}</p>
      </div>
      {!controller.draft.localSaved && (
        <p role="alert">
          브라우저 보관에 실패했습니다. 창을 닫기 전에 학습 기록을 내려받아 주세요.
        </p>
      )}
      {conflict && (
        <section className="learn-conflict" aria-label="학습 기록 충돌">
          <p role="alert">
            <strong>다른 곳에서 저장한 학습 기록이 있습니다.</strong> 내 작성 내용은 유지됩니다. 두
            기록을 비교하고 필요한 내용을 아래 입력란에 옮긴 뒤 저장하세요.
          </p>
          <details>
            <summary>내 기록과 서버 기록 비교</summary>
            <div className="learn-comparison">
              <pre aria-label="내 학습 기록">{learningSummary(mission, record)}</pre>
              <pre aria-label="서버 학습 기록">
                {learningSummary(mission, readLearning(conflict.server.code))}
              </pre>
            </div>
          </details>
          <button
            className="secondary-button"
            disabled={conflict.kind === "resolving"}
            onClick={async () => {
              if (await controller.draft.resolveConflict()) heading.current?.focus();
            }}
          >
            비교한 버전에 내 기록 저장
          </button>
          <p>그사이 서버 내용이 바뀌면 다시 비교를 안내합니다.</p>
        </section>
      )}
      {(controller.error || notice) && (
        <p className="inline-error" role="alert">
          {controller.error || notice}
        </p>
      )}
      <nav className="learn-steps" aria-label="입문 미션 단계">
        {stages.map((s, i) => (
          <button
            key={s}
            disabled={!controller.ready || !allowed[i]}
            aria-current={record.stage === i ? "step" : undefined}
            onClick={() => move(i)}
          >
            <span>{i + 1}</span>
            {s}
          </button>
        ))}
      </nav>
      <section className="mission-stage" aria-busy={!controller.ready}>
        <h2 ref={heading} tabIndex={-1}>
          {record.stage + 1}. {stages[record.stage]}
        </h2>
        {!controller.ready ? (
          <p>초안을 복원하는 중…</p>
        ) : (
          <>
            {scenarioFor(mission.id) && (
              <details className="mission-concept-art">
                <summary>그림으로 원리 살펴보기</summary>
                <ScenarioVisual scene={scenarioFor(mission.id)!} stage={record.stage} />
              </details>
            )}
            {record.stage === 0 && (
              <MissionPrediction
                mission={mission}
                record={record}
                update={controller.update}
                onContinue={record.locked ? () => move(1) : lock}
              />
            )}
            {record.stage === 1 && (
              <MissionObservation
                mission={mission}
                record={record}
                update={controller.update}
                evidence={evidence}
                canRestore={observationUndo !== null}
                onRestart={restartObservation}
                onRestore={restoreObservation}
                onContinue={() => move(2)}
              />
            )}
            {record.stage === 2 && (
              <MissionRepair
                mission={mission}
                record={record}
                update={controller.update}
                coach={controller.coach}
                busy={controller.busy}
                aiReady={session.aiReady}
                sandboxActions={sandbox}
                onSandboxChange={setSandbox}
                canContinue={allowed[3]}
                onContinue={() => move(3)}
              />
            )}
            {record.stage === 3 && (
              <MissionTransfer
                mission={mission}
                record={record}
                update={controller.update}
                nextMission={next}
                onComplete={complete}
              />
            )}
          </>
        )}
      </section>
      <aside className="learn-support">
        <button
          className="secondary-button"
          disabled={record.hints >= 3 || !controller.ready}
          onClick={() => controller.update((x) => ({ ...x, hints: Math.min(3, x.hints + 1) }))}
        >
          <Lightbulb size={16} />
          힌트 보기 {record.hints}/3
        </button>
        {record.hints > 0 && (
          <ol>
            {mission.hint.slice(0, record.hints).map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ol>
        )}
        <details>
          <summary>용어와 짧은 코드로 더 알아보기</summary>
          <h3>{mission.concept}</h3>
          <p>{mission.lesson}</p>
          <pre>
            <code>{mission.code}</code>
          </pre>
          <p className="learn-fineprint">
            개념을 설명하는 코드입니다. 실제 제품에 그대로 붙여 넣는 구현은 아닙니다.
          </p>
        </details>
      </aside>
      <footer className="learn-fineprint">
        {session.signedIn ? "계정에 저장" : "게스트 연습실에 저장"} · 실제 네트워크나 계정에 영향을
        주지 않는 모의 실습입니다. <Link href="/quality">AI 검토 안내</Link>
      </footer>
    </main>
  );
}

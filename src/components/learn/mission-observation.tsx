import type { Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
import { simulate } from "@/lib/learn/simulation";
import { SimulationView } from "./simulation-view";

export function MissionObservation({
  mission,
  record,
  update,
  evidence,
  canRestore,
  onRestart,
  onRestore,
  onContinue,
}: {
  mission: Mission;
  record: LearningRecord;
  update: LearningRecordUpdate;
  evidence: boolean;
  canRestore: boolean;
  onRestart: () => void;
  onRestore: () => void;
  onContinue: () => void;
}) {
  return (
    <>
      <div className="mission-columns">
        <SimulationView
          mission={mission}
          actions={record.actions}
          onAction={(a) => {
            if (record.actions.length < 80)
              update((x) => ({ ...x, completed: false, actions: [...x.actions, a] }));
          }}
        />
        <div className="learn-observations">
          <h3>내 첫 예상</h3>
          <p>{mission.choices[record.prediction]}</p>
          <p className="muted">{record.reason}</p>
          <h3>실행 기록</h3>
          {record.actions.length ? (
            <ol>
              {simulate(mission, record.actions)
                .trace.slice(-12)
                .map((t, i) => (
                  <li key={`${i}:${t}`}>{t}</li>
                ))}
            </ol>
          ) : null}
          {record.actions.length > 12 && (
            <small>최근 12개 동작을 표시합니다. 전체 기록은 내려받을 수 있습니다.</small>
          )}
          {record.actions.length >= 80 && (
            <p>관찰 기록 80개를 보관했습니다. 필요하면 기록을 내려받고 다시 시작하세요.</p>
          )}
          {record.actions.length > 0 && (
            <button className="text-button" onClick={onRestart}>
              기록 내려받고 관찰 다시 시작
            </button>
          )}
          {canRestore && (
            <button className="text-button" onClick={onRestore}>
              이전 관찰 복구
            </button>
          )}
          {evidence && (
            <div className="learn-concept">
              <strong>예상과 실제 결과를 비교해 보세요.</strong>
              <p>{mission.lesson}</p>
            </div>
          )}
        </div>
      </div>
      <button className="primary-button" disabled={!evidence} onClick={onContinue}>
        수정 방법과 검사 살펴보기 →
      </button>
      {!evidence && (
        <p className="learn-fineprint">미션에 적힌 순서로 상황을 재현하면 다음 단계가 열립니다.</p>
      )}
    </>
  );
}

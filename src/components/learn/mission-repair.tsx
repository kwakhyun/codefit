import type { Action, Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
import { requestReady } from "@/lib/learn/progress";
import { verification } from "@/lib/learn/simulation";
import { MissionRequest } from "./mission-request";
import { SimulationView } from "./simulation-view";

export function MissionRepair({
  mission,
  record,
  update,
  coach,
  busy,
  aiReady,
  sandboxActions,
  onSandboxChange,
  canContinue,
  onContinue,
}: {
  mission: Mission;
  record: LearningRecord;
  update: LearningRecordUpdate;
  coach: () => Promise<void>;
  busy: boolean;
  aiReady: boolean;
  sandboxActions: Action[];
  onSandboxChange: (actions: Action[]) => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const results = verification(mission, record.fix);
  const requestForm = (
    <MissionRequest
      mission={mission}
      record={record}
      update={update}
      coach={coach}
      busy={busy}
      aiReady={aiReady}
    />
  );
  return (
    <>
      {mission.kind === "foundation" ? (
        <details>
          <summary>AI에게 요청하는 연습도 해보기 (선택)</summary>
          {requestForm}
        </details>
      ) : (
        requestForm
      )}
      <div className="learn-fixes">
        <h3>수정안을 선택하고 결과를 확인하세요.</h3>
        <p>
          아래 준비된 수정안 중 하나를 적용해 동작을 비교합니다. 위에 쓴 요청문이 코드를 자동으로
          수정하지는 않습니다. 요청문의 보완점은 AI 코치에게 물어볼 수 있습니다.
        </p>
        <fieldset>
          <legend>적용할 수정안</legend>
          {mission.fixes.map((f) => (
            <label className="learn-option" key={f.id}>
              <input
                type="radio"
                name="fix"
                checked={record.fix === f.id}
                onChange={() => {
                  onSandboxChange([]);
                  update((x) => ({ ...x, fix: f.id, checked: [], completed: false }));
                }}
              />
              <span>
                <strong>{f.title}</strong>
                <small>{f.detail}</small>
              </span>
            </label>
          ))}
        </fieldset>
      </div>
      {record.fix && (
        <>
          <details className="learn-sandbox">
            <summary>수정안이 적용된 서비스 사용해 보기</summary>
            <SimulationView
              mission={mission}
              fix={record.fix}
              actions={sandboxActions}
              onAction={(a) => onSandboxChange([...sandboxActions, a].slice(-80))}
            />
            <button className="text-button" onClick={() => onSandboxChange([])}>
              실험 상태 초기화
            </button>
          </details>
          <section className="learn-checks" aria-label="수정 결과 검사">
            <h3>수정 후에도 기능이 제대로 작동하는지 확인하세요.</h3>
            <p>
              각 검사는 초기 상태에서 독립적으로 실행합니다. 아래 항목을 모두 확인해야 다음 단계로
              넘어갑니다.
            </p>
            {results.map((check) => (
              <div className="learn-check" key={check.id}>
                <div>
                  <strong>{check.label}</strong>
                  {record.checked.includes(check.id) && (
                    <p className={check.passed ? "learn-success" : "learn-warning"}>
                      {check.passed ? "확인됨" : "보완 필요"} — {check.evidence}
                    </p>
                  )}
                </div>
                <button
                  className="secondary-button"
                  onClick={() =>
                    update((x) => ({
                      ...x,
                      checked: Array.from(new Set([...x.checked, check.id])),
                    }))
                  }
                >
                  {check.label} 검사
                </button>
              </div>
            ))}
          </section>
        </>
      )}
      <button className="primary-button" disabled={!canContinue} onClick={onContinue}>
        다른 상황에 적용하기 →
      </button>
      {mission.kind === "lab" && !requestReady(record) && (
        <p className="learn-fineprint">수정 요청의 다섯 항목도 채워 주세요.</p>
      )}
    </>
  );
}

import {
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Input,
  Button,
} from "@/components/ui/primitives";
import type { Action, Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
import { requestFields } from "@/lib/learn/progress";
import { useId } from "react";
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
  const nextHintId = useId();
  const unchecked = results.filter((check) => !record.checked.includes(check.id)).length;
  const failed = results.some((check) => record.checked.includes(check.id) && !check.passed);
  const missingFields = requestFields.filter(
    (field) => record.request[field.key].trim().length < 3,
  );
  const nextHint = !record.fix
    ? "먼저 적용할 수정안을 하나 선택하세요."
    : failed
      ? "보완이 필요한 검사가 있습니다. 다른 수정안을 선택하고 다시 검사하세요."
      : unchecked > 0
        ? `아직 실행하지 않은 검사 ${unchecked}개가 있습니다. 각 항목의 검사 버튼을 눌러 주세요.`
        : mission.kind === "lab" && missingFields.length > 0
          ? `수정 요청의 남은 ${missingFields.length}개 항목을 각각 3자 이상 작성하세요.`
          : "모든 검사를 통과했습니다. 이제 다른 상황에서도 같은 원리를 적용해 보세요.";
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
        <Disclosure>
          <DisclosureSummary>AI에게 요청하는 연습도 해보기 (선택)</DisclosureSummary>
          {requestForm}
        </Disclosure>
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
            <FieldLabel className="learn-option" key={f.id}>
              <Input
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
            </FieldLabel>
          ))}
        </fieldset>
      </div>
      {record.fix && (
        <>
          <Disclosure className="learn-sandbox">
            <DisclosureSummary>수정안이 적용된 서비스 사용해 보기</DisclosureSummary>
            <SimulationView
              mission={mission}
              fix={record.fix}
              actions={sandboxActions}
              onAction={(a) => onSandboxChange([...sandboxActions, a].slice(-80))}
            />
            <Button className="text-button" onClick={() => onSandboxChange([])}>
              실험 상태 초기화
            </Button>
          </Disclosure>
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
                <Button
                  className="secondary-button"
                  onClick={() =>
                    update((x) => ({
                      ...x,
                      checked: Array.from(new Set([...x.checked, check.id])),
                    }))
                  }
                >
                  {check.label} 검사
                </Button>
              </div>
            ))}
            <p className="learn-fineprint">
              이 검사는 아래 사례의 처리 규칙만 확인합니다. 실제 서버의 저장, 동시 요청, 보안까지
              검증한 것은 아닙니다. 같은 입력과 기대 결과를 내 서비스에서도 확인해 보세요.
            </p>
          </section>
        </>
      )}
      <div className="repair-next-step">
        <p id={nextHintId} role="status">
          {nextHint}
        </p>
        <Button
          className="primary-button"
          disabled={!canContinue}
          aria-describedby={nextHintId}
          onClick={onContinue}
        >
          다른 상황에 적용하기 →
        </Button>
      </div>
    </>
  );
}

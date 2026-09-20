import { FieldLabel, Input, Textarea, Button } from "@/components/ui/primitives";
import { missionContext } from "@/lib/learn/context";
import { VoiceInput } from "@/components/ui/voice-input";
import type { Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
export function MissionPrediction({
  mission,
  record,
  update,
  onContinue,
}: {
  mission: Mission;
  record: LearningRecord;
  update: LearningRecordUpdate;
  onContinue: () => void;
}) {
  const context = missionContext(mission);
  return (
    <div className="learn-prediction">
      <section className="prediction-example mission-brief" aria-label="실습 상황과 기준">
        <span className="eyebrow">왜 확인해야 할까요?</span>
        <h3>{mission.summary}</h3>
        <p>{context.why}</p>
        <div className="mission-rule">
          <h4>지켜야 할 조건</h4>
          <p>{context.rule}</p>
        </div>
        {mission.service && (
          <div className="mission-rule">
            <h4>이번에 확인할 입력</h4>
            <dl>
              {mission.service.samples[1].fields.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
        <p className="learn-fineprint">
          실제 서비스에서 확인할 상황을 단순화한 교육용 예제입니다. 다음 단계에서 조건을 빠뜨린
          구현을 실행하고, 수정 전후를 비교합니다. 특정 AI가 실제로 만든 오류를 재현한 자료는
          아닙니다.
        </p>
      </section>
      <div className="prediction-answer">
        <span className="eyebrow">내 예상</span>
        <h3>먼저 확인 기준을 정해요</h3>
        <fieldset disabled={record.locked}>
          <legend>{mission.prediction}</legend>
          {mission.choices.map((choice, i) => (
            <FieldLabel className="learn-option" key={choice}>
              <Input
                id={`learn-choice-${i}`}
                name="prediction"
                type="radio"
                checked={record.prediction === i}
                onChange={() => update((x) => ({ ...x, prediction: i }))}
              />
              <span>{choice}</span>
            </FieldLabel>
          ))}
        </fieldset>
        <FieldLabel htmlFor="learn-reason">
          왜 그렇게 생각했나요? <span className="optional-label">선택</span>
        </FieldLabel>
        <Textarea
          id="learn-reason"
          value={record.reason}
          readOnly={record.locked}
          rows={3}
          maxLength={800}
          placeholder="떠오르는 이유가 있다면 적거나 말해 주세요."
          onChange={(e) => update((x) => ({ ...x, reason: e.target.value }))}
        />
        <VoiceInput
          targetId="learn-reason"
          disabled={record.locked}
          onTranscript={(text) =>
            update((x) => ({
              ...x,
              reason: `${x.reason}${x.reason ? " " : ""}${text}`.slice(0, 800),
            }))
          }
        />
        <Button className="primary-button" onClick={onContinue}>
          {record.locked ? "내 첫 예상으로 다시 살펴보기" : "예상 남기고 직접 확인 →"}
        </Button>
      </div>
    </div>
  );
}

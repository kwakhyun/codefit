import { FieldLabel, Input, Textarea, Button } from "@/components/ui/primitives";
import { SimulationView } from "./simulation-view";
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
  return (
    <div className="learn-prediction">
      <div className="prediction-example">
        <SimulationView mission={mission} actions={[]} preview />
        <p className="learn-fineprint">
          자유롭게 눌러보세요. 여기서 사용한 내용은 다음 단계의 관찰 기록에 포함되지 않습니다.
        </p>
      </div>
      <div className="prediction-answer">
        <span className="eyebrow">내 예상</span>
        <h3>어떻게 동작할까요?</h3>
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

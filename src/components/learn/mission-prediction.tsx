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
      <p>아직 실행하지 말고, 어떻게 될지 먼저 생각해 보세요. 틀려도 괜찮습니다.</p>
      <fieldset disabled={record.locked}>
        <legend>{mission.prediction}</legend>
        {mission.choices.map((choice, i) => (
          <label className="learn-option" key={choice}>
            <input
              id={`learn-choice-${i}`}
              name="prediction"
              type="radio"
              checked={record.prediction === i}
              onChange={() => update((x) => ({ ...x, prediction: i }))}
            />
            <span>{choice}</span>
          </label>
        ))}
      </fieldset>
      <label htmlFor="learn-reason">
        왜 그렇게 생각했나요?
        <textarea
          id="learn-reason"
          value={record.reason}
          readOnly={record.locked}
          rows={3}
          maxLength={800}
          placeholder="지금 알고 있는 만큼만 적어 주세요."
          onChange={(e) => update((x) => ({ ...x, reason: e.target.value }))}
        />
      </label>
      <button className="primary-button" onClick={onContinue}>
        {record.locked ? "내 첫 예상으로 다시 살펴보기" : "예상 남기고 직접 확인 →"}
      </button>
    </div>
  );
}

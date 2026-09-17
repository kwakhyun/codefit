import Link from "next/link";
import { Check } from "lucide-react";
import { VoiceInput } from "@/components/ui/voice-input";
import type { Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
import { canComplete } from "@/lib/learn/progress";

export function MissionTransfer({
  mission,
  record,
  update,
  nextMission,
  onComplete,
}: {
  mission: Mission;
  record: LearningRecord;
  update: LearningRecordUpdate;
  nextMission?: Mission;
  onComplete: () => void;
}) {
  return (
    <>
      <div className="learn-transfer">
        <fieldset>
          <legend>{mission.transfer.question}</legend>
          {mission.transfer.choices.map((choice, i) => (
            <label className="learn-option" key={choice}>
              <input
                type="radio"
                name="transfer"
                checked={record.transfer === i}
                onChange={() => update((x) => ({ ...x, transfer: i, completed: false }))}
              />
              <span>{choice}</span>
            </label>
          ))}
        </fieldset>
        {record.transfer >= 0 && (
          <p
            role="status"
            className={
              record.transfer === mission.transfer.answer ? "learn-success" : "learn-warning"
            }
          >
            {record.transfer === mission.transfer.answer
              ? mission.transfer.explanation
              : "앞에서 확인한 원리를 다른 상황에도 적용해 보세요. 힌트를 다시 볼 수 있습니다."}
          </p>
        )}
        <label htmlFor="learn-reflection">
          내 제품에서는 무엇을 확인할 건가요?
          <textarea
            id="learn-reflection"
            rows={3}
            maxLength={1000}
            value={record.reflection}
            onChange={(e) =>
              update((x) => ({ ...x, reflection: e.target.value, completed: false }))
            }
            placeholder="예: 저장 완료 안내뿐 아니라 새로고침 후에도 데이터가 남는지 확인하겠습니다."
          />
        </label>
        <VoiceInput
          targetId="learn-reflection"
          onTranscript={(text) =>
            update((x) => ({
              ...x,
              reflection: `${x.reflection}${x.reflection ? " " : ""}${text}`.slice(0, 1000),
              completed: false,
            }))
          }
        />
        <small>10자 이상 · 실제로 해볼 검사를 내 말로 남겨 주세요.</small>
        <button className="primary-button" onClick={onComplete}>
          학습 기록 마치기 <Check size={16} />
        </button>
      </div>
      {record.completed && canComplete(mission, record) && (
        <div className="learn-completed" role="status">
          <h3>직접 확인하는 연습을 마쳤어요.</h3>
          <p>
            예상, 관찰, 수정 요청과 검사 결과를 보관했습니다. 실습 완료는 실제 제품의 안전성이나
            실력 인증을 뜻하지 않습니다.
          </p>
          <div>
            {nextMission && (
              <Link className="primary-button" href={`/learn/${nextMission.id}`}>
                다음 미션 →
              </Link>
            )}
            <Link className="secondary-button" href="/learn">
              전체 학습 보기
            </Link>
          </div>
        </div>
      )}
    </>
  );
}

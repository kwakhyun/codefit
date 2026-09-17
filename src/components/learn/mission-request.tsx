"use client";
import {
  requestFields,
  requestReady,
  coachSnapshot,
  type LearningRecord,
  type LearningRecordUpdate,
} from "@/lib/learn/progress";
import type { Mission } from "@/lib/learn/catalog";
export function MissionRequest({
  mission,
  record,
  update,
  coach,
  busy,
  aiReady,
}: {
  mission: Mission;
  record: LearningRecord;
  update: LearningRecordUpdate;
  coach: () => Promise<void>;
  busy: boolean;
  aiReady: boolean;
}) {
  const filled = requestFields.filter((f) => record.request[f.key].trim().length >= 3).length;
  return (
    <section className="learn-request">
      <h3>AI에게 무엇을 요청할까요?</h3>
      <p>
        오류를 재현한 순서와 실제 결과를 바탕으로 수정 요청을 작성하세요.{" "}
        {mission.kind === "lab"
          ? "실습을 마치려면 다섯 항목을 채워 주세요."
          : "기초 미션에서는 선택 사항입니다."}
      </p>
      <span className="learn-chip">요청 항목 {filled} / 5</span>
      {requestFields.map((f) => (
        <label key={f.key} htmlFor={`request-${f.key}`}>
          {f.label}
          <textarea
            id={`request-${f.key}`}
            value={record.request[f.key]}
            placeholder={f.placeholder}
            maxLength={500}
            rows={2}
            onChange={(e) =>
              update((r) => ({
                ...r,
                completed: false,
                request: { ...r.request, [f.key]: e.target.value },
              }))
            }
          />
        </label>
      ))}
      <p className="learn-fineprint">
        각 항목에 3자 이상 적어 주세요. 작성 여부만 확인하며, 내용의 정확성을 자동으로 판정하지는
        않습니다.
      </p>
      <button className="secondary-button" disabled={busy || !aiReady} onClick={() => void coach()}>
        {busy ? "AI가 질문을 준비하는 중…" : "AI에게 보완할 점 묻기"}
      </button>
      <p className="learn-fineprint">
        {aiReady
          ? "선택한 미션과 작성 내용을 AI에 보냅니다. 기존 풀이 검토와 24시간 20회 한도를 공유합니다."
          : "AI 연결이 없어도 힌트와 동작 검사로 끝까지 연습할 수 있습니다."}
      </p>
      {record.coach && (
        <aside className="learn-coach" aria-label="AI 코치 질문">
          {record.coach.snapshot !== coachSnapshot(mission, record) && (
            <strong>이전 작성 내용에 대한 질문입니다.</strong>
          )}
          <p>{record.coach.reply.question}</p>
          <span>다음 확인: {record.coach.reply.nextCheck}</span>
        </aside>
      )}
      {requestReady(record) && (
        <p className="learn-success">
          다섯 항목을 모두 작성했습니다. 수정 후 문제가 해결됐는지, 기존 기능도 정상적으로
          작동하는지 확인하세요.
        </p>
      )}
    </section>
  );
}

import type { LearningLabController } from "@/hooks/use-learning-lab";

export function LearningCoachQuestion({ controller: c }: { controller: LearningLabController }) {
  const coach = c.training.coach;
  if (!coach) return null;
  return (
    <div className="lab-ai-question" aria-label="AI 맞춤 질문">
      <strong>
        {coach.evidenceId === "experiment"
          ? "실험 결과로 한 단계 더 생각하기"
          : "AI와 한 단계 더 생각하기"}
      </strong>
      <p className="muted">{coach.observation}</p>
      {coach.focus && (
        <div className="lab-coach-focus" aria-label="질문의 초점">
          {coach.focus.learnerQuote !== null && (
            <>
              <small>질문 당시 내 설명</small>
              <blockquote>{coach.focus.learnerQuote}</blockquote>
            </>
          )}
          <p>{coach.focus.goal}</p>
        </div>
      )}
      <p>{coach.question}</p>
      <small>다음 확인: {coach.nextCheck}</small>
      {coach.snapshot !== c.currentHash && (
        <p className="inline-warning">
          질문을 받은 뒤 코드가 바뀌었습니다. 이 질문은 요청 당시 코드에 대한 내용입니다.
        </p>
      )}
      {coach.evidenceSnapshot !== c.currentEvidenceHash && (
        <p className="inline-warning">
          이전 실행 기록을 바탕으로 받은 질문입니다. 현재 결과에 대한 질문은 다시 요청해 주세요.
        </p>
      )}
    </div>
  );
}

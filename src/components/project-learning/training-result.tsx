"use client";
import type { TrainingModuleView } from "@/lib/project-learning/types";
const confidence = { unsure: "아직 헷갈림", likely: "대체로 이해", certain: "확신함" };
export function TrainingResult({
  module: m,
  onNext,
  hasNext,
  contentId,
}: {
  module: TrainingModuleView;
  onNext: () => void;
  hasNext: boolean;
  contentId: string;
}) {
  const r = m.result!;
  const previousPractice = r.baseline.priorPractice;
  const help = r.baseline.assisted || r.transfer.assisted;
  function download() {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            version: 1,
            contentId,
            area: m.area,
            missionId: m.missionId,
            result: r,
            limits:
              "서로 다른 확인 문제 각 2개에 대한 첫 답변 기록. 사전 실습 및 도움 사용 표기. 학습 효과나 개발 역량 인증이 아님.",
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `codefit-learning-${m.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div className="training-result">
      <h4>
        {r.transfer.correct === 2
          ? "새로운 상황의 두 문제를 모두 맞혔어요"
          : "새로운 상황에서 헷갈린 부분을 확인했어요"}
      </h4>
      <div className="training-comparison">
        <div>
          <span>시작 전 질문</span>
          <strong>{r.baseline.correct} / 2</strong>
          <small>{confidence[r.baseline.confidence]}</small>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span>다른 상황의 질문</span>
          <strong>{r.transfer.correct} / 2</strong>
          <small>{confidence[r.transfer.confidence]}</small>
        </div>
      </div>
      {r.transfer.confidence === "certain" && r.transfer.correct < 2 && (
        <p className="training-note">
          확신했던 판단과 실제 기준이 달랐습니다. 아래 해설에서 놓친 조건을 확인해 보세요.
        </p>
      )}
      <ul className="training-evidence">
        <li>각 단계에서 처음 제출한 답변입니다.</li>
        <li>
          {previousPractice
            ? "시작 전 질문에 답하기 전에 연결된 실습을 완료한 기록이 있습니다."
            : "시작 전 질문에 답할 때는 연결된 실습의 완료 기록이 없었습니다."}
        </li>
        <li>
          {help
            ? "확인 문제에서 도움을 사용했다고 표시했습니다."
            : "확인 문제에서 도움을 사용하지 않았다고 표시했습니다. 외부 도움 여부는 직접 확인하지 않습니다."}
        </li>
        <li>실습에서 확인한 힌트: {r.transfer.practiceHints}단계</li>
      </ul>
      <p className="project-help">
        단계마다 서로 다른 두 문제를 풀었습니다. 문제의 난이도가 같다고 검증되지는 않았으므로, 점수
        차이를 학습 효과로 해석하기는 어렵습니다. AI 설명 점수와는 별도로 기록합니다.
      </p>
      {(["baseline", "transfer"] as const).map((phase) => (
        <details key={phase} className="training-explanation">
          <summary>
            {phase === "baseline" ? "시작 전 질문" : "다른 상황의 질문"} 답변과 해설
          </summary>
          {r.keys[phase].map((key, i) => (
            <article key={i}>
              <h5>
                {i + 1}. {r.probes[phase][i].question}
              </h5>
              <p>{r.probes[phase][i].scenario}</p>
              <p>내 답변: {r.probes[phase][i].choices[r[phase].answers[i]]}</p>
              <p>
                <strong>정답: {r.probes[phase][i].choices[key.answer]}</strong>
              </p>
              <p>{key.explanation}</p>
            </article>
          ))}
        </details>
      ))}
      <div className="training-actions">
        <button className="secondary-button" onClick={download}>
          내 확인 기록 내려받기
        </button>
        {hasNext && (
          <button className="primary-button" onClick={onNext}>
            다음 영역 연습하기 →
          </button>
        )}
      </div>
    </div>
  );
}

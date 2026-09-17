import Link from "next/link";
import { HANDOFF_TRACKS, handoffId } from "@/lib/handoff/catalog";
import type { HandoffDashboard } from "@/lib/handoff/learning";
import { problemUrl } from "@/lib/library-state";
import { dateLabel } from "@/lib/client-api";

type Track = (typeof HANDOFF_TRACKS)[number];
export function HandoffCard({
  track,
  index,
  learning,
}: {
  track: Track;
  index: number;
  learning?: HandoffDashboard["learning"][number];
}) {
  const action = learning?.next ?? { problemId: handoffId(track.key), label: "코드 분석 시작" };
  const latest = learning?.latest;
  return (
    <article className="handoff-card">
      <span className="eyebrow">
        {String(index + 1).padStart(2, "0")} /{" "}
        {track.domain === "frontend" ? "FRONTEND" : "BACKEND"}
      </span>
      <h2>{track.title}</h2>
      <p>{track.brief}</p>
      <span className="handoff-skill">{track.skill}</span>
      <Link
        className="primary-button"
        href={problemUrl(action.problemId, "/handoff")}
        aria-label={`${action.label} : ${track.title}`}
      >
        {action.label}
      </Link>
      {learning && <p className="handoff-next-reason">{learning.next.reason}</p>}
      {latest && (
        <div className="handoff-feedback">
          <strong>
            최근 {latest.problemId.endsWith("-transfer") ? "변형" : "기본"} 과제: AI 기준{" "}
            {latest.score}% 충족
          </strong>
          <p>
            {latest.assisted
              ? "서비스 내 힌트, 정답 또는 AI 질문 사용"
              : "서비스 내 힌트, 정답과 AI 질문 미사용"}
          </p>
          <Link className="text-button" href={problemUrl(latest.problemId, "/handoff", latest.id)}>
            검토한 코드와 피드백 보기 →
          </Link>
          {learning.weaknesses.length ? (
            <details>
              <summary>다시 연습할 부분 {learning.weaknesses.length}개</summary>
              <ul>
                {learning.weaknesses.map((w) => (
                  <li key={w.label}>
                    <strong>{w.label}</strong>
                    <p>{w.feedback}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : (
            <p>최근 제출은 기준을 모두 충족했습니다.</p>
          )}
          <p>
            {learning.retention === "independent"
              ? "7일 후 처음 제출한 변형 과제에서 코드핏의 도움 없이 AI 검토 기준을 충족했습니다."
              : learning.retention === "early"
                ? "변형 과제를 미리 제출해 7일 후 첫 제출 기록에는 포함되지 않습니다. 계속 연습할 수 있습니다."
                : learning.retention === "needs-practice"
                  ? "7일 후 첫 변형 풀이에서 도움을 사용했거나 일부 기준을 충족하지 못했습니다. 피드백을 확인하고 다시 연습하세요."
                  : "기본 과제를 처음 검토한 날로부터 7일 이상 지난 뒤 변형 과제를 처음 제출하면 복습 기록을 남깁니다."}
          </p>
          {!learning.due && learning.dueAt && (
            <small>다음 복습 권장: {dateLabel(learning.dueAt)} (기기 시간대)</small>
          )}
        </div>
      )}
      <div className="handoff-exercise-links">
        {action.problemId !== handoffId(track.key) && (
          <Link className="text-button" href={problemUrl(handoffId(track.key), "/handoff")}>
            기본 과제 열기 →
          </Link>
        )}
        <Link className="text-button" href={problemUrl(handoffId(track.key, true), "/handoff")}>
          {track.variantTitle} →
        </Link>
      </div>
    </article>
  );
}

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
  const action = learning?.next ?? { problemId: handoffId(track.key), label: "인수인계 시작" };
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
              ? "첫 지연 재도전에서 서비스 내 도움 없이 AI 기준을 충족했습니다."
              : learning.retention === "early"
                ? "첫 변형은 미리 연습했습니다. 지연 재도전 지표와 별도로 연습을 이어갑니다."
                : learning.retention === "needs-practice"
                  ? "첫 지연 재도전에는 보완할 점이나 도움 사용이 있었습니다. 최근 피드백으로 다시 연습하세요."
                  : "첫 지연 재도전은 최초 기본 과제 검토 7일 뒤부터 기록합니다."}
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

"use client";
import { Button } from "@/components/ui/primitives";
import { dateLabel } from "@/lib/client-api";
import type { Check } from "@/lib/project-check/types";

/** Switches between the first answer and each 보완 답변, with every score on one line. */
export function RevisionTimeline({
  check,
  onSelect,
  disabled = false,
}: {
  check: Check;
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const timeline = check.revisionTimeline ?? [];
  if (timeline.length < 2) return null;
  const scored = timeline.filter((item) => item.score !== undefined);
  return (
    <nav className="revision-timeline" aria-label="보완 답변 기록">
      <strong>보완 답변 기록</strong>
      <ol>
        {timeline.map((item) => {
          const name = item.revisionNumber ? `보완 답변 ${item.revisionNumber}차` : "처음 답변";
          const current = item.id === check.id;
          return (
            <li key={item.id}>
              <Button
                className="revision-timeline-item"
                aria-current={current ? "page" : undefined}
                disabled={disabled}
                onClick={() => !current && onSelect(item.id)}
              >
                <span>{name}</span>
                <strong>{item.score === undefined ? "평가 전" : `${item.score}점`}</strong>
                <small>{dateLabel(item.createdAt)}</small>
              </Button>
            </li>
          );
        })}
      </ol>
      {scored.length >= 2 && (
        <p className="project-help">
          점수 변화: {scored.map((item) => item.score).join(" → ")}. 같은 질문에 대한 설명을
          비교하며, AI 판단은 달라질 수 있고 점수 변화가 실제 기능 개선을 증명하지는 않습니다.
        </p>
      )}
    </nav>
  );
}

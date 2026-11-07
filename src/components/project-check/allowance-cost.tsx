"use client";
import { dateLabel } from "@/lib/client-api";
import { allowanceCost } from "@/lib/project-check/display";

/**
 * Shared preview for paid actions: "분석 횟수 1회 사용 · 남은 3회 · (초기화 시각)".
 * Give the action button `aria-describedby={id}` and disable it when `remaining < cost`.
 */
export function AllowanceCost({
  id,
  label,
  cost,
  remaining,
  resetsAt,
  className = "",
}: {
  id: string;
  label: string;
  cost: number;
  remaining: number;
  resetsAt?: string | null;
  className?: string;
}) {
  const value = allowanceCost({ label, cost, remaining, resetsAt, resetLabel: dateLabel });
  return (
    <p
      id={id}
      className={`allowance-cost ${className}`.trim()}
      data-insufficient={value.insufficient || undefined}
    >
      <span>{value.summary}</span>
      {value.insufficient && <strong>{value.reason}</strong>}
    </p>
  );
}

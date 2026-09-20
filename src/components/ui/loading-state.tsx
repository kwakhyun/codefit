import type { ReactNode } from "react";
import { Progress } from "./primitives";
export function LoadingState({
  children = "불러오는 중입니다",
  value,
  max = 100,
  className = "",
}: {
  children?: ReactNode;
  value?: number;
  max?: number;
  className?: string;
}) {
  return (
    <div className={`ui-loading ${className}`} role="status">
      <span className="ui-loading-label">
        <span aria-hidden="true">&gt;_</span> {children}
      </span>
      <Progress
        aria-label={value === undefined ? "응답 대기 중" : "진행률"}
        value={value}
        max={max}
      />
      {value !== undefined && <span>{Math.round((value / max) * 100)}%</span>}
    </div>
  );
}

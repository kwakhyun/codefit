import { ScreenSkeleton, type SkeletonVariant } from "./skeleton";
import type { ReactNode } from "react";
import { Progress } from "./primitives";
export function LoadingState({
  children = "불러오는 중입니다",
  value,
  variant = "cards",
  max = 100,
  className = "",
}: {
  children?: ReactNode;
  value?: number;
  variant?: SkeletonVariant;
  max?: number;
  className?: string;
}) {
  if (value === undefined)
    return <ScreenSkeleton variant={variant} label={children} className={className} />;
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

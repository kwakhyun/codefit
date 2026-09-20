import type { ReactNode } from "react";
export type SkeletonVariant =
  "cards" | "list" | "form" | "editor" | "lesson" | "profile" | "image" | "response" | "code";
function Line({ size = "full" }: { size?: "short" | "medium" | "full" }) {
  return <div className={`skeleton-shape skeleton-line is-${size}`} />;
}
export function ScreenSkeleton({
  variant = "cards",
  label = "화면을 불러오고 있습니다",
  className = "",
}: {
  variant?: SkeletonVariant;
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`screen-skeleton skeleton-${variant} ${className}`}
      role="status"
      aria-busy="true"
    >
      <span className="skeleton-label">{label}</span>
      <div className="skeleton-content" aria-hidden="true">
        {variant !== "image" && variant !== "response" && variant !== "code" && (
          <div className="skeleton-heading">
            <Line size="short" />
            <div className="skeleton-shape skeleton-title" />
            <Line size="medium" />
          </div>
        )}
        {variant === "response" ? (
          <div className="skeleton-response">
            <Line />
            <Line size="medium" />
            <Line size="short" />
          </div>
        ) : variant === "code" ? (
          <div className="skeleton-code skeleton-content">
            {Array.from({ length: 10 }, (_, i) => (
              <Line key={i} size={i % 3 === 0 ? "short" : "medium"} />
            ))}
          </div>
        ) : variant === "image" ? (
          <div className="skeleton-shape skeleton-image" />
        ) : variant === "list" ? (
          <div className="skeleton-panel">
            {Array.from({ length: 5 }, (_, i) => (
              <div className="skeleton-row" key={i}>
                <div className="skeleton-shape skeleton-icon" />
                <div>
                  <Line size="medium" />
                  <Line size="short" />
                </div>
                <div className="skeleton-shape skeleton-pill" />
              </div>
            ))}
          </div>
        ) : variant === "form" || variant === "profile" ? (
          <div className="skeleton-panel">
            <Line size="short" />
            <div className="skeleton-shape skeleton-field" />
            <Line size="short" />
            <div className="skeleton-shape skeleton-textarea" />
            <div className="skeleton-shape skeleton-button" />
          </div>
        ) : variant === "editor" ? (
          <div className="skeleton-columns">
            <div className="skeleton-panel">
              <Line />
              <Line />
              <Line size="medium" />
              <div className="skeleton-shape skeleton-textarea" />
            </div>
            <div className="skeleton-panel skeleton-code">
              {Array.from({ length: 9 }, (_, i) => (
                <Line key={i} size={i % 3 === 0 ? "short" : "medium"} />
              ))}
              <div className="skeleton-shape skeleton-button" />
            </div>
          </div>
        ) : variant === "lesson" ? (
          <div className="skeleton-panel">
            <div className="skeleton-tabs">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton-shape skeleton-pill" />
              ))}
            </div>
            <Line />
            <Line />
            <Line size="medium" />
            <div className="skeleton-shape skeleton-textarea" />
            <div className="skeleton-shape skeleton-button" />
          </div>
        ) : (
          <>
            <div className="skeleton-hero">
              <div>
                <div className="skeleton-shape skeleton-title" />
                <Line />
                <Line size="medium" />
                <div className="skeleton-shape skeleton-button" />
              </div>
              <div className="skeleton-shape skeleton-art" />
            </div>
            <div className="skeleton-grid">
              {[0, 1, 2].map((i) => (
                <div className="skeleton-panel" key={i}>
                  <div className="skeleton-shape skeleton-icon" />
                  <Line size="medium" />
                  <Line />
                  <Line size="short" />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

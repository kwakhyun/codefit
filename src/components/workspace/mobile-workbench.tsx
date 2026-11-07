"use client";
import { Button, TabButton } from "@/components/ui/primitives";
import type { Attempt } from "@/lib/problem";
import { Code2, FileText, ListChecks, LoaderCircle, Play, Sparkles, X } from "lucide-react";
import type { KeyboardEvent } from "react";

export type MobilePane = "problem" | "code" | "result";
const PANES: { id: MobilePane; label: string; target: string; Icon: typeof FileText }[] = [
  { id: "problem", label: "문제", target: "workspace-problem", Icon: FileText },
  { id: "code", label: "코드", target: "workspace-code", Icon: Code2 },
  { id: "result", label: "결과", target: "workspace-result", Icon: ListChecks },
];

/** Shown only at phone width (CSS). Panes stay mounted, so code, tests and results persist. */
export function MobilePaneTabs({
  pane,
  onChange,
  resultCount,
}: {
  pane: MobilePane;
  onChange: (pane: MobilePane) => void;
  resultCount: number;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = PANES.findIndex((p) => p.id === pane);
    const next =
      event.key === "ArrowRight"
        ? PANES[(index + 1) % PANES.length]
        : event.key === "ArrowLeft"
          ? PANES[(index + PANES.length - 1) % PANES.length]
          : event.key === "Home"
            ? PANES[0]
            : event.key === "End"
              ? PANES[PANES.length - 1]
              : null;
    if (!next) return;
    event.preventDefault();
    onChange(next.id);
    document.getElementById(`workspace-pane-tab-${next.id}`)?.focus();
  }
  return (
    <div className="mobile-pane-tabs" role="tablist" aria-label="작업 화면" onKeyDown={onKeyDown}>
      {PANES.map(({ id, label, target, Icon }) => (
        <TabButton
          key={id}
          id={`workspace-pane-tab-${id}`}
          role="tab"
          aria-selected={pane === id}
          aria-controls={target}
          tabIndex={pane === id ? 0 : -1}
          onClick={() => onChange(id)}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
          {id === "result" && resultCount > 0 && <small>{resultCount}</small>}
        </TabButton>
      ))}
    </div>
  );
}

/** Phone-width sticky actions; each switches to the result pane where the outcome appears. */
export function MobileActionBar({
  testsAvailable,
  testsRunning,
  reviewBusy,
  reviewDisabled,
  onTests,
  onReview,
}: {
  testsAvailable: boolean;
  testsRunning: boolean;
  reviewBusy: boolean;
  reviewDisabled: boolean;
  onTests: () => void;
  onReview: () => void;
}) {
  return (
    <div className="mobile-action-bar">
      {testsAvailable && (
        <Button className="secondary-button" disabled={testsRunning} onClick={onTests}>
          {testsRunning ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
          {testsRunning ? "실행 중" : "예시 테스트"}
        </Button>
      )}
      <Button className="primary-button" disabled={reviewDisabled} onClick={onReview}>
        {reviewBusy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
        {reviewBusy ? "검토 중" : "AI 검토 요청"}
      </Button>
    </div>
  );
}

/** Keeps the last review's unmet points next to the editor while the learner revises. */
export function RetryFeedback({
  attempt,
  requirements,
  onClose,
}: {
  attempt: Attempt;
  requirements: string[];
  onClose: () => void;
}) {
  const unmet = attempt.review.criteria.filter((c) => !c.passed);
  return (
    <aside className="retry-feedback" aria-labelledby="retry-feedback-title">
      <div>
        <strong id="retry-feedback-title">다시 풀 때 볼 보완할 점</strong>
        <Button className="icon-button" aria-label="보완할 점 닫기" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>
      <ul>
        {unmet.map((c) => (
          <li key={c.requirementIndex}>
            <b>요구사항 {c.requirementIndex + 1}</b> {requirements[c.requirementIndex]}
            <span>{c.feedback}</span>
          </li>
        ))}
        {attempt.review.improvements.map((text) => (
          <li key={text}>{text}</li>
        ))}
      </ul>
    </aside>
  );
}

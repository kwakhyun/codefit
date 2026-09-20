"use client";
import { useEffect, useId, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { actionLabel, type Action, type Mission } from "@/lib/learn/catalog";
import { experimentProgress, experimentSteps } from "@/lib/learn/simulation-guide";

type Position = {
  top: number;
  left: number;
  width: number;
  height: number;
  below: boolean;
  label: string;
  reveal: boolean;
  space: number;
};
export function ExperimentGuide({
  mission,
  actions,
  root,
  result,
  fixed,
  disabled,
}: {
  mission: Mission;
  actions: Action[];
  root: RefObject<HTMLElement | null>;
  result: string;
  fixed: boolean;
  disabled: boolean;
}) {
  const steps = experimentSteps(mission);
  const index = experimentProgress(mission, actions, steps);
  const step = steps[index];
  const [enabled, setEnabled] = useState(true);
  const [position, setPosition] = useState<Position | null>(null);
  const description = useId();
  const action = step?.action;
  const active = enabled && !disabled && Boolean(action);

  useEffect(() => {
    if (!active) return;
    const container = root.current;
    if (!container) return;
    let frame = 0;
    let described: HTMLElement | null = null;
    let previousDescription: string | null = null;
    function target() {
      return (
        container!.querySelector<HTMLElement>(`[data-sim-action="${action}"]`) ||
        container!.querySelector<HTMLElement>("[data-sim-reveal]")
      );
    }
    function clearDescription() {
      if (!described) return;
      if (previousDescription === null) described.removeAttribute("aria-describedby");
      else described.setAttribute("aria-describedby", previousDescription);
      described = null;
    }
    function measure() {
      const element = target();
      if (!element || element.closest("details:not([open])") || !element.getClientRects().length) {
        clearDescription();
        setPosition(null);
        return;
      }
      if (described !== element) {
        clearDescription();
        element.scrollIntoView({ block: "center", behavior: "instant" });
        described = element;
        previousDescription = element.getAttribute("aria-describedby");
        element.setAttribute(
          "aria-describedby",
          [previousDescription, description].filter(Boolean).join(" "),
        );
      }
      const rect = element.getBoundingClientRect();
      const next = {
        top: rect.top - 5,
        left: rect.left - 5,
        width: rect.width + 10,
        height: rect.height + 10,
        below: innerHeight - rect.bottom >= rect.top,
        space: Math.max(120, Math.max(innerHeight - rect.bottom, rect.top) - 32),
        label:
          element.dataset.guideLabel ||
          element.textContent?.trim() ||
          actionLabel(mission, action!),
        reveal: element.hasAttribute("data-sim-reveal"),
      };
      setPosition((last) => (last && JSON.stringify(last) === JSON.stringify(next) ? last : next));
    }
    function schedule() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setEnabled(false);
    }
    const observer = new ResizeObserver(schedule);
    observer.observe(container);
    const disclosure = container.closest("details");
    disclosure?.addEventListener("toggle", schedule);
    const mutation = new MutationObserver(schedule);
    mutation.observe(container, { childList: true, subtree: true });
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    window.addEventListener("keydown", escape);
    // Start alongside the real control. Later scrolling remains under the learner's control.
    frame = requestAnimationFrame(measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      disclosure?.removeEventListener("toggle", schedule);
      mutation.disconnect();
      clearDescription();
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("keydown", escape);
    };
  }, [active, action, index, description, mission, root]);

  function locate() {
    setEnabled(true);
    const target =
      root.current?.querySelector<HTMLElement>(`[data-sim-action="${action}"]`) ||
      root.current?.querySelector<HTMLElement>("[data-sim-reveal]");
    target?.scrollIntoView({ block: "center", behavior: "instant" });
    target?.focus({ preventScroll: true });
  }
  return (
    <>
      <div className="experiment-guide-bar" data-guide-step={index}>
        <div>
          <strong>
            {!step
              ? "안내된 실험을 마쳤습니다"
              : `${fixed ? "수정 후 재실험" : "버튼 따라 실험하기"} · ${index + 1}/${steps.length}`}
          </strong>
          <p>
            {disabled
              ? "조작 한도에 도달했습니다. 기록을 보관한 뒤 실험을 다시 시작하세요."
              : !step
                ? "첫 예상과 결과를 비교하세요. 원하는 버튼을 더 눌러보거나 다음 학습 단계로 이동할 수 있습니다."
                : step.optional
                  ? "필수 관찰 완료. 지금부터는 선택 실험이며, 바로 다음 학습 단계로 이동해도 됩니다."
                  : "강조된 실제 버튼을 누르면 다음 조작을 안내합니다."}
          </p>
        </div>
        {step && !disabled && (
          <button type="button" onClick={enabled ? () => setEnabled(false) : locate}>
            {enabled ? "안내 숨기기" : "조작 안내 다시 보기"}
          </button>
        )}
      </div>
      {active &&
        position &&
        createPortal(
          <div className="experiment-spotlight" data-testid="experiment-spotlight">
            <div
              aria-hidden="true"
              className="experiment-spotlight-ring"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                height: position.height,
              }}
            />
            <aside
              className={`experiment-spotlight-card ${position.below ? "at-bottom" : "at-top"}`}
              aria-label="실습 조작 안내"
              style={{ maxHeight: Math.min(360, position.space) }}
            >
              <div className="experiment-spotlight-heading">
                <span>
                  {step!.optional ? "선택 실험" : "필수 실험"} · {index + 1}/{steps.length}
                </span>
                <button
                  type="button"
                  onClick={() => setEnabled(false)}
                  aria-label="실습 조작 안내 닫기"
                >
                  닫기 ×
                </button>
              </div>
              <div id={description} aria-live="polite" aria-atomic="true">
                <strong>‘{position.label}’ 버튼을 누르세요</strong>
                <p>
                  {position.reveal
                    ? "처리 이력을 보고 있습니다. 상세 정보로 돌아가 실험을 이어가세요."
                    : step!.purpose}
                </p>
                {!position.reveal && (
                  <p>
                    <b>확인할 것</b> {step!.observe}
                  </p>
                )}
              </div>
              {actions.length > 0 && (
                <p className="experiment-last-result">
                  <b>방금 결과</b> {result}
                </p>
              )}
              <button className="experiment-locate" type="button" onClick={locate}>
                버튼 위치로 이동
              </button>
            </aside>
          </div>,
          document.body,
        )}
    </>
  );
}

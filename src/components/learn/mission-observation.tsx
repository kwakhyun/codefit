"use client";
import { useEffect, useRef } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Button, Card, Disclosure, DisclosureSummary } from "@/components/ui/primitives";
import { actionLabel, type Action, type Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
import { simulate, reproduced } from "@/lib/learn/simulation";
import { missionContext } from "@/lib/learn/context";
import { describeResult } from "@/lib/learn/services/rules";
import { SimulationView } from "./simulation-view";

const visibleActionNames: Partial<Record<Action, string>> = {
  save: "저장하기",
  "switch-user": "다른 사용자로 전환",
  "open-private": "문서 열기",
  quantity: "3개 담기",
  "invalid-quantity": "−1개 입력",
  filter: "완료",
  book: "예약하기",
  "repeat-book": "같은 예약 재전송",
  "new-booking": "15:00 시간 새로 예약",
};

export function MissionObservation({
  mission,
  record,
  update,
  evidence,
  canRestore,
  onRestart,
  onRestore,
  onContinue,
}: {
  mission: Mission;
  record: LearningRecord;
  update: LearningRecordUpdate;
  evidence: boolean;
  canRestore: boolean;
  onRestart: () => void;
  onRestore: () => void;
  onContinue: () => void;
}) {
  const summary = useRef<HTMLHeadingElement>(null);
  const previousEvidence = useRef(evidence);
  const observed = simulate(mission, record.actions);
  const requiredEnd = evidence
    ? record.actions.findIndex((_, index) =>
        reproduced(mission, record.actions.slice(0, index + 1)),
      )
    : -1;
  const requiredResult =
    requiredEnd >= 0 ? simulate(mission, record.actions.slice(0, requiredEnd + 1)) : observed;
  useEffect(() => {
    const justFinished = evidence && !previousEvidence.current;
    previousEvidence.current = evidence;
    if (!justFinished) return;
    // Let the final spotlight clean up before moving to the learning outcome.
    const frame = requestAnimationFrame(() => {
      summary.current?.focus({ preventScroll: true });
      summary.current
        ?.closest(".observation-checkpoint")
        ?.scrollIntoView({ block: "start", behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [evidence]);
  return (
    <>
      {!evidence && (
        <p className="learn-observation-guide">
          <strong>강조된 버튼을 순서대로 눌러보세요</strong>
          <span>
            {mission.reproduce
              .map((action) => {
                if (mission.app === "filter" && action === "refresh") return "전체 다시 보기";
                const label = actionLabel(mission, action);
                const button = !mission.service && visibleActionNames[action];
                return button || label;
              })
              .join(" → ")}
          </span>
          <span>실험을 마치면 결과 요약과 다음 단계 버튼이 나타납니다.</span>
        </p>
      )}
      <div className="mission-columns">
        <SimulationView
          mission={mission}
          finishOnRequired
          actions={record.actions}
          onAction={(a) => {
            if (record.actions.length < 80)
              update((x) => ({ ...x, completed: false, actions: [...x.actions, a] }));
          }}
        />
        <div className="learn-observations">
          {evidence ? (
            <Card as="section" className="observation-checkpoint" aria-label="실험 결과 요약">
              <span className="checkpoint-label">
                <Check size={18} aria-hidden="true" /> 필수 실험 완료
              </span>
              <h3 ref={summary} tabIndex={-1}>
                이번 실험에서 배운 원리
              </h3>
              <div className="checkpoint-evidence">
                <strong>실제 동작</strong>
                {mission.service && (
                  <p className="checkpoint-input">
                    입력: {mission.service.samples[requiredResult.service.selected].label}
                  </p>
                )}
                <p>
                  {(mission.app === "request" || mission.app === "booking") &&
                    `${requiredResult.online ? "온라인" : "오프라인"} 상태에서 `}
                  {mission.app === "access" && `현재 사용자 ${requiredResult.actor}: `}
                  {requiredResult.message}
                  {mission.app === "booking" && ` · 예약 ${requiredResult.bookings.length}건`}
                </p>
              </div>
              <div className="checkpoint-expected">
                <strong>지켜야 할 동작</strong>
                <p>
                  {mission.service
                    ? describeResult(
                        mission.service,
                        mission.service.samples[requiredResult.service.selected].expected,
                      )
                    : missionContext(mission).expected}
                </p>
              </div>
              <Button className="primary-button" onClick={onContinue}>
                3. 수정과 검사로 이동 <ArrowRight size={18} aria-hidden="true" />
              </Button>
              <p className="checkpoint-lesson">{mission.lesson}</p>
            </Card>
          ) : (
            <div className="observation-prediction">
              <h3>내 첫 예상</h3>
              <p>{mission.choices[record.prediction]}</p>
              {record.reason && <p className="muted">{record.reason}</p>}
              <p>버튼을 누른 뒤, 예상한 결과와 실제 화면이 같은지 확인하세요.</p>
            </div>
          )}
          <Disclosure className="observation-history">
            <DisclosureSummary>
              {evidence ? "내 예상과 실행 기록 다시 보기" : "실행 기록 보기"} (
              {record.actions.length}개)
            </DisclosureSummary>
            {evidence && (
              <>
                <h4>내 첫 예상</h4>
                <p>{mission.choices[record.prediction]}</p>
                {record.reason && <p>{record.reason}</p>}
              </>
            )}
            <h4>실행 기록</h4>
            {record.actions.length ? (
              <ol>
                {observed.trace.slice(-12).map((t, i) => (
                  <li key={`${i}:${t}`}>{t}</li>
                ))}
              </ol>
            ) : (
              <p>아직 누른 버튼이 없습니다.</p>
            )}
            {record.actions.length > 12 && (
              <p>최근 12개 동작입니다. 전체 기록은 내려받을 수 있습니다.</p>
            )}
            {record.actions.length >= 80 && (
              <p>관찰 기록 80개를 보관했습니다. 기록을 내려받고 다시 시작할 수 있습니다.</p>
            )}
          </Disclosure>
          {record.actions.length > 0 && (
            <Button className="text-button" onClick={onRestart}>
              기록 내려받고 관찰 다시 시작
            </Button>
          )}
          {canRestore && (
            <Button className="text-button" onClick={onRestore}>
              이전 관찰 복구
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

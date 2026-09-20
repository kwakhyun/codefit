"use client";
import { useEffect, useRef } from "react";
import { Check, ArrowRight } from "lucide-react";
import { Button, Card, Disclosure, DisclosureSummary } from "@/components/ui/primitives";
import { actionLabel, type Action, type Mission } from "@/lib/learn/catalog";
import type { LearningRecord, LearningRecordUpdate } from "@/lib/learn/progress";
import { simulate } from "@/lib/learn/simulation";
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
                <strong>방금 조작한 결과</strong>
                {mission.service && (
                  <p className="checkpoint-input">
                    입력: {mission.service.samples[observed.service.selected].label}
                  </p>
                )}
                <p>
                  {(mission.app === "request" || mission.app === "booking") &&
                    `${observed.online ? "온라인" : "오프라인"} 상태에서 `}
                  {mission.app === "access" && `현재 사용자 ${observed.actor}: `}
                  {mission.service && !observed.service.result
                    ? `입력을 바꿨습니다. 왼쪽에서 ‘${mission.service.operation}’ 버튼을 눌러 결과를 확인하세요.`
                    : observed.message}
                  {mission.app === "booking" && ` · 예약 ${observed.bookings.length}건`}
                </p>
              </div>
              <div className="checkpoint-expected">
                <strong>이 경우에 나와야 할 결과</strong>
                <p>
                  {mission.service
                    ? describeResult(
                        mission.service,
                        mission.service.samples[observed.service.selected].expected,
                      )
                    : mission.app === "price"
                      ? observed.quantity < 1
                        ? "수량에 −1을 넣었습니다. 주문 수량은 1개 이상이어야 하므로 금액을 계산하지 않고 ‘수량은 1개 이상 입력하세요’라고 안내해야 합니다."
                        : "노트 3개의 원래 가격은 30,000원입니다. 3개부터 10% 할인하므로 3,000원을 빼고 27,000원을 표시해야 합니다."
                      : mission.app === "access" && observed.actor === "지민"
                        ? "지민은 이 글의 작성자이므로 비공개 글을 읽을 수 있어야 합니다."
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

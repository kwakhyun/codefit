"use client";
import { Status, Button, FieldLabel, Input, Textarea } from "@/components/ui/primitives";
import { AppLink as Link } from "@/components/ui/primitives";
import { ArrowRight, RotateCcw, Send, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { EXPERIENCE_OPTIONS, GOAL_OPTIONS, TIME_OPTIONS, type GuideProfile } from "@/lib/guide";
import { useStartGuide } from "@/hooks/use-start-guide";
import { Modal } from "@/components/ui/modal";
import { FitMascot } from "./fit-mascot";

export default function GuidePanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const guide = useStartGuide(open);
  const close = () => {
    guide.suspend();
    onClose();
  };
  // Remount inputs if identity changes; free text must not follow another account.
  return (
    <Modal open={open} onClose={close} title="핏의 시작 가이드" className="guide-panel">
      <GuideConversation key={guide.identityVersion} guide={guide} onClose={close} />
    </Modal>
  );
}

function GuideConversation({
  guide,
  onClose,
}: {
  guide: ReturnType<typeof useStartGuide>;
  onClose: () => void;
}) {
  const [experience, setExperience] = useState<GuideProfile["experience"] | null>(null);
  const [goal, setGoal] = useState<GuideProfile["goal"] | null>(null);
  const [minutes, setMinutes] = useState<GuideProfile["minutes"] | null>(null);
  const [question, setQuestion] = useState("");
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(0);
  const bottom = useRef<HTMLDivElement>(null);
  const firstChoice = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const profile = experience && goal && minutes ? { experience, goal, minutes } : null;
  const hasReply = guide.exchanges.length > 0;
  useEffect(() => {
    if (hasReply || guide.busy) bottom.current?.scrollIntoView({ block: "nearest" });
  }, [guide.exchanges, guide.busy, hasReply]);
  function moveStep(next: number) {
    setStep(next);
    requestAnimationFrame(() => firstChoice.current?.focus());
  }
  const last = guide.exchanges.at(-1)?.reply;
  const submit = async (text: string, mode: "ai" | "basic" = "ai") => {
    if (!profile) return;
    const succeeded = await guide.send(profile, text, mode);
    if (succeeded) {
      setQuestion("");
      setEditing(false);
    }
  };
  return (
    <>
      <div className="guide-scroll">
        <div className="guide-welcome">
          <FitMascot size={76} />
          <div>
            <p className="guide-eyebrow">코드핏 안내 친구, 핏</p>
            <h2>
              어디서 시작할지
              <br />
              함께 찾아볼까요?
            </h2>
          </div>
        </div>
        <p className="guide-lead">
          경험과 목표에 맞는 첫 미션을 골라드려요.
          <br />
          로그인 없이 바로 시작할 수 있어요.
        </p>
        {!guide.status ? (
          <div className="guide-connect">
            <Status role="status">{guide.error || "가이드를 준비하고 있어요…"}</Status>
            {guide.error && (
              <Button className="secondary-button" onClick={guide.reconnect}>
                연결 다시 확인
              </Button>
            )}
          </div>
        ) : (
          <>
            {(!hasReply || editing) && (
              <form
                className="guide-preferences"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (step < 2) {
                    if ((step === 0 && experience) || (step === 1 && goal)) moveStep(step + 1);
                    return;
                  }
                  void submit("선택한 경험과 목표, 시간에 맞는 첫 미션을 추천해 줘.");
                }}
              >
                <div className="guide-steps" role="group" aria-label={`3단계 중 ${step + 1}단계`}>
                  <span>{step + 1} / 3</span>
                  {[0, 1, 2].map((index) => (
                    <i key={index} data-active={index <= step} />
                  ))}
                </div>
                {step === 0 && (
                  <fieldset disabled={guide.busy}>
                    <legend>1. 개발 경험은 어느 정도인가요?</legend>
                    {EXPERIENCE_OPTIONS.map((item, index) => (
                      <FieldLabel key={item.value}>
                        <Input
                          ref={index === 0 ? firstChoice : undefined}
                          type="radio"
                          name="guide-experience"
                          value={item.value}
                          checked={experience === item.value}
                          onChange={() => setExperience(item.value)}
                        />
                        <span>{item.label}</span>
                      </FieldLabel>
                    ))}
                  </fieldset>
                )}
                {step === 1 && (
                  <fieldset disabled={guide.busy}>
                    <legend>2. 무엇을 해보고 싶나요?</legend>
                    {GOAL_OPTIONS.map((item, index) => (
                      <FieldLabel key={item.value}>
                        <Input
                          ref={index === 0 ? firstChoice : undefined}
                          type="radio"
                          name="guide-goal"
                          value={item.value}
                          checked={goal === item.value}
                          onChange={() => setGoal(item.value)}
                        />
                        <span>{item.label}</span>
                      </FieldLabel>
                    ))}
                  </fieldset>
                )}
                {step === 2 && (
                  <fieldset disabled={guide.busy} className="guide-time">
                    <legend>3. 지금 얼마나 연습할 수 있나요?</legend>
                    {TIME_OPTIONS.map((item, index) => (
                      <FieldLabel key={item.value}>
                        <Input
                          ref={index === 0 ? firstChoice : undefined}
                          type="radio"
                          name="guide-time"
                          value={item.value}
                          checked={minutes === item.value}
                          onChange={() => setMinutes(item.value)}
                        />
                        <span>{item.label}</span>
                      </FieldLabel>
                    ))}
                  </fieldset>
                )}
                {step === 2 && (
                  <p className="guide-privacy">
                    AI 추천을 요청하면 선택한 답변과 대화를 OpenAI에 전달해요.{" "}
                    <Link href="/privacy" onClick={onClose}>
                      개인정보 안내
                    </Link>
                  </p>
                )}
                <Button
                  className="guide-primary"
                  disabled={
                    guide.busy || (step === 0 ? !experience : step === 1 ? !goal : !profile)
                  }
                  type="submit"
                >
                  {step < 2
                    ? "다음"
                    : guide.busy
                      ? "첫 미션을 고르고 있어요…"
                      : "내 시작점 추천받기"}
                  <ArrowRight size={17} />
                </Button>
                {step > 0 && (
                  <Button
                    type="button"
                    className="guide-text-button"
                    disabled={guide.busy}
                    onClick={() => moveStep(step - 1)}
                  >
                    이전 질문
                  </Button>
                )}
                {step === 2 && (
                  <Button
                    className="guide-text-button"
                    type="button"
                    disabled={!profile || guide.busy}
                    onClick={() => void submit("선택한 조건으로 추천해 줘.", "basic")}
                  >
                    AI 없이 선택한 답변으로 추천받기
                  </Button>
                )}
              </form>
            )}
            {hasReply && !editing && (
              <>
                <div className="guide-profile-summary">
                  <span>
                    {EXPERIENCE_OPTIONS.find((o) => o.value === experience)?.label} ·{" "}
                    {TIME_OPTIONS.find((o) => o.value === minutes)?.label}
                  </span>
                  <Button
                    onClick={() => {
                      guide.reset();
                      setEditing(true);
                      moveStep(0);
                    }}
                  >
                    선택 바꾸기
                  </Button>
                </div>
                <div
                  className="guide-chat-log"
                  role="log"
                  aria-label="핏과의 대화"
                  aria-live="polite"
                  aria-relevant="additions text"
                >
                  {guide.exchanges.map((exchange, index) => (
                    <div className="guide-exchange" key={index}>
                      {index > 0 && (
                        <p className="guide-user-message">
                          <span>나</span>
                          {exchange.question}
                        </p>
                      )}
                      <div className="guide-answer">
                        <span className="guide-reply-label">
                          핏 · {exchange.reply.source === "ai" ? "AI 맞춤 안내" : "선택 기반 안내"}
                        </span>
                        {exchange.reply.notice && (
                          <p className="guide-notice">{exchange.reply.notice}</p>
                        )}
                        <p>{exchange.reply.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {last && (
                  <article className="guide-recommendation">
                    <span>
                      여기서 시작해 보세요 · 약 {last.recommendation.minutes}분
                      {last.recommendation.id === "practice" ? " 동안 탐색" : ""}
                    </span>
                    <h3>{last.recommendation.title}</h3>
                    <p>{last.recommendation.description}</p>
                    <Link
                      href={last.recommendation.href}
                      className="guide-primary"
                      onClick={onClose}
                    >
                      {last.recommendation.action}
                      <ArrowRight size={17} />
                    </Link>
                  </article>
                )}
                {guide.status.aiReady ? (
                  <div className="guide-followups" role="group" aria-label="이어서 물어보기">
                    {["무엇을 먼저 살펴보면 좋을까?", "이 연습이 왜 도움이 될까?"].map((text) => (
                      <Button
                        key={text}
                        disabled={guide.busy}
                        onClick={() => {
                          setQuestion(text);
                          composer.current?.focus();
                        }}
                      >
                        {text}
                      </Button>
                    ))}
                  </div>
                ) : (
                  <p className="guide-lead">지금은 선택하신 경험과 목표에 맞춰 추천해 드려요.</p>
                )}
              </>
            )}
            {guide.error && (
              <Status className="guide-error" role="alert">
                {guide.error}
              </Status>
            )}
            {guide.busy && (
              <div className="guide-wait" role="status">
                <span>핏이 답변을 준비하고 있어요…</span>
                <Button onClick={guide.cancel}>
                  <Square size={12} />
                  중지
                </Button>
              </div>
            )}
          </>
        )}
        <div ref={bottom} />
      </div>
      {hasReply && !editing && guide.status?.aiReady && (
        <form
          className="guide-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (question.trim()) void submit(question.trim());
          }}
        >
          <FieldLabel htmlFor="guide-question">
            목표를 더 알려주거나 궁금한 점을 물어보세요
          </FieldLabel>
          <div>
            <Textarea
              ref={composer}
              id="guide-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={500}
              rows={2}
              placeholder="예: AI로 만든 서비스의 오류를 찾고 싶어요"
              disabled={guide.busy}
            />
            <Button
              type="submit"
              aria-label="핏에게 질문 보내기"
              disabled={!question.trim() || guide.busy}
            >
              <Send size={18} />
            </Button>
          </div>
          <p>학습 목표만 적어주세요. 코드·비밀번호·개인정보는 제외해 주세요.</p>
          <Button
            type="button"
            className="guide-text-button"
            onClick={() => {
              guide.reset();
              setQuestion("");
              setEditing(true);
              moveStep(0);
            }}
          >
            <RotateCcw size={13} />
            대화 지우고 다시 시작
          </Button>
        </form>
      )}
      <p className="guide-footer">
        AI는 잘못 안내할 수 있어요. AI 안내는 24시간에 비로그인 2회, 로그인 20회이며, 대화는
        새로고침하면 지워져요.
      </p>
    </>
  );
}

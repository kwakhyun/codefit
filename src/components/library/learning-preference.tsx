"use client";
import { FieldLabel, Input, Status, Button } from "@/components/ui/primitives";
import Image from "next/image";
import { useId, useRef, useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { useLearningPreference } from "@/hooks/use-learning-preference";
import { learnerTypes } from "@/lib/learner-types";
import { Modal } from "@/components/ui/modal";

export function LearningPreferencePicker({ onSelect }: { onSelect?: () => void }) {
  const { type, setType, storageError, hasChosen } = useLearningPreference();
  const group = useId();
  return (
    <section className="persona-picker" aria-label="나에게 맞는 시작점">
      <h2>오늘은 무엇을 해볼까요?</h2>
      <p className="persona-intro">
        서비스 점검, AI 활용, 코딩 연습. 고른 작업에 맞춰 홈과 메뉴가 달라집니다.
      </p>
      <fieldset className="persona-cards">
        <legend className="sr-only">작업 공간 선택</legend>
        {learnerTypes.map((item) => (
          <FieldLabel
            className={`persona-card ${hasChosen && type === item.id ? "is-selected" : ""}`}
            key={item.id}
          >
            <Input
              type="radio"
              name={group}
              value={item.id}
              checked={hasChosen && type === item.id}
              onChange={() => {
                setType(item.id);
                onSelect?.();
              }}
              aria-label={item.name}
            />
            <span className="persona-art" aria-hidden="true">
              <Image
                src={`/images/personas/${item.image}.webp`}
                width={1200}
                height={800}
                alt=""
                sizes="(max-width: 600px) 85vw, 320px"
              />
            </span>
            <span className="persona-copy">
              <small>{item.audience}</small>
              <strong>{item.name}</strong>
              <span>{item.description}</span>
            </span>
            <span className="persona-selected">
              <Check size={14} aria-hidden="true" />
              {hasChosen && type === item.id ? "선택됨" : "이 공간으로 시작"}
            </span>
          </FieldLabel>
        ))}
      </fieldset>
      <p className="persona-storage">
        선택은 이 브라우저에 저장됩니다. 로그인하거나 로그아웃해도 유지되며, 같은 브라우저를 쓰는
        사람에게도 적용됩니다. 학습 기록, 작성 중인 코드와 이용 권한은 바뀌지 않습니다.
      </p>
      {storageError && (
        <Status role="status">
          브라우저에 저장할 수 없어 현재 화면에서만 적용됩니다. 재방문할 때 다시 선택해 주세요.
        </Status>
      )}
    </section>
  );
}
export function PreferenceChangeButton() {
  const { profile } = useLearningPreference();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  function close() {
    setOpen(false);
    requestAnimationFrame(() => button.current?.focus());
  }
  return (
    <>
      <Button
        ref={button}
        className="persona-change"
        aria-haspopup="dialog"
        onClick={(event) => {
          event.currentTarget.focus();
          setOpen(true);
        }}
      >
        <SlidersHorizontal size={16} aria-hidden="true" />
        <span>
          <strong>{profile.name}</strong>
          <span>작업 공간 변경</span>
        </span>
      </Button>
      <Modal open={open} onClose={close} title="작업 공간 변경" className="persona-modal">
        {open && (
          <>
            <LearningPreferencePicker />
            <Button className="primary-button persona-done" onClick={close}>
              선택 완료
            </Button>
          </>
        )}
      </Modal>
    </>
  );
}

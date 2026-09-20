"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./modal";
import { Button } from "./primitives";

/** A shared, keyboard-accessible alternative to native confirm dialogs. */
export function useConfirmation() {
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<((answer: boolean) => void) | null>(null);
  useEffect(
    () => () => {
      pending.current?.(false);
      pending.current = null;
    },
    [],
  );
  function settle(answer: boolean) {
    const resolve = pending.current;
    pending.current = null;
    setMessage(null);
    resolve?.(answer);
  }
  function confirm(text: string): Promise<boolean> {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setMessage(text);
    });
  }
  return {
    confirm,
    confirmation: (
      <Modal
        open={message !== null}
        title="기록 삭제 확인"
        onClose={() => settle(false)}
        className="confirmation-modal"
      >
        <p>{message}</p>
        <div className="ui-dialog-actions">
          <Button type="button" onClick={() => settle(false)}>
            취소
          </Button>
          <Button type="button" className="danger-button" onClick={() => settle(true)}>
            삭제하기
          </Button>
        </div>
      </Modal>
    ),
  };
}

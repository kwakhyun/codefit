"use client";
import { useEffect, useRef, useState } from "react";
import { Modal } from "./modal";
import { Button } from "./primitives";

export type ConfirmationOptions = {
  /** Dialog title. Defaults to a deletion confirmation. */
  title?: string;
  /** Label of the confirming button. */
  confirmLabel?: string;
  /** "danger" styles the confirming button as destructive (default). */
  tone?: "danger" | "default";
  /** Optional list shown under the message, e.g. everything a deletion removes. */
  details?: string[];
};
type Request = ConfirmationOptions & { message: string };

/** A shared, keyboard-accessible alternative to native confirm dialogs. */
export function useConfirmation() {
  const [request, setRequest] = useState<Request | null>(null);
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
    setRequest(null);
    resolve?.(answer);
  }
  function confirm(message: string, options: ConfirmationOptions = {}): Promise<boolean> {
    if (pending.current) return Promise.resolve(false);
    return new Promise((resolve) => {
      pending.current = resolve;
      setRequest({ ...options, message });
    });
  }
  const tone = request?.tone || "danger";
  return {
    confirm,
    confirmation: (
      <Modal
        open={request !== null}
        title={request?.title || "기록 삭제 확인"}
        onClose={() => settle(false)}
        className="confirmation-modal"
      >
        <p>{request?.message}</p>
        {!!request?.details?.length && (
          <ul className="confirmation-details">
            {request.details.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        <div className="ui-dialog-actions">
          <Button type="button" onClick={() => settle(false)}>
            취소
          </Button>
          <Button
            type="button"
            className={tone === "danger" ? "danger-button" : "primary-button"}
            onClick={() => settle(true)}
          >
            {request?.confirmLabel || (tone === "danger" ? "삭제하기" : "확인")}
          </Button>
        </div>
      </Modal>
    ),
  };
}

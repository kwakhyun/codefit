"use client";
import { Button } from "@/components/ui/primitives";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])';

/** Keeps Tab inside the dialog in every browser instead of escaping to the browser chrome. */
function trapFocus(event: KeyboardEvent<HTMLDialogElement>) {
  if (event.key !== "Tab" || event.defaultPrevented) return;
  const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.tabIndex >= 0 && element.getClientRects().length > 0 && !element.closest("[inert]"),
  );
  const first = controls[0],
    last = controls[controls.length - 1];
  if (!first) return;
  const active = document.activeElement;
  if (event.shiftKey && (active === first || active === event.currentTarget)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && active === last) {
    event.preventDefault();
    first.focus();
  }
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
  busy = false,
  dismissible = true,
  closeLabel = "닫기",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  busy?: boolean;
  dismissible?: boolean;
  closeLabel?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-labelledby={titleId}
      aria-busy={busy}
      onKeyDown={trapFocus}
      onPointerDown={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        backdropPress.current =
          e.target === e.currentTarget &&
          (e.clientX < bounds.left ||
            e.clientX > bounds.right ||
            e.clientY < bounds.top ||
            e.clientY > bounds.bottom);
      }}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy && dismissible) onClose();
      }}
      onClick={(e) => {
        const bounds = e.currentTarget.getBoundingClientRect();
        const outside =
          e.clientX < bounds.left ||
          e.clientX > bounds.right ||
          e.clientY < bounds.top ||
          e.clientY > bounds.bottom;
        if (backdropPress.current && outside && e.target === ref.current && !busy && dismissible)
          onClose();
        backdropPress.current = false;
      }}
    >
      <div className="modal-heading">
        <h2 id={titleId} className="mono modal-title">
          {title}
        </h2>
        {dismissible && (
          <Button className="icon-button" aria-label={closeLabel} onClick={onClose} disabled={busy}>
            <X size={19} aria-hidden="true" />
          </Button>
        )}
      </div>
      {children}
    </dialog>
  );
}

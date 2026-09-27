"use client";
import { Button } from "@/components/ui/primitives";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
  busy = false,
  dismissible = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
  busy?: boolean;
  dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    else if (!open && dialog?.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={`modal ${className}`}
      aria-label={title}
      aria-busy={busy}
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
        <span className="mono">{title}</span>
        {dismissible && (
          <Button className="icon-button" aria-label="닫기" onClick={onClose} disabled={busy}>
            <X size={19} />
          </Button>
        )}
      </div>
      {children}
    </dialog>
  );
}

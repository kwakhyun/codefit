"use client";

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
      onCancel={(e) => {
        e.preventDefault();
        if (!busy && dismissible) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy && dismissible) onClose();
      }}
    >
      <div className="modal-heading">
        <span className="mono">{title}</span>
        {dismissible && (
          <button className="icon-button" aria-label="닫기" onClick={onClose} disabled={busy}>
            <X size={19} />
          </button>
        )}
      </div>
      {children}
    </dialog>
  );
}

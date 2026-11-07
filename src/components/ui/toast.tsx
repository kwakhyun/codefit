"use client";
import { AlertCircle, Check, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button } from "./primitives";

type Tone = "success" | "error";
type Toast = { id: number; message: string; tone: Tone };
const SUCCESS_DURATION = 4500;
const ToastContext = createContext({
  show: (message: string, tone: Tone = "success") => {
    void message;
    void tone;
  },
});

/** One app-wide notice stack. Errors stay until dismissed so they can be read at any pace. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const dismiss = useCallback(
    (id: number) => setToasts((items) => items.filter((item) => item.id !== id)),
    [],
  );
  const show = useCallback((message: string, tone: Tone = "success") => {
    if (!message) return;
    setToasts((items) => [
      // The same message replaces itself instead of stacking duplicates.
      ...items.filter((item) => item.message !== message).slice(-2),
      { id: Date.now() + Math.random(), message, tone },
    ]);
  }, []);
  const value = useMemo(() => ({ show }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport">
        {/* Both regions stay mounted so screen readers announce what is added to them. */}
        <div role="status" className="toast-stack">
          {toasts
            .filter((toast) => toast.tone === "success")
            .map((toast) => (
              <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
            ))}
        </div>
        <div role="alert" className="toast-stack">
          {toasts
            .filter((toast) => toast.tone === "error")
            .map((toast) => (
              <ToastItem key={toast.id} toast={toast} dismiss={dismiss} />
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}
function ToastItem({ toast, dismiss }: { toast: Toast; dismiss: (id: number) => void }) {
  useEffect(() => {
    if (toast.tone === "error") return;
    const timer = setTimeout(() => dismiss(toast.id), SUCCESS_DURATION);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);
  const error = toast.tone === "error";
  return (
    <div className={`toast ${error ? "toast-error" : ""}`}>
      {error ? (
        <AlertCircle size={16} aria-hidden="true" />
      ) : (
        <Check size={16} aria-hidden="true" />
      )}
      <span>{toast.message}</span>
      <Button className="icon-button" aria-label="알림 닫기" onClick={() => dismiss(toast.id)}>
        <X size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
export function useToast() {
  return useContext(ToastContext);
}

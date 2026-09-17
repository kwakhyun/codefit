"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/client-api";
import type { GuideInput, GuideMessage, GuideProfile, GuideReply, GuideStatus } from "@/lib/guide";

export type GuideExchange = { question: string; reply: GuideReply };

/** Conversation lives only in this tab's memory; validate ownership before showing it again. */
export function useStartGuide(open: boolean) {
  const [status, setStatus] = useState<GuideStatus | null>(null);
  const [exchanges, setExchanges] = useState<GuideExchange[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const owner = useRef<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const [identityVersion, setIdentityVersion] = useState(0);
  const cancel = useCallback(() => {
    active.current?.abort();
    active.current = null;
    setBusy(false);
  }, []);
  const reset = useCallback(() => {
    cancel();
    setExchanges([]);
    setError("");
  }, [cancel]);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    let revision = 0;
    async function sync() {
      const current = ++revision;
      cancel();
      setStatus(null);
      setError("");
      try {
        // Deliberately omit the cached workspace header: discover the current account first.
        const response = await fetch("/api/guide", {
          cache: "no-store",
          credentials: "same-origin",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
        });
        if (!response.ok) throw new Error("unavailable");
        const next: GuideStatus = await response.json();
        if (controller.signal.aborted || revision !== current) return;
        if (owner.current && owner.current !== next.scope) {
          setExchanges([]);
          setIdentityVersion((v) => v + 1);
        }
        owner.current = next.scope;
        setStatus(next);
      } catch {
        if (!controller.signal.aborted && revision === current)
          setError("가이드에 연결하지 못했어요. 연결 상태를 확인하고 다시 열어 주세요.");
      }
    }
    void sync();
    const visible = () => {
      if (!document.hidden) void sync();
    };
    window.addEventListener("focus", visible);
    document.addEventListener("visibilitychange", visible);
    return () => {
      controller.abort();
      active.current?.abort();
      active.current = null;
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [open, retry, cancel]);

  async function send(profile: GuideProfile, question: string, mode: GuideInput["mode"] = "ai") {
    if (!status || active.current) return false;
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    const messages: GuideMessage[] = exchanges.slice(-3).flatMap((entry) => [
      { role: "user" as const, content: entry.question },
      { role: "assistant" as const, content: entry.reply.message },
    ]);
    messages.push({ role: "user", content: question });
    try {
      const reply = await api<GuideReply>("/api/guide", {
        method: "POST",
        body: { profile, messages, mode },
        scope: status.scope,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(35_000)]),
      });
      if (controller.signal.aborted || active.current !== controller) return false;
      setExchanges((previous) => [...previous.slice(-2), { question, reply }]);
      return true;
    } catch (e) {
      if (!controller.signal.aborted && active.current === controller) {
        if (e instanceof ApiError && e.status === 409) {
          setExchanges([]);
          setStatus(null);
          setIdentityVersion((v) => v + 1);
        }
        setError(
          e instanceof ApiError
            ? e.message
            : "답변을 받지 못했어요. 입력한 내용은 남겨 뒀으니 다시 보내 주세요.",
        );
      }
      return false;
    } finally {
      if (active.current === controller) {
        active.current = null;
        setBusy(false);
      }
    }
  }
  return {
    status,
    exchanges,
    busy,
    error,
    identityVersion,
    send,
    reset,
    cancel,
    suspend: () => {
      cancel();
      setStatus(null);
    },
    reconnect: () => setRetry((v) => v + 1),
  };
}

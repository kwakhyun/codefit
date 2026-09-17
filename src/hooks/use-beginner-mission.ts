"use client";
import { useEffect, useRef, useState } from "react";
import { useCodeDraft } from "./use-code-draft";
import { api, errorMessage } from "@/lib/client-api";
import {
  coachSnapshot,
  emptyLearning,
  readLearning,
  type LearningRecord,
  type coachSchema,
} from "@/lib/learn/progress";
import type { z } from "zod";
import type { Mission } from "@/lib/learn/catalog";
import type { Progress } from "@/lib/problem";
export function useBeginnerMission(
  m: Mission,
  session: { scope: string; progress: Progress | null },
) {
  const mounted = useRef(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef<{ snapshot: string; id: string } | null>(null),
    active = useRef<AbortController | null>(null);
  const draft = useCodeDraft({
    id: `learn:${m.id}`,
    endpoint: `/api/learn/${m.id}`,
    scope: session.scope,
    mounted,
    onSaved: () => {},
    onError: setError,
  });
  const initialize = draft.initialize;
  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => {
      if (mounted.current) {
        initialize(session.progress, JSON.stringify(emptyLearning()));
        setReady(true);
      }
    });
    return () => {
      mounted.current = false;
      active.current?.abort();
    };
  }, [initialize, session.progress]);
  const record = readLearning(draft.code);
  function update(change: (r: LearningRecord) => LearningRecord) {
    const next = change(readLearning(draft.getCode()));
    draft.changeCode(JSON.stringify(next));
    setError("");
  }
  async function coach() {
    if (active.current) return;
    const r = readLearning(draft.getCode()),
      snapshot = coachSnapshot(m, r);
    if (request.current?.snapshot !== snapshot)
      request.current = { snapshot, id: crypto.randomUUID() };
    const c = new AbortController();
    active.current = c;
    setBusy(true);
    setError("");
    try {
      const reply = await api<z.infer<typeof coachSchema>>(`/api/learn/${m.id}/coach`, {
        method: "POST",
        scope: session.scope,
        body: { record: r, requestId: request.current.id },
        signal: AbortSignal.any([c.signal, AbortSignal.timeout(115000)]),
      });
      if (!mounted.current || c.signal.aborted) return;
      request.current = null;
      update((current) => ({ ...current, coach: { reply, snapshot } }));
    } catch (e) {
      if (mounted.current && !c.signal.aborted) setError(errorMessage(e));
    } finally {
      if (active.current === c) active.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return { draft, record, ready, error, setError, update, coach, busy };
}

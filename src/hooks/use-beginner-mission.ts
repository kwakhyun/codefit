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
import type { LearningSession } from "@/lib/learn/session";
export function useBeginnerMission(
  mission: Mission,
  session: Pick<LearningSession, "scope" | "progress">,
) {
  const mounted = useRef(false),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const request = useRef<{ snapshot: string; id: string } | null>(null),
    active = useRef<AbortController | null>(null);
  const draft = useCodeDraft({
    id: `learn:${mission.id}`,
    endpoint: `/api/learn/${mission.id}`,
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
  function update(change: (currentRecord: LearningRecord) => LearningRecord) {
    const next = change(readLearning(draft.getCode()));
    draft.changeCode(JSON.stringify(next));
    setError("");
  }
  async function coach() {
    if (active.current) return;
    const currentRecord = readLearning(draft.getCode()),
      snapshot = coachSnapshot(mission, currentRecord);
    if (request.current?.snapshot !== snapshot)
      request.current = { snapshot, id: crypto.randomUUID() };
    const controller = new AbortController();
    active.current = controller;
    setBusy(true);
    setError("");
    try {
      const reply = await api<z.infer<typeof coachSchema>>(`/api/learn/${mission.id}/coach`, {
        method: "POST",
        scope: session.scope,
        body: { record: currentRecord, requestId: request.current.id },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(115000)]),
      });
      if (!mounted.current || controller.signal.aborted) return;
      request.current = null;
      update((current) => ({ ...current, coach: { reply, snapshot } }));
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (active.current === controller) active.current = null;
      if (mounted.current) setBusy(false);
    }
  }
  return { draft, record, ready, error, update, coach, busy };
}

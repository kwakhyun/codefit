"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { readHandoffDraft, writeHandoffDraft } from "@/lib/handoff/draft";
import {
  codeHash,
  emptyTraining,
  type CoachReply,
  type LearningLab,
  type TrainingDraft,
} from "@/lib/handoff/training";
import { runInSandbox } from "@/lib/handoff/runner";

type Activity = "idle" | "observing" | "testing" | "coaching";
export function useLearningLab({
  id,
  scope,
  enabled,
  value,
  starterCode,
  onChange,
  initialStage = 0,
}: {
  id: string;
  scope: string;
  enabled: boolean;
  value: string;
  starterCode: string;
  onChange: (value: string) => void;
  initialStage?: number;
}) {
  const [lab, setLab] = useState<LearningLab | null>(null);
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [stage, changeStage] = useState(initialStage);
  const [editorSeen, setEditorSeen] = useState(false);
  const stageTarget = useRef(initialStage);
  const headingFocusPending = useRef(false);
  function setStage(next: number, focusHeading = true) {
    if (next === 2) setEditorSeen(true);
    if (stageTarget.current === next) return;
    stageTarget.current = next;
    headingFocusPending.current = focusHeading;
    changeStage(next);
  }
  useLayoutEffect(() => {
    // Focus the committed destination, without stealing subsequent input on a late frame.
    if (headingFocusPending.current && stageTarget.current === stage) {
      headingFocusPending.current = false;
      document.getElementById("lab-stage-title")?.focus();
    }
  }, [stage]);
  const [activity, setActivity] = useState<Activity>("idle");
  const [error, setError] = useState("");
  const [hashed, setHashed] = useState({ code: "", hash: "" });
  const latest = useRef({ value, onChange });
  const operation = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const request = useRef<{ code: string; id: string } | null>(null);
  useLayoutEffect(() => {
    latest.current = { value, onChange };
  }, [value, onChange]);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      operation.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    api<LearningLab>(`/api/problems/${encodeURIComponent(id)}/lab`, {
      scope,
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
    })
      .then((data) => {
        if (!controller.signal.aborted) {
          setLab(data);
          setLoadError("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted) setLoadError(errorMessage(e));
      });
    return () => controller.abort();
  }, [id, scope, enabled, reload]);
  const draft = readHandoffDraft(value);
  const training = draft.training ?? emptyTraining();
  const implementation = draft.implementation;
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void codeHash(implementation).then((hash) => {
      if (active) setHashed({ code: implementation, hash });
    });
    return () => {
      active = false;
    };
  }, [implementation, enabled]);

  const currentHash = hashed.code === implementation ? hashed.hash : "";
  function update(patch: (current: TrainingDraft) => TrainingDraft) {
    const current = readHandoffDraft(latest.current.value);
    const next = writeHandoffDraft(
      current.implementation,
      current.notes,
      patch(current.training ?? emptyTraining()),
    );
    if (next.length > 30000) {
      setError(
        "코드와 훈련 기록은 합쳐서 30,000자까지 보관할 수 있습니다. 내용을 줄인 뒤 다시 시도해 주세요.",
      );
      return false;
    }
    setError("");
    latest.current = { ...latest.current, value: next };
    latest.current.onChange(next);
    return true;
  }
  async function execute(kind: "observing" | "testing") {
    if (!lab || operation.current) return;
    const snapshot = readHandoffDraft(latest.current.value);
    if (kind === "observing" && !snapshot.training?.prediction.locked) {
      setError("결과를 보기 전에 예상과 이유를 먼저 남겨 주세요.");
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setActivity(kind);
    setError("");
    try {
      const code = kind === "observing" ? starterCode : snapshot.implementation;
      const results = await runInSandbox(
        code,
        kind === "observing" ? [lab.probe] : lab.checkpoints,
        controller.signal,
      );
      const hash = await codeHash(code);
      if (!mounted.current || controller.signal.aborted) return;
      if (kind === "observing") {
        // A restored/conflicting prediction belongs to a different learner snapshot.
        if (
          JSON.stringify(readHandoffDraft(latest.current.value).training?.prediction) !==
          JSON.stringify(snapshot.training?.prediction)
        ) {
          setError("실행 중 예측 기록이 바뀌었습니다. 현재 예측으로 다시 실행해 주세요.");
          return;
        }
        if (update((t) => ({ ...t, observation: results[0] }))) setStage(1);
      } else update((t) => ({ ...t, run: { codeHash: hash, suiteVersion: lab.version, results } }));
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setActivity("idle");
    }
  }
  async function coach() {
    if (!lab || operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setActivity("coaching");
    setError("");
    const snapshot = latest.current.value;
    if (request.current?.code !== snapshot)
      request.current = { code: snapshot, id: crypto.randomUUID() };
    try {
      const result = await api<CoachReply>(`/api/problems/${encodeURIComponent(id)}/coach`, {
        method: "POST",
        scope,
        body: { code: snapshot, requestId: request.current.id },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(115000)]),
      });
      const hash = await codeHash(readHandoffDraft(snapshot).implementation);
      if (!mounted.current || controller.signal.aborted) return;
      request.current = null;
      if (
        JSON.stringify(readHandoffDraft(latest.current.value).training?.prediction) !==
        JSON.stringify(readHandoffDraft(snapshot).training?.prediction)
      ) {
        setError(
          "질문을 기다리는 동안 예측 기록이 바뀌었습니다. 현재 예측으로 다시 요청해 주세요.",
        );
        return;
      }
      // Attach feedback to its source code; preserve all newer typing and notes.
      update((t) => ({ ...t, coach: { ...result, snapshot: hash } }));
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setActivity("idle");
    }
  }
  function lockPrediction() {
    const t = readHandoffDraft(latest.current.value).training ?? emptyTraining();
    if (
      !lab?.choices.some((c) => c.id === t.prediction.choice) ||
      t.prediction.reason.trim().length < 10
    ) {
      setError("예상 결과를 고르고 이유를 10자 이상 적어 주세요.");
      document
        .getElementById(t.prediction.choice ? "prediction-reason" : "prediction-choice-0")
        ?.focus();
      return;
    }
    if (update((current) => ({ ...current, prediction: { ...current.prediction, locked: true } })))
      void execute("observing");
  }
  return {
    lab,
    loadError,
    reload: () => setReload((n) => n + 1),
    stage,
    setStage,
    editorSeen,
    training,
    activity,
    error,
    currentHash,
    update,
    execute,
    coach,
    lockPrediction,
    cancel: () => operation.current?.abort(),
  };
}
export type LearningLabController = ReturnType<typeof useLearningLab>;

"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { readHandoffDraft, writeHandoffDraft } from "@/lib/handoff/draft";
import {
  codeHash,
  observationSourceText,
  coachingEvidenceText,
  experimentRunText,
  experimentMatches,
  type CoachingEvidence,
  emptyTraining,
  type ExperimentDraft,
  type CoachReply,
  type LearningLab,
  type TrainingDraft,
} from "@/lib/handoff/training";
import { runInSandbox } from "@/lib/handoff/runner";

type Activity = "idle" | "observing" | "testing" | "coaching" | "experimenting";
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
      const heading = document.getElementById("lab-stage-title");
      heading?.focus();
      heading?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }, [stage]);
  const [activity, setActivity] = useState<Activity>("idle");
  const [error, setError] = useState("");
  const [hashed, setHashed] = useState({
    code: "",
    hash: "",
    source: "",
    sourceHash: "",
    evidence: "",
    evidenceHash: "",
    experiment: "",
    experimentHash: "",
  });
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
  const sourceText = lab ? observationSourceText(starterCode, lab) : "";
  const evidenceText = coachingEvidenceText(
    training,
    training.coach?.evidenceId === "experiment" ? "experiment" : "prediction",
  );
  const experimentText = training.experiment?.run ? experimentRunText(training.experiment.run) : "";
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.all([
      codeHash(implementation),
      codeHash(sourceText),
      codeHash(evidenceText),
      codeHash(experimentText),
    ]).then(([hash, sourceHash, evidenceHash, experimentHash]) => {
      if (active)
        setHashed({
          code: implementation,
          hash,
          source: sourceText,
          sourceHash,
          evidence: evidenceText,
          evidenceHash,
          experiment: experimentText,
          experimentHash,
        });
    });
    return () => {
      active = false;
    };
  }, [implementation, sourceText, evidenceText, experimentText, enabled]);

  const currentHash = hashed.code === implementation ? hashed.hash : "";
  const currentSourceHash = sourceText && hashed.source === sourceText ? hashed.sourceHash : "";
  const currentEvidenceHash = hashed.evidence === evidenceText ? hashed.evidenceHash : "";
  const currentExperimentHash =
    experimentText && hashed.experiment === experimentText ? hashed.experimentHash : "";
  const observationStale = Boolean(
    training.observation &&
    (!currentSourceHash || training.observationSource !== currentSourceHash),
  );
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
      setError("결과를 보기 전에 예상 결과를 먼저 골라 주세요.");
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
      const source =
        kind === "observing" ? await codeHash(observationSourceText(code, lab)) : undefined;
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
        if (update((t) => ({ ...t, observation: results[0], observationSource: source })))
          setStage(1);
      } else update((t) => ({ ...t, run: { codeHash: hash, suiteVersion: lab.version, results } }));
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setActivity("idle");
    }
  }
  async function coach(evidence: CoachingEvidence = "prediction") {
    if (!lab || operation.current) return;
    const snapshot = latest.current.value;
    const snapshotTraining = readHandoffDraft(snapshot).training;
    if (!currentSourceHash || snapshotTraining?.observationSource !== currentSourceHash) {
      setError(
        "원본 코드나 실행 조건이 바뀌었거나 확인되지 않는 기록입니다. 원본을 다시 실행해 주세요.",
      );
      return;
    }
    if (
      evidence === "experiment" &&
      (!snapshotTraining.experiment ||
        !experimentMatches(
          snapshotTraining.experiment,
          currentSourceHash,
          currentHash,
          lab.version,
        ) ||
        !currentExperimentHash ||
        snapshotTraining.experiment.reflection?.runHash !== currentExperimentHash ||
        !snapshotTraining.experiment.reflection.text.trim())
    ) {
      setError("현재 실험을 실행하고 결과에서 알게 된 점을 적은 뒤 질문을 요청해 주세요.");
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setActivity("coaching");
    setError("");
    const requestKey = `${evidence}:${snapshot}`;
    if (request.current?.code !== requestKey)
      request.current = { code: requestKey, id: crypto.randomUUID() };
    try {
      const result = await api<CoachReply>(`/api/problems/${encodeURIComponent(id)}/coach`, {
        method: "POST",
        scope,
        body: { code: snapshot, requestId: request.current.id, evidence },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(115000)]),
      });
      const [hash, evidenceSnapshot] = await Promise.all([
        codeHash(readHandoffDraft(snapshot).implementation),
        codeHash(coachingEvidenceText(snapshotTraining, evidence)),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      request.current = null;
      if (
        coachingEvidenceText(
          readHandoffDraft(latest.current.value).training ?? emptyTraining(),
          evidence,
        ) !== coachingEvidenceText(snapshotTraining, evidence)
      ) {
        setError(
          "질문을 기다리는 동안 예측이나 실행 기록이 바뀌었습니다. 현재 기록으로 다시 요청해 주세요.",
        );
        return;
      }
      // Attach feedback to its source code; preserve all newer typing and notes.
      update((t) => ({ ...t, coach: { ...result, snapshot: hash, evidenceSnapshot } }));
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setActivity("idle");
    }
  }
  function experimentDraft(t: TrainingDraft): ExperimentDraft {
    return t.experiment ?? { expression: lab?.probe.expression ?? "", prediction: "" };
  }
  function editExperiment(patch: Partial<Pick<ExperimentDraft, "expression" | "prediction">>) {
    return update((t) => ({ ...t, experiment: { ...experimentDraft(t), ...patch } }));
  }
  function reflectOnExperiment(text: string) {
    const run = readHandoffDraft(latest.current.value).training?.experiment?.run;
    if (!run || !currentExperimentHash || experimentRunText(run) !== hashed.experiment)
      return false;
    return update((t) => ({
      ...t,
      experiment: { ...experimentDraft(t), reflection: { text, runHash: currentExperimentHash } },
    }));
  }
  async function runExperiment() {
    if (!lab || operation.current) return;
    const snapshot = readHandoffDraft(latest.current.value);
    const experiment = experimentDraft(snapshot.training ?? emptyTraining());
    if (!experiment.expression.trim()) {
      setError("실행할 실험 코드를 입력해 주세요.");
      return;
    }
    const controller = new AbortController();
    operation.current = controller;
    setActivity("experimenting");
    setError("");
    try {
      const test = [{ id: "experiment", expression: experiment.expression }];
      // Each version gets a fresh Worker/VM. No AI request, no server execution.
      const [original] = await runInSandbox(starterCode, test, controller.signal);
      const [current] = await runInSandbox(snapshot.implementation, test, controller.signal);
      const [hash, sourceHash] = await Promise.all([
        codeHash(snapshot.implementation),
        codeHash(observationSourceText(starterCode, lab)),
      ]);
      if (!mounted.current || controller.signal.aborted) return;
      const latestExperiment = experimentDraft(
        readHandoffDraft(latest.current.value).training ?? emptyTraining(),
      );
      if (
        latestExperiment.expression !== experiment.expression ||
        latestExperiment.prediction !== experiment.prediction
      ) {
        setError("실행 중 실험 코드나 예상이 바뀌었습니다. 현재 내용으로 다시 실행해 주세요.");
        return;
      }
      update((t) => ({
        ...t,
        experiment: {
          ...experimentDraft(t),
          run: {
            expression: experiment.expression,
            prediction: experiment.prediction,
            sourceHash,
            codeHash: hash,
            suiteVersion: lab.version,
            original,
            current,
          },
        },
      }));
    } catch (e) {
      if (mounted.current) setError(errorMessage(e));
    } finally {
      if (operation.current === controller) operation.current = null;
      if (mounted.current) setActivity("idle");
    }
  }
  function lockPrediction() {
    const t = readHandoffDraft(latest.current.value).training ?? emptyTraining();
    if (!lab?.choices.some((c) => c.id === t.prediction.choice)) {
      setError("예상 결과를 하나 골라 주세요.");
      document.getElementById("prediction-choice-0")?.focus();
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
    currentSourceHash,
    currentEvidenceHash,
    currentExperimentHash,
    observationStale,
    update,
    execute,
    coach,
    experiment: experimentDraft(training),
    editExperiment,
    reflectOnExperiment,
    runExperiment,
    lockPrediction,
    cancel: () => operation.current?.abort(),
  };
}
export type LearningLabController = ReturnType<typeof useLearningLab>;

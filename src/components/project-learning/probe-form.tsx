"use client";
import { Status, FieldLabel, Input, Button } from "@/components/ui/primitives";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api, errorMessage } from "@/lib/client-api";
import type {
  TrainingView,
  TrainingModuleView,
  TrainingInput,
  Confidence,
} from "@/lib/project-learning/types";
type Draft = { answers: [number, number]; confidence: Confidence | ""; assisted: boolean };
const empty: Draft = { answers: [-1, -1], confidence: "", assisted: false };
function readDraft(key: string): Draft {
  try {
    const d = JSON.parse(sessionStorage.getItem(key) || "null");
    if (
      d &&
      Array.isArray(d.answers) &&
      d.answers.length === 2 &&
      d.answers.every(
        (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= -1 && n <= 2,
      ) &&
      ["", "unsure", "likely", "certain"].includes(d.confidence) &&
      typeof d.assisted === "boolean"
    )
      return d;
  } catch {}
  return empty;
}
export function ProbeForm({
  id,
  scope,
  module: m,
  revision,
  disabled,
  onSaved,
}: {
  id: string;
  scope: string;
  module: TrainingModuleView;
  revision: number;
  disabled: boolean;
  onSaved: (v: TrainingView) => void;
}) {
  const key = `codefit-training:${scope}:${id}:${m.id}:${m.phase}`;
  const [draft, setDraft] = useState(() => readDraft(key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  function update(next: Draft) {
    setDraft(next);
    try {
      sessionStorage.setItem(key, JSON.stringify(next));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const input: TrainingInput = {
        id,
        moduleId: m.id,
        phase: m.phase as "baseline" | "transfer",
        revision,
        answers: draft.answers,
        confidence: draft.confidence as Confidence,
        assisted: draft.assisted,
      };
      const result = await api<TrainingView>("/api/project-check/training", {
        method: "POST",
        scope,
        body: input,
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
      });
      try {
        sessionStorage.removeItem(key);
      } catch {}
      onSaved(result);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <form className="training-probe" onSubmit={submit}>
      <p className="project-help">
        처음 제출한 답변이 저장됩니다. 정답과 해설은 두 단계의 답변을 모두 마친 뒤 볼 수 있습니다.
      </p>
      {m.phase === "baseline" && m.practiceCompleted && (
        <p className="training-note">
          이전에 완료한 실습입니다. 이번 결과에는 실습을 미리 마쳤다는 사실도 함께 기록합니다.
        </p>
      )}
      {storageError && (
        <Status role="alert">
          이 탭에 답변을 보관하지 못했습니다. 화면을 닫기 전에 제출해 주세요.
        </Status>
      )}
      <fieldset disabled={busy || disabled} className="training-fields">
        <legend className="sr-only">
          {m.phase === "baseline" ? "시작 전 질문" : "다른 상황에 적용"}
        </legend>
        {m.probes.map((p, i) => (
          <fieldset key={i} className="training-question">
            <legend>
              {i + 1}. {p.question}
            </legend>
            <p className="training-scenario">{p.scenario}</p>
            {p.choices.map((choice, j) => (
              <FieldLabel key={j}>
                <Input
                  type="radio"
                  name={`probe-${m.id}-${i}`}
                  checked={draft.answers[i] === j}
                  required
                  onChange={() => {
                    const answers: [number, number] = [...draft.answers];
                    answers[i] = j;
                    update({ ...draft, answers });
                  }}
                />
                <span>{choice}</span>
              </FieldLabel>
            ))}
          </fieldset>
        ))}
        <fieldset className="training-confidence">
          <legend>이번 판단에 얼마나 확신하나요?</legend>
          {(
            [
              ["unsure", "아직 헷갈려요"],
              ["likely", "대체로 알겠어요"],
              ["certain", "확신해요"],
            ] as const
          ).map(([value, label]) => (
            <FieldLabel key={value}>
              <Input
                type="radio"
                name={`confidence-${m.id}`}
                required
                checked={draft.confidence === value}
                onChange={() => update({ ...draft, confidence: value })}
              />
              {label}
            </FieldLabel>
          ))}
        </fieldset>
        <FieldLabel className="training-assisted">
          <Input
            type="checkbox"
            checked={draft.assisted}
            onChange={(e) => update({ ...draft, assisted: e.target.checked })}
          />
          이 확인 문제를 풀 때 힌트나 외부 도움을 사용했어요
        </FieldLabel>
        <Button
          className="primary-button"
          disabled={draft.answers.some((n) => n < 0) || !draft.confidence}
        >
          {busy
            ? "답변 저장 중…"
            : m.phase === "baseline"
              ? "첫 답변 저장하고 실습하기"
              : "답변 저장하고 결과 보기"}
          <ArrowRight size={16} />
        </Button>
      </fieldset>
      {error && (
        <Status role="alert" className="project-error">
          {error} 입력한 답변은 유지됩니다.
        </Status>
      )}
    </form>
  );
}

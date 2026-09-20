"use client";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import type { Check } from "@/lib/project-check/types";
import type { GeneratedPractice, PracticeMode } from "@/lib/project-check/generated-practice";
import {
  AppLink,
  Button,
  Card,
  FieldLabel,
  Input,
  Textarea,
  Progress,
} from "@/components/ui/primitives";
import { PracticeSources } from "./practice-sources";
export function ExerciseRunner({
  check,
  mode,
  saved,
  scope,
  onSaved,
}: {
  check: Check;
  mode: PracticeMode;
  saved: GeneratedPractice;
  scope: string;
  onSaved: (value: GeneratedPractice) => void;
}) {
  const responses = saved.progress[mode],
    tasks = saved.exercises[mode];
  const first = responses.findIndex((r) => !r.completed);
  const [index, setIndex] = useState(first >= 0 ? first : Math.min(responses.length, 2));
  const [choice, setChoice] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const previousIndex = useRef(index);
  useEffect(() => {
    if (previousIndex.current !== index) heading.current?.focus();
    previousIndex.current = index;
  }, [index]);
  const task = tasks[index],
    response = responses[index];
  const completed = responses.filter((r) => r.completed).length;
  async function save(finish: boolean) {
    if (lock.current) return;
    const answer = response?.choice ?? choice;
    if (answer === null) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const progress = [...responses];
    progress[index] = {
      choice: answer,
      note: note ?? response?.note ?? "",
      completed: finish || response?.completed || false,
    };
    try {
      const result = await api<GeneratedPractice>(`/api/project-check/${check.id}/practice`, {
        method: "PATCH",
        scope,
        body: { mode, revision: saved.revision, progress },
      });
      onSaved(result);
      setNotice("연습 기록을 저장했습니다.");
      if (finish && index < 2) {
        setIndex(index + 1);
        setChoice(null);
        setNote(null);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="practice-runner" aria-label="내 프로젝트 맞춤 연습">
      <div className="practice-stepbar">
        <strong>{completed === 3 ? "연습 완료" : `3개 중 ${completed}개 완료`}</strong>
        <Progress max={3} value={completed} aria-label="프로젝트 연습 진행률" />
      </div>
      <nav className="practice-origin" aria-label="실습 단계">
        {tasks.map((t, i) => (
          <Button
            key={t.title}
            disabled={busy || (i > 0 && !responses[i - 1]?.completed)}
            aria-current={i === index ? "step" : undefined}
            onClick={() => {
              setIndex(i);
              setChoice(null);
              setNote(null);
            }}
          >
            {i + 1}. {t.title}
          </Button>
        ))}
      </nav>
      <Card className="practice-exercise" key={index}>
        <span className="eyebrow">
          {mode === "code" ? "실제 코드 읽기" : "서비스 상황 비교"} · {index + 1}/3
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {task.title}
        </h2>
        <p>{task.purpose}</p>
        <div className="practice-scenario">
          <h3>이번에 확인할 상황</h3>
          <p>{task.situation}</p>
          <p className="muted">가정: {task.assumptions}</p>
        </div>
        <PracticeSources
          repository={check.page.repository!}
          evidence={task.evidence}
          expanded={mode === "code"}
        />
        <fieldset disabled={busy || !!response}>
          <legend>{task.question}</legend>
          {task.choices.map((text, i) => (
            <label key={i} className="practice-answer">
              <Input
                type="radio"
                name={`prediction-${index}`}
                checked={(response?.choice ?? choice) === i}
                onChange={() => setChoice(i)}
              />
              {text}
            </label>
          ))}
        </fieldset>
        {!response ? (
          <Button
            className="primary-button"
            disabled={choice === null || busy}
            onClick={() => save(false)}
          >
            {busy ? "예상 저장 중…" : "예상 저장하고 모의 결과 확인"}
          </Button>
        ) : (
          <div className="practice-explanation" aria-live="polite">
            <h3>
              {response.choice === task.answer
                ? "예상이 코드 흐름과 일치해요"
                : "코드 흐름과 예상이 달랐던 부분을 살펴보세요"}
            </h3>
            <p>
              이 조건에서 예상되는 결과: <strong>{task.choices[task.answer]}</strong>
            </p>
            <p className="muted">
              아래는 수집한 코드와 명시한 가정으로 만든 모의 과정입니다. 실제 저장소를 실행한 결과가
              아닙니다.
            </p>
            <ol className="practice-walkthrough">
              {task.walkthrough.map((step, i) => (
                <li key={i}>
                  <strong>{step.action}</strong>
                  <p>{step.result}</p>
                </li>
              ))}
            </ol>
            <p>{task.explanation}</p>
            <div className="practice-scenario">
              <h3>내 프로젝트에서는 이렇게 확인하세요</h3>
              <p>{task.verification}</p>
            </div>
            <FieldLabel htmlFor={`practice-note-${index}`}>
              내 설명 또는 실제 확인 기록 <span className="muted">선택</span>
            </FieldLabel>
            <Textarea
              id={`practice-note-${index}`}
              rows={4}
              maxLength={2000}
              value={note ?? response.note}
              onChange={(e) => {
                setNote(e.target.value);
                setNotice("");
              }}
              placeholder="이 결과가 나오는 이유를 내 말로 정리하거나, 테스트 환경에서 확인한 결과와 아직 확인하지 못한 점을 남겨 보세요."
            />
            <p className="muted">
              직접 확인하기 전에는 확인 예정으로 기록하세요. 이 기록은 AI가 채점하지 않습니다.
            </p>
            <div className="practice-origin">
              <Button disabled={busy} onClick={() => save(false)}>
                {busy ? "저장 중…" : "기록 저장"}
              </Button>
              <Button className="primary-button" disabled={busy} onClick={() => save(true)}>
                {index < 2 ? "이해했어요, 다음 상황으로" : "연습 마치기"}
              </Button>
            </div>
          </div>
        )}
        {error && (
          <div role="alert">
            <p>{error} 작성한 내용은 화면에 남아 있습니다.</p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const current = await api<GeneratedPractice>(
                    `/api/project-check/${check.id}/practice`,
                    { scope },
                  );
                  if (current) {
                    onSaved(current);
                    setError("");
                  } else setError("실습이 삭제되었습니다. 프로젝트 목록을 다시 확인해 주세요.");
                } catch (e) {
                  setError(errorMessage(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              최신 기록 불러오기
            </Button>
          </div>
        )}
      </Card>
      {notice && <p role="status">{notice}</p>}
      {completed === 3 && (
        <Card className="practice-complete" role="status">
          <h2>내 프로젝트의 세 가지 상황을 살펴봤어요</h2>
          <p>
            예상과 해설, 확인 기록이 저장되었습니다. 다음에는 실제 테스트 환경에서 결과를 확인해
            기록을 보완해 보세요.
          </p>
          <AppLink
            className="primary-button"
            href={`/project-practice?check=${check.id}&mode=${mode === "code" ? "service" : "code"}`}
          >
            {mode === "code" ? "서비스 동작 실습 이어하기" : "코드 이해 훈련 이어하기"} →
          </AppLink>
        </Card>
      )}
    </section>
  );
}

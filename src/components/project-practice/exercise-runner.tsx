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
const stages = [
  { title: "예상하기", description: "코드를 읽고 내 생각 남기기" },
  { title: "비교하기", description: "예상과 코드 흐름 비교" },
  { title: "설명하기", description: "이유를 정리하고 확인 계획 세우기" },
];
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
  const [stage, setStage] = useState(
    responses[first >= 0 ? first : Math.min(responses.length, 2)] ? 1 : 0,
  );
  const [reason, setReason] = useState("");
  const [choice, setChoice] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const previousStage = useRef(stage);
  const previousIndex = useRef(index);
  useEffect(() => {
    if (previousIndex.current !== index) heading.current?.focus();
    previousIndex.current = index;
  }, [index]);
  useEffect(() => {
    if (previousStage.current !== stage) stageHeading.current?.focus();
    previousStage.current = stage;
  }, [stage]);
  const task = tasks[index],
    response = responses[index];
  const service = mode === "service";
  const completed = responses.filter((r) => r.completed).length;
  const sourcePanel = (
    <div className="practice-study-source">
      <h3>{service ? "이 동작을 설명하는 코드 근거" : "결과의 근거가 되는 원본 코드"}</h3>
      <PracticeSources
        repository={check.page.repository!}
        evidence={task.evidence}
        expanded={!service}
      />
      {!!task.guidance?.terms.length && (
        <div className="practice-glossary">
          <h3>코드 속 용어</h3>
          <dl>
            {task.guidance.terms.map(({ term, meaning }) => (
              <div key={term}>
                <dt>{term}</dt>
                <dd>{meaning}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <div className="practice-reading-guide">
        <h3>{service ? "동작을 이해하는 순서" : "이 순서로 읽어보세요"}</h3>
        <ol>
          {(
            task.guidance?.readingSteps ?? [
              "상황에 나온 입력값과 조건을 코드에서 찾아보세요.",
              "그 조건을 통과한 뒤 반환하거나 바꾸는 값을 따라가 보세요.",
            ]
          ).map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>
    </div>
  );
  const stageDescriptions = service
    ? ["상황을 보고 내 생각 남기기", "예상과 서비스 결과 비교", "원리와 확인 방법 정리"]
    : stages.map((item) => item.description);
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
      predictionReason: response?.predictionReason ?? reason,
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
      if (!response) setStage(1);
      if (finish && index < 2) {
        setIndex(index + 1);
        setStage(0);
        setReason("");
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
            key={`${mode}-${i}`}
            disabled={busy || (i > 0 && !responses[i - 1]?.completed)}
            aria-current={i === index ? "step" : undefined}
            onClick={() => {
              setIndex(i);
              setStage(responses[i] ? 1 : 0);
              setReason("");
              setChoice(null);
              setNote(null);
            }}
          >
            {i + 1}. {t.title}
          </Button>
        ))}
      </nav>
      <Card className={`practice-exercise${service ? " practice-service" : ""}`} key={index}>
        <span className="eyebrow">
          {service ? "서비스 원리 실습" : "실제 코드 읽기"} · {index + 1}/3
        </span>
        <h2 ref={heading} tabIndex={-1}>
          {task.title}
        </h2>
        <nav className="practice-stages" aria-label="문제 학습 단계">
          {stages.map((item, i) => (
            <Button
              key={item.title}
              disabled={busy || (i > 0 && !response)}
              aria-current={stage === i ? "step" : undefined}
              onClick={() => setStage(i)}
            >
              <span className="practice-stage-number">{i + 1}</span>
              <span>
                <strong>{item.title}</strong>
                <small>{stageDescriptions[i]}</small>
              </span>
            </Button>
          ))}
        </nav>
        <div className="practice-stage-heading">
          <h3 ref={stageHeading} tabIndex={-1}>
            {stage + 1}. {stages[stage].title}
          </h3>
          <p className="muted">
            {
              [
                service
                  ? "사용자의 행동과 바뀐 조건을 보고 서비스에 어떤 변화가 생길지 예상해 보세요."
                  : "코드를 고치기 전에, 주어진 상황에서 어떤 결과가 나올지 예상해 보세요. 틀려도 괜찮아요.",
                "내 예상과 다른 부분이 있다면, 결과를 결정하는 조건부터 따라가 보세요.",
                "결과를 바꾼 조건을 내 말로 정리하고, 실제로 확인할 방법을 남겨보세요.",
              ][stage]
            }
          </p>
        </div>
        {stage === 0 && (
          <div className="practice-learning-goal">
            <h3>내 서비스에서는 언제 필요할까요?</h3>
            <p>{task.purpose}</p>
            {task.guidance && (
              <p>
                <strong>이번에 배울 것</strong> — {task.guidance.goal}
              </p>
            )}
          </div>
        )}
        {stage < 2 && (
          <div className="practice-study-layout">
            {!service && sourcePanel}
            <div className="practice-study-work">
              {service && task.serviceScenario && (
                <section className="practice-service-scene" aria-label="서비스 실습 조건">
                  <h3>이번에 비교할 서비스 상황</h3>
                  <dl>
                    {[
                      ["누가", task.serviceScenario.actor],
                      ["어떤 행동을 하나요?", task.serviceScenario.action],
                      ["시작 상태", task.serviceScenario.before],
                      ["바꿔볼 조건", task.serviceScenario.changed],
                      ["관찰할 것", task.serviceScenario.observe],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="muted">이 실습에서 정한 조건: {task.assumptions}</p>
                </section>
              )}
              {(!service || !task.serviceScenario) && (
                <div className="practice-scenario">
                  <h3>{service ? "실습에 사용할 조건" : "이번에 살펴볼 상황"}</h3>
                  <p>{task.situation}</p>
                  <p className="muted">이 문제에서 정한 조건: {task.assumptions}</p>
                </div>
              )}
              {stage === 0 ? (
                <div className="practice-prediction">
                  <fieldset disabled={busy || !!response}>
                    <legend>{task.question}</legend>
                    <p className="muted">
                      {service
                        ? "사용자에게 보이는 결과나 저장된 상태가 어떻게 달라질지 골라보세요."
                        : "원본 코드가 주어진 조건에서 어떻게 동작하는지 골라보세요."}
                    </p>
                    {task.choices.map((text, i) => (
                      <label key={i} className="practice-answer">
                        <Input
                          type="radio"
                          name={`prediction-${index}`}
                          checked={(response?.choice ?? choice) === i}
                          onChange={() => setChoice(i)}
                        />
                        <span>{text}</span>
                      </label>
                    ))}
                  </fieldset>
                  <FieldLabel htmlFor={`practice-reason-${index}`}>
                    왜 그렇게 생각했나요? <span className="muted">선택</span>
                  </FieldLabel>
                  <Textarea
                    id={`practice-reason-${index}`}
                    rows={3}
                    maxLength={800}
                    value={response?.predictionReason ?? reason}
                    readOnly={!!response}
                    disabled={busy}
                    placeholder="눈여겨본 조건이나 값이 있다면 적어보세요."
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <p className="muted">첫 예상은 비교 단계에서도 보관됩니다.</p>
                  <Button
                    className="primary-button"
                    disabled={busy || (!response && choice === null)}
                    onClick={() => (response ? setStage(1) : save(false))}
                  >
                    {busy
                      ? "예상 저장 중…"
                      : response
                        ? service
                          ? "저장한 예상과 서비스 결과 비교"
                          : "저장한 예상과 코드 흐름 비교"
                        : service
                          ? "예상 저장하고 서비스 결과 비교"
                          : "예상 저장하고 코드 흐름 비교"}
                  </Button>
                </div>
              ) : (
                response && (
                  <div className="practice-comparison" aria-live="polite">
                    <h3>
                      {response.choice === task.answer
                        ? "예상이 코드 흐름과 일치해요"
                        : "어떤 조건에서 예상과 달라졌을까요?"}
                    </h3>
                    <div className="practice-result-pair">
                      <div>
                        <strong>내가 예상한 결과</strong>
                        <p>{task.choices[response.choice]}</p>
                        {response.predictionReason && (
                          <p className="muted">내가 적은 이유: {response.predictionReason}</p>
                        )}
                      </div>
                      <div>
                        <strong>
                          {service ? "근거로 설명한 서비스 결과" : "코드를 따라간 결과"}
                        </strong>
                        <p>{task.choices[task.answer]}</p>
                      </div>
                    </div>
                    <p className="muted">
                      수집한 코드와 문제의 조건을 따라간 해설입니다. 실제 저장소를 실행한 결과는
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
                    <div className="practice-learning-goal">
                      <h3>왜 이런 결과가 나올까요?</h3>
                      <p>{task.explanation}</p>
                      {task.guidance && (
                        <p>
                          <strong>기억할 점</strong> — {task.guidance.takeaway}
                        </p>
                      )}
                    </div>
                    <Button className="primary-button" onClick={() => setStage(2)}>
                      내 말로 설명하기
                    </Button>
                  </div>
                )
              )}
            </div>
            {service && sourcePanel}
          </div>
        )}
        {stage === 2 && response && (
          <div className="practice-explanation">
            {task.guidance && (
              <div className="practice-learning-goal">
                <h3>이번에 배운 것</h3>
                <p>{task.guidance.takeaway}</p>
              </div>
            )}
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
              placeholder="어떤 조건이 결과를 결정했나요? 조건을 바꾸면 어떻게 될까요? 실제 확인한 내용은 따로 적어보세요."
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

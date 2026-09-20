"use client";
import { ExecutionWait } from "./execution-wait";
import { ScenarioVisual } from "@/components/ui/scenario-visual";
import { VoiceInput } from "@/components/ui/voice-input";
import { scenarioFor } from "@/lib/scenario-visuals";
import { ArrowRight, Check, LoaderCircle, Play, Sparkles } from "lucide-react";
import { sameOutput } from "@/lib/handoff/training";
import type { LearningLabController } from "@/hooks/use-learning-lab";
import { LearningCoachQuestion } from "./learning-coach-question";
import { LearningExperiment } from "./learning-experiment";

const steps = [
  { title: "예측하기", description: "실행 전에 내 생각 남기기" },
  { title: "비교하기", description: "예상과 실제 동작 비교" },
  { title: "수정하기", description: "코드를 고치고 테스트" },
  { title: "설명하기", description: "이유를 정리하고 응용" },
];
export function LearningLab({
  problemId,
  controller: c,
  starterCode,
  aiReady,
  blocked,
}: {
  problemId: string;
  controller: LearningLabController;
  starterCode: string;
  aiReady: boolean;
  blocked: boolean;
}) {
  const { lab, training: t, activity, stage } = c;
  const busy = activity !== "idle";
  const choice = lab?.choices.find((item) => item.id === t.prediction.choice);
  const observation = t.observation;
  const correct =
    observation?.status === "ok" &&
    choice &&
    sameOutput(observation.actual, JSON.parse(choice.output));
  function move(index: number) {
    c.setStage(index);
  }
  return (
    <section className="learning-lab" aria-label="코드 이해 훈련">
      <div className="lab-intro">
        <span className="eyebrow">READ → PREDICT → VERIFY</span>
        <span>교육용 JavaScript · 틀린 예상도 좋은 출발점입니다.</span>
      </div>
      <nav className="lab-steps" aria-label="코드 이해 훈련 단계">
        {steps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            aria-current={stage === index ? "step" : undefined}
            onClick={() => move(index)}
          >
            <span className="lab-step-number">{index + 1}</span>
            <span>
              <strong>{step.title}</strong>
              <small>{step.description}</small>
            </span>
          </button>
        ))}
      </nav>
      <div className="lab-stage-header">
        <h2 id="lab-stage-title" tabIndex={-1}>
          {stage + 1}. {steps[stage].title}
        </h2>
        <p>
          {
            [
              "아직 고치지 마세요. 원본 코드를 읽고 결과와 이유를 먼저 예상해 보세요.",
              "예상이 달랐다면, 값이 바뀌는 지점이나 실행 순서를 따라가 보세요.",
              "문제의 요구사항을 읽고 코드를 수정하세요. 테스트 결과는 실행한 코드에만 해당합니다.",
              "왜 그렇게 동작하는지 내 말로 정리하세요. AI는 코드와 설명을 함께 검토합니다.",
            ][stage]
          }
        </p>
      </div>
      {scenarioFor(problemId) && <ScenarioVisual scene={scenarioFor(problemId)!} stage={stage} />}
      {c.loadError ? (
        <p className="inline-error" role="alert">
          {c.loadError}{" "}
          <button className="text-button" onClick={c.reload}>
            훈련 다시 불러오기
          </button>
        </p>
      ) : !lab ? (
        <p role="status">실행 시나리오를 불러오는 중…</p>
      ) : null}
      {stage === 0 && lab && (
        <div className="lab-prediction-layout">
          <div className="lab-source">
            <div className="lab-source-title">
              <span>인수받은 원본</span>
              <span>JavaScript</span>
            </div>
            <pre tabIndex={0} aria-label="예측할 원본 코드">
              <code>{starterCode}</code>
            </pre>
            <details>
              <summary>실행할 입력과 관찰 코드</summary>
              <pre tabIndex={0}>
                <code>{lab.probe.expression}</code>
              </pre>
            </details>
            <p>{lab.probe.note}</p>
          </div>
          <div className="lab-prediction">
            <fieldset disabled={t.prediction.locked}>
              <legend>{lab.question}</legend>
              {lab.choices.map((option, index) => (
                <label
                  className={`lab-choice ${t.prediction.choice === option.id ? "selected" : ""}`}
                  key={option.id}
                >
                  <input
                    id={`prediction-choice-${index}`}
                    type="radio"
                    name="prediction"
                    value={option.id}
                    checked={t.prediction.choice === option.id}
                    onChange={() =>
                      c.update((current) => ({
                        ...current,
                        prediction: { ...current.prediction, choice: option.id },
                      }))
                    }
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            <label htmlFor="prediction-reason">
              왜 그렇게 생각했나요? <span className="optional-label">선택</span>
            </label>
            <textarea
              id="prediction-reason"
              value={t.prediction.reason}
              readOnly={t.prediction.locked}
              maxLength={800}
              rows={3}
              placeholder="떠오르는 이유가 있다면 적거나 말해 주세요."
              aria-describedby="prediction-help"
              onChange={(e) =>
                c.update((current) => ({
                  ...current,
                  prediction: { ...current.prediction, reason: e.target.value },
                }))
              }
            />
            <small id="prediction-help">
              {t.prediction.reason.length}/800자 · 실행 후에도 첫 예상은 보존됩니다.
            </small>
            <VoiceInput
              targetId="prediction-reason"
              disabled={t.prediction.locked}
              onTranscript={(text) =>
                c.update((current) => ({
                  ...current,
                  prediction: {
                    ...current.prediction,
                    reason:
                      `${current.prediction.reason}${current.prediction.reason ? " " : ""}${text}`.slice(
                        0,
                        800,
                      ),
                  },
                }))
              }
            />
            {t.prediction.locked && (
              <p className="lab-saved-prediction">
                <Check size={14} /> 첫 예측을 보관했습니다. 달라진 생각은 마지막 분석 메모에
                남기세요.
              </p>
            )}
            <button
              className="primary-button"
              disabled={busy}
              onClick={() =>
                t.observation
                  ? move(1)
                  : t.prediction.locked
                    ? void c.execute("observing")
                    : c.lockPrediction()
              }
            >
              {activity === "observing" ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Play size={16} />
              )}
              {activity === "observing"
                ? "원본 실행 중"
                : t.observation
                  ? "비교 결과 다시 보기"
                  : t.prediction.locked
                    ? "원본 다시 실행"
                    : "예측을 남기고 원본 실행"}
            </button>
          </div>
        </div>
      )}
      {stage === 1 && lab && (
        <div className="lab-observation">
          {!observation ? (
            <div className="lab-empty">
              <p>첫 예상과 실제 결과를 나란히 확인할 수 있습니다.</p>
              <button className="secondary-button" onClick={() => move(0)}>
                먼저 예측하기
              </button>
            </div>
          ) : (
            <>
              <div className="lab-comparison">
                <div>
                  <span>내가 예상한 결과</span>
                  <strong>{choice?.label || "예측 기록 없음"}</strong>
                  <p>{t.prediction.reason}</p>
                </div>
                <div className={!c.observationStale && correct ? "matches" : "differs"}>
                  <span>
                    {c.observationStale ? "이전에 보관한 실행 결과" : "원본의 실제 실행 결과"}
                  </span>
                  <pre>{observation.actual}</pre>
                  <strong>
                    {c.observationStale
                      ? "현재 원본으로 다시 확인해 주세요"
                      : observation.status === "error"
                        ? "실행 오류를 확인해 주세요"
                        : correct
                          ? "예상과 일치했어요"
                          : "예상과 다른 결과가 나왔어요"}
                  </strong>
                </div>
              </div>
              {c.observationStale ? (
                <p className="inline-warning" role="status">
                  원본 코드나 실행 조건이 바뀌었거나 확인되지 않는 이전 기록입니다. 첫 예상은
                  유지하며, 원본을 다시 실행한 뒤 AI 질문을 받을 수 있습니다.
                </p>
              ) : (
                <p className="lab-evidence-note">
                  내 브라우저에서 원본 코드를 실행한 결과입니다. AI 판정이 아닙니다.{" "}
                  {correct
                    ? "한 사례를 맞혔다면, 경계 조건까지 설명해 보세요."
                    : "오답 점수는 없습니다. 예상이 어긋난 지점을 찾는 것이 이번 훈련입니다."}
                </p>
              )}
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => void c.execute("observing")}
              >
                {activity === "observing" ? "원본 실행 중" : "원본 다시 실행"}
              </button>
              <div className="lab-coach">
                <span className="eyebrow">생각해 볼 질문</span>
                <p>{lab.reflection}</p>
                {t.coach && t.coach.evidenceId !== "experiment" && (
                  <LearningCoachQuestion controller={c} />
                )}
                <button
                  className="secondary-button"
                  disabled={
                    busy || !aiReady || blocked || observation.status !== "ok" || c.observationStale
                  }
                  onClick={() => void c.coach()}
                >
                  {activity === "coaching" ? (
                    <LoaderCircle className="spin" size={16} />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  {activity === "coaching"
                    ? "AI 질문 준비 중"
                    : t.coach
                      ? "현재 코드로 AI 질문 다시 받기"
                      : "내 예상에 맞는 AI 질문 받기"}
                </button>
                <small>
                  선택 사항 · 풀이 검토와 합쳐 24시간 20회 · AI 질문 사용은 도움 기록에 포함됩니다.
                  {!aiReady && " AI 연결 전에도 실행과 수정은 가능합니다."}
                  {blocked && " 저장 충돌을 먼저 해결해 주세요."}
                </small>
              </div>
              <LearningExperiment controller={c} blocked={blocked} aiReady={aiReady} />
              <button className="primary-button" onClick={() => move(2)}>
                내 코드 수정하고 테스트하기 <ArrowRight size={16} />
              </button>
            </>
          )}
        </div>
      )}
      {stage === 3 && (
        <div className="lab-learning-summary" aria-label="이번 훈련의 근거">
          <div>
            <span>첫 예측</span>
            <strong>{t.prediction.locked ? "기록함" : "아직 남기지 않음"}</strong>
            <button className="text-button" onClick={() => move(0)}>
              예측 보기 →
            </button>
          </div>
          <div>
            <span>원본 관찰</span>
            <strong>{observation?.status === "ok" ? "실행함" : "확인 필요"}</strong>
            <button className="text-button" onClick={() => move(1)}>
              결과 비교 →
            </button>
          </div>
          <div>
            <span>수정 코드 테스트</span>
            <strong>
              {!t.run
                ? "미실행"
                : t.run.codeHash !== c.currentHash || t.run.suiteVersion !== lab?.version
                  ? "다시 실행 필요"
                  : `${t.run.results.filter((r) => r.status === "ok" && sameOutput(r.actual, lab?.checkpoints.find((test) => test.id === r.id)?.expected)).length}/${t.run.results.length}개 통과`}
            </strong>
            <button className="text-button" onClick={() => move(2)}>
              테스트 보기 →
            </button>
          </div>
        </div>
      )}
      {c.error && (
        <p className="inline-error lab-error" role="alert">
          {c.error}
        </p>
      )}
      {busy && activity !== "coaching" && (
        <ExecutionWait key={activity} paired={activity === "experimenting"} />
      )}
      {busy && (
        <button className="text-button lab-cancel" onClick={c.cancel}>
          대기 취소
        </button>
      )}
    </section>
  );
}

export function LabTests({ controller: c }: { controller: LearningLabController }) {
  const { lab, training: t } = c;
  const stale = Boolean(
    t.run && (t.run.codeHash !== c.currentHash || t.run.suiteVersion !== lab?.version),
  );
  const passed =
    t.run?.results.filter(
      (r) =>
        r.status === "ok" &&
        sameOutput(r.actual, lab?.checkpoints.find((test) => test.id === r.id)?.expected),
    ).length ?? 0;
  return (
    <section className="lab-tests" aria-label="내 코드 실행 테스트">
      <div className="lab-tests-heading">
        <div>
          <h3>수정한 코드, 직접 확인하기</h3>
          <p>브라우저에서 제공된 테스트를 실행합니다. 실행 중에도 코드를 편집할 수 있습니다.</p>
        </div>
        <button
          className="secondary-button"
          disabled={!lab || c.activity !== "idle"}
          onClick={() => void c.execute("testing")}
        >
          {c.activity === "testing" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <Play size={16} />
          )}
          {c.activity === "testing" ? "테스트 실행 중" : "내 코드 테스트"}
        </button>
      </div>
      {t.run && (
        <>
          <p role="status" className={stale ? "inline-warning" : "lab-test-summary"}>
            {stale
              ? "코드 또는 테스트가 바뀌었습니다. 아래는 이전 실행 결과입니다. 다시 실행해 주세요."
              : `제공된 테스트 ${passed}/${t.run.results.length}개 통과`}
          </p>
          <div className="lab-test-list">
            {t.run.results.map((result) => {
              const test = lab?.checkpoints.find((c) => c.id === result.id);
              const ok = result.status === "ok" && sameOutput(result.actual, test?.expected);
              return (
                <details key={result.id}>
                  <summary>
                    <span className={ok ? "lab-pass" : "lab-fail"}>
                      {ok ? "통과" : result.status === "error" ? "오류" : "불일치"}
                    </span>
                    {test?.note ?? result.id}
                  </summary>
                  <div className="lab-test-detail">
                    <p>입력과 관찰</p>
                    <pre>{test?.expression}</pre>
                    <p>기대 결과</p>
                    <pre>{JSON.stringify(test?.expected, null, 2)}</pre>
                    <p>실제 결과</p>
                    <pre>{result.actual}</pre>
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
      <small>
        JavaScript 함수 전용 · DOM, 네트워크, 타이머, import 미지원 · 테스트별 0.6초 / 16MB 제한.
        테스트 통과는 모든 입력의 정답이나 이해도 인증을 뜻하지 않습니다.
      </small>
      <small>
        결과는 문자열, 유한한 숫자, 불리언, null, 일반 객체와 빈 자리가 없는 배열로 비교합니다. NaN,
        undefined와 getter 등은 다른 값으로 바꾸지 않고 오류로 안내합니다. 기본 내장 함수와
        프로토타입은 변경할 수 없습니다.
      </small>
      <button
        className="text-button"
        onClick={() => {
          c.setStage(3);
          requestAnimationFrame(() => document.getElementById("lab-stage-title")?.focus());
        }}
      >
        실행 결과를 바탕으로 설명 정리하기 →
      </button>
    </section>
  );
}

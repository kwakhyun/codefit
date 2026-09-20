"use client";
import { ScreenSkeleton } from "@/components/ui/skeleton";
import { useFadeTransition } from "@/components/ui/use-fade-transition";
import {
  Button,
  Status,
  Disclosure,
  DisclosureSummary,
  FieldLabel,
  Input,
  Textarea,
} from "@/components/ui/primitives";
import { ExecutionWait } from "./execution-wait";
import { VoiceInput } from "@/components/ui/voice-input";
import { ArrowRight, Check, LoaderCircle, Play, Sparkles } from "lucide-react";
import { sameOutput } from "@/lib/handoff/training";
import type { LearningLabController } from "@/hooks/use-learning-lab";
import { LearningCoachQuestion } from "./learning-coach-question";
import { LearningExperiment } from "./learning-experiment";

const situations: Record<string, string> = {
  cart: "수량을 바꿀 때 이전 장바구니까지 함께 변하면, 변경 전후 비교나 취소 기능이 깨질 수 있습니다. 원본과 새 상태가 어떻게 달라지는지 직접 실행해 확인합니다.",
  latest:
    "빠르게 다시 검색하거나 화면을 닫을 때 이전 응답이 뒤늦게 도착할 수 있습니다. 응답 순서를 바꿔도 최신 화면을 지키는 코드를 만듭니다.",
  page: "목록에 데이터가 없거나 잘못된 페이지 번호가 들어와도 화면이 열려야 합니다. 빈 목록과 마지막 페이지의 동작을 확인합니다.",
  config:
    "서버 설정은 문자열로 들어오지만 코드는 숫자와 참/거짓으로 사용합니다. 같은 글자라도 자료형에 따라 해석이 달라지는 부분을 확인합니다.",
  dedupe:
    "같은 작업이 동시에 들어오거나 실패 후 다시 요청될 수 있습니다. 중복 실행은 줄이면서 필요한 재시도는 허용하는지 확인합니다.",
  total:
    "이미 쓰는 주문 집계에 새 기능을 추가합니다. 기존 결과를 먼저 확인하고, 정상 동작을 유지하면서 계산을 확장하는 연습입니다.",
};
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
  const fade = useFadeTransition<HTMLElement>(stage);
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
    <section ref={fade} className="learning-lab" aria-label="코드 이해 훈련">
      <div className="lab-intro">
        <span className="eyebrow">예상하고, 실행하고, 비교하기</span>
        <span>교육용 JavaScript · 틀린 예상도 좋은 출발점입니다.</span>
      </div>
      <nav className="lab-steps" aria-label="코드 이해 훈련 단계">
        {steps.map((step, index) => (
          <Button
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
          </Button>
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
      {stage === 0 && (
        <div className="lab-purpose">
          <strong>내 서비스에서는 언제 필요할까요?</strong>
          <p>{situations[problemId.replace(/^handoff-/, "").replace(/-transfer$/, "")]}</p>
          <small>
            문법 퀴즈가 아닙니다. 현재 동작을 확인하고, 요구사항에 맞게 바꾼 뒤 그 근거를 남깁니다.
            정상인 부분은 유지해도 됩니다.
          </small>
        </div>
      )}
      {stage === 2 && lab && (
        <section className="lab-target" aria-label="수정할 목표">
          <h3>이 동작을 만족하도록 수정하세요</h3>
          <ul>
            {lab.contract.split("\n").map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p>
            아래 편집기에서 코드를 수정한 다음 ‘내 코드 테스트’를 누르세요. 실패한 항목을 열면
            입력과 기대 결과를 볼 수 있습니다.
          </p>
        </section>
      )}
      {c.loadError ? (
        <Status className="inline-error" role="alert">
          {c.loadError}{" "}
          <Button className="text-button" onClick={c.reload}>
            훈련 다시 불러오기
          </Button>
        </Status>
      ) : !lab ? (
        <ScreenSkeleton variant="editor" label="실행 시나리오를 불러오는 중…" />
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
            <div className="lab-input-context">
              <strong>이번에 실행할 입력</strong>
              <p>{lab.probe.note}</p>
            </div>
            <Disclosure open>
              <DisclosureSummary>실행할 입력과 관찰 코드</DisclosureSummary>
              <pre tabIndex={0}>
                <code>{lab.probe.expression}</code>
              </pre>
            </Disclosure>
          </div>
          <div className="lab-prediction">
            <fieldset disabled={t.prediction.locked}>
              <legend>{lab.question}</legend>
              <p className="learn-fineprint">
                고친 뒤의 정답이 아니라, 왼쪽 원본 코드가 지금 반환할 값을 예상하세요.
              </p>
              {lab.choices.map((option, index) => (
                <FieldLabel
                  className={`lab-choice ${t.prediction.choice === option.id ? "selected" : ""}`}
                  key={option.id}
                >
                  <Input
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
                </FieldLabel>
              ))}
            </fieldset>
            <FieldLabel htmlFor="prediction-reason">
              왜 그렇게 생각했나요? <span className="optional-label">선택</span>
            </FieldLabel>
            <Textarea
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
            <Button
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
            </Button>
          </div>
        </div>
      )}
      {stage === 1 && lab && (
        <div className="lab-observation">
          {!observation ? (
            <div className="lab-empty">
              <p>첫 예상과 실제 결과를 나란히 확인할 수 있습니다.</p>
              <Button className="secondary-button" onClick={() => move(0)}>
                먼저 예측하기
              </Button>
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
                  {observation.status === "ok" && (
                    <p>
                      {
                        lab.choices.find((option) =>
                          sameOutput(observation.actual, JSON.parse(option.output)),
                        )?.label
                      }
                    </p>
                  )}
                  <pre aria-label="원본 실행 반환값">{observation.actual}</pre>
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
                <Status className="inline-warning" role="status">
                  원본 코드나 실행 조건이 바뀌었거나 확인되지 않는 이전 기록입니다. 첫 예상은
                  유지하며, 원본을 다시 실행한 뒤 AI 질문을 받을 수 있습니다.
                </Status>
              ) : (
                <p className="lab-evidence-note">
                  내 브라우저에서 원본 코드를 실행한 결과입니다. AI 판정이 아닙니다.{" "}
                  {correct
                    ? "한 사례를 맞혔다면, 경계 조건까지 설명해 보세요."
                    : "오답 점수는 없습니다. 예상이 어긋난 지점을 찾는 것이 이번 훈련입니다."}
                </p>
              )}
              <div className="lab-next-action">
                <p>{lab.reflection}</p>
                <Button className="primary-button" onClick={() => move(2)}>
                  내 코드 수정하고 테스트하기 <ArrowRight size={16} />
                </Button>
                <small>
                  다음 단계에 수정 목표와 편집기가 있습니다. 아래 AI 질문과 추가 실험은 선택
                  사항입니다.
                </small>
              </div>
              <Button
                className="secondary-button"
                disabled={busy}
                onClick={() => void c.execute("observing")}
              >
                {activity === "observing" ? "원본 실행 중" : "원본 다시 실행"}
              </Button>
              <Disclosure className="lab-optional-tools" open={Boolean(t.coach || t.experiment)}>
                <DisclosureSummary>더 살펴보기: AI 질문과 직접 실험 (선택)</DisclosureSummary>
                <div className="lab-coach">
                  <span className="eyebrow">생각해 볼 질문</span>
                  {t.coach && t.coach.evidenceId !== "experiment" && (
                    <LearningCoachQuestion controller={c} />
                  )}
                  <Button
                    className="secondary-button"
                    disabled={
                      busy ||
                      !aiReady ||
                      blocked ||
                      observation.status !== "ok" ||
                      c.observationStale
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
                  </Button>
                  <small>
                    선택 사항 · 로그인 없이 2회, 로그인하면 24시간 30회 · AI 질문 사용은 도움 기록에
                    포함됩니다.
                    {!aiReady && " AI 연결 전에도 실행과 수정은 가능합니다."}
                    {blocked && " 저장 충돌을 먼저 해결해 주세요."}
                  </small>
                </div>
                <LearningExperiment controller={c} blocked={blocked} aiReady={aiReady} />
              </Disclosure>
            </>
          )}
        </div>
      )}
      {stage === 3 && (
        <div className="lab-learning-summary" aria-label="이번 훈련의 근거">
          <div>
            <span>첫 예측</span>
            <strong>{t.prediction.locked ? "기록함" : "아직 남기지 않음"}</strong>
            <Button className="text-button" onClick={() => move(0)}>
              예측 보기 →
            </Button>
          </div>
          <div>
            <span>원본 관찰</span>
            <strong>{observation?.status === "ok" ? "실행함" : "확인 필요"}</strong>
            <Button className="text-button" onClick={() => move(1)}>
              결과 비교 →
            </Button>
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
            <Button className="text-button" onClick={() => move(2)}>
              테스트 보기 →
            </Button>
          </div>
        </div>
      )}
      {c.error && (
        <Status className="inline-error lab-error" role="alert">
          {c.error}
        </Status>
      )}
      {busy && activity !== "coaching" && (
        <ExecutionWait key={activity} paired={activity === "experimenting"} />
      )}
      {busy && (
        <Button className="text-button lab-cancel" onClick={c.cancel}>
          대기 취소
        </Button>
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
        <Button
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
        </Button>
      </div>
      {t.run && (
        <>
          <Status role="status" className={stale ? "inline-warning" : "lab-test-summary"}>
            {stale
              ? "코드 또는 테스트가 바뀌었습니다. 아래는 이전 실행 결과입니다. 다시 실행해 주세요."
              : `제공된 테스트 ${passed}/${t.run.results.length}개 통과`}
          </Status>
          <div className="lab-test-list">
            {t.run.results.map((result) => {
              const test = lab?.checkpoints.find((c) => c.id === result.id);
              const ok = result.status === "ok" && sameOutput(result.actual, test?.expected);
              return (
                <Disclosure key={result.id}>
                  <DisclosureSummary>
                    <span className={ok ? "lab-pass" : "lab-fail"}>
                      {ok ? "통과" : result.status === "error" ? "오류" : "불일치"}
                    </span>
                    {test?.note ?? result.id}
                  </DisclosureSummary>
                  <div className="lab-test-detail">
                    <p>입력과 관찰</p>
                    <pre>{test?.expression}</pre>
                    <p>기대 결과</p>
                    <pre>{JSON.stringify(test?.expected, null, 2)}</pre>
                    <p>실제 결과</p>
                    <pre>{result.actual}</pre>
                  </div>
                </Disclosure>
              );
            })}
          </div>
        </>
      )}
      <Disclosure className="lab-runtime-details">
        <DisclosureSummary>실행 환경과 테스트 범위</DisclosureSummary>
        <small>
          JavaScript 함수 전용 · DOM, 네트워크, 타이머, import 미지원 · 테스트별 0.6초 / 16MB 제한.
          테스트 통과는 모든 입력의 정답이나 이해도 인증을 뜻하지 않습니다.
        </small>
        <small>
          결과는 문자열, 유한한 숫자, 불리언, null, 일반 객체와 빈 자리가 없는 배열로 비교합니다.
          NaN, undefined와 getter 등은 다른 값으로 바꾸지 않고 오류로 안내합니다. 기본 내장 함수와
          프로토타입은 변경할 수 없습니다.
        </small>
      </Disclosure>
      <p className="lab-test-next" role="status">
        {!t.run
          ? "코드를 수정한 뒤 테스트를 한 번 실행하면 결과를 바탕으로 설명을 정리할 수 있습니다."
          : stale
            ? "현재 코드로 다시 테스트해 주세요."
            : passed === t.run.results.length
              ? "제공된 사례를 모두 통과했습니다. 이제 수정 이유와 아직 확인하지 못한 점을 정리하세요."
              : "실패한 항목을 열어 기대 결과와 비교하세요. 해결하지 못한 부분도 마지막 설명에 남길 수 있습니다."}
      </p>
      <Button
        className="primary-button"
        disabled={!t.run || stale || c.activity !== "idle"}
        onClick={() => {
          c.setStage(3);
          requestAnimationFrame(() => document.getElementById("lab-stage-title")?.focus());
        }}
      >
        실행 결과를 바탕으로 설명 정리하기 →
      </Button>
    </section>
  );
}

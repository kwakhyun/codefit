"use client";
import {
  Disclosure,
  DisclosureSummary,
  Button,
  FieldLabel,
  Textarea,
} from "@/components/ui/primitives";
import { useRef } from "react";
import { FlaskConical, LoaderCircle } from "lucide-react";
import type { LearningLabController } from "@/hooks/use-learning-lab";
import { experimentMatches } from "@/lib/handoff/training";
import { LearningCoachQuestion } from "./learning-coach-question";

export function LearningExperiment({
  controller: c,
  blocked,
  aiReady,
}: {
  controller: LearningLabController;
  blocked: boolean;
  aiReady: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const expressionInput = useRef<HTMLTextAreaElement>(null);
  const { experiment, training, activity, lab } = c;
  const run = experiment.run;
  const proposal = training.coach?.experiment;
  const busy = activity !== "idle";
  const stale =
    !lab || !experimentMatches(experiment, c.currentSourceHash, c.currentHash, lab.version);
  const reflection = experiment.reflection;
  const reflectionStale = Boolean(reflection && reflection.runHash !== c.currentExperimentHash);
  return (
    <section className="lab-experiment" aria-labelledby="experiment-title">
      <h3 id="experiment-title">
        <FlaskConical size={18} /> 직접 실험해 보기
      </h3>
      <p>
        같은 실험을 원본과 수정 중인 코드에 각각 실행합니다. 결과가 같거나 다르다는 사실은 정답
        판정이 아닙니다.
      </p>
      {proposal && (
        <div className="lab-experiment-proposal">
          <p>AI가 제안한 실험입니다. 입력과 관찰할 값을 확인한 뒤 가져오세요.</p>
          <Disclosure>
            <DisclosureSummary>AI 제안 코드 보기</DisclosureSummary>
            <pre>{proposal.expression}</pre>
          </Disclosure>
          <Button
            className="secondary-button"
            disabled={busy || blocked}
            onClick={() => {
              if (c.editExperiment({ expression: proposal.expression, prediction: "" })) {
                if (details.current) details.current.open = true;
                expressionInput.current?.focus();
              }
            }}
          >
            AI 실험 코드 가져오기
          </Button>
        </div>
      )}
      <Disclosure ref={details} className="lab-experiment-editor">
        <DisclosureSummary>실험 코드와 예상 작성</DisclosureSummary>
        <FieldLabel htmlFor="experiment-expression">실험 코드</FieldLabel>
        <p id="experiment-help">
          함수를 호출하고 관찰할 값을 반환하는 JavaScript 표현식입니다. 원본 실행식을 바꿔 시작할 수
          있습니다. 비동기 실험은 async 함수로 감싸고 호출하세요. DOM, 네트워크와 타이머는 사용할 수
          없습니다.
        </p>
        <Textarea
          id="experiment-expression"
          ref={expressionInput}
          value={experiment.expression}
          maxLength={2000}
          rows={9}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-describedby="experiment-help"
          onChange={(e) => c.editExperiment({ expression: e.target.value })}
        />
        <small>{experiment.expression.length}/2,000자</small>
        <FieldLabel htmlFor="experiment-prediction">
          실험 결과 예상 <span className="optional-label">선택</span>
        </FieldLabel>
        <Textarea
          id="experiment-prediction"
          value={experiment.prediction}
          maxLength={800}
          rows={3}
          placeholder="두 코드의 결과가 어떻게 다를지 적어 보세요."
          onChange={(e) => c.editExperiment({ prediction: e.target.value })}
        />
        <Button
          className="secondary-button"
          disabled={busy || blocked || !experiment.expression.trim()}
          onClick={() => void c.runExperiment()}
        >
          {activity === "experimenting" ? (
            <LoaderCircle size={16} className="spin" />
          ) : (
            <FlaskConical size={16} />
          )}
          {activity === "experimenting" ? "두 코드 실험 중" : "두 코드로 실험 실행"}
        </Button>
        <small>
          내 브라우저에서 실행하며 추가 AI 호출은 없습니다. 새 실행은 마지막 실험 결과를 갱신합니다.
        </small>
      </Disclosure>
      {run && (
        <div className="lab-experiment-results" aria-label="추가 실험 결과" aria-live="polite">
          <strong>{stale ? "이전에 실행한 실험 결과" : "실험 실행 결과"}</strong>
          {stale && (
            <p className="inline-warning">
              코드, 예상 또는 실행 조건이 바뀌었습니다. 현재 내용으로 다시 실행해 주세요.
            </p>
          )}
          <p>실행 당시 예상: {run.prediction || "남기지 않음"}</p>
          <Disclosure>
            <DisclosureSummary>실행한 실험 코드 보기</DisclosureSummary>
            <pre>{run.expression}</pre>
          </Disclosure>
          <div className="lab-comparison">
            <div>
              <span>원본 코드 · {run.original.status === "ok" ? "실행 완료" : "실행 오류"}</span>
              <pre>{run.original.actual}</pre>
            </div>
            <div>
              <span>
                수정 중인 코드 · {run.current.status === "ok" ? "실행 완료" : "실행 오류"}
              </span>
              <pre>{run.current.actual}</pre>
            </div>
          </div>
          <p className="muted">
            오류가 나면 실험 코드와 대상 함수를 함께 확인하세요. 전체 동작이나 이해도를 보장하는
            결과는 아닙니다.
          </p>
        </div>
      )}
      {run && (
        <div className="lab-experiment-reflection">
          <FieldLabel htmlFor="experiment-reflection">실험 후 알게 된 점</FieldLabel>
          <p id="experiment-reflection-help">
            예상과 실제 결과를 비교해 설명해 보세요. 아직 확인하지 못한 부분도 적을 수 있습니다.
          </p>
          {reflectionStale && (
            <p className="inline-warning">
              아래 설명은 이전 실험에 대한 내용입니다. 현재 결과를 보고 수정하거나 같은 설명을
              사용할지 확인해 주세요.
            </p>
          )}
          <Textarea
            id="experiment-reflection"
            rows={4}
            maxLength={800}
            value={reflection?.text ?? ""}
            disabled={blocked || stale || !c.currentExperimentHash || activity === "experimenting"}
            aria-describedby="experiment-reflection-help"
            onChange={(e) => c.reflectOnExperiment(e.target.value)}
          />
          {reflectionStale && (
            <Button
              className="secondary-button"
              disabled={busy || blocked || stale || !c.currentExperimentHash}
              onClick={() => c.reflectOnExperiment(reflection?.text ?? "")}
            >
              현재 결과에도 이 설명 사용하기
            </Button>
          )}
          <Button
            className="secondary-button"
            disabled={
              busy ||
              blocked ||
              !aiReady ||
              stale ||
              reflectionStale ||
              !reflection?.text.trim() ||
              c.observationStale
            }
            onClick={() => void c.coach("experiment")}
          >
            {activity === "coaching" && <LoaderCircle size={16} className="spin" />}
            실험 결과로 다음 AI 질문 받기
          </Button>
          <small>
            설명만 저장할 때는 AI를 호출하지 않습니다. 질문을 요청하면 AI 이용 횟수가 차감됩니다.
          </small>
        </div>
      )}
      {training.coach?.evidenceId === "experiment" && <LearningCoachQuestion controller={c} />}
    </section>
  );
}

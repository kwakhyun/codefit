"use client";
import { Button, Disclosure, DisclosureSummary, Status } from "@/components/ui/primitives";
import type { ExampleTestsController } from "@/hooks/use-example-tests";
import type { ExampleTest } from "@/lib/example-tests";
import type { ProblemCheck } from "@/lib/problem";
import { Check, CircleCheck, LoaderCircle, Play } from "lucide-react";

/** Browser-run example checks. Their results are labelled separately from the AI review. */
export function ExampleTestsPanel({
  tests,
  controller: c,
}: {
  tests: ExampleTest[];
  controller: ExampleTestsController;
}) {
  return (
    <section className="example-tests" aria-labelledby="example-tests-title">
      <div className="example-tests-heading">
        <div>
          <h3 id="example-tests-title">예시 테스트</h3>
          <p>
            내 코드로 예시 {tests.length}개를 이 브라우저의 분리된 실행 환경에서 실행합니다. AI 검토
            횟수를 쓰지 않습니다.
          </p>
        </div>
        <Button className="secondary-button" disabled={c.running} onClick={() => void c.run()}>
          {c.running ? <LoaderCircle size={16} className="spin" /> : <Play size={16} />}
          {c.running ? "실행 중" : "예시 테스트 실행"}
        </Button>
      </div>
      {c.error && (
        <Status className="inline-error" role="alert">
          {c.error}
        </Status>
      )}
      <Status
        role="status"
        className={c.stale ? "inline-warning" : c.summary ? "example-tests-summary" : "sr-only"}
      >
        {c.running
          ? ""
          : !c.summary
            ? ""
            : c.stale
              ? "코드가 바뀌었습니다. 아래는 이전 코드의 결과입니다. 다시 실행해 주세요."
              : `예시 테스트 ${c.summary.passed}/${c.summary.total}개 통과${
                  c.summary.passed === c.summary.total
                    ? " · ‘예시 테스트 통과’로 기록했습니다."
                    : ""
                }`}
      </Status>
      {c.results && (
        <ol className="example-test-list">
          {c.results.map((result) => {
            const test = tests.find((t) => t.id === result.id);
            return (
              <li key={result.id}>
                <Disclosure>
                  <DisclosureSummary>
                    <span className={result.passed ? "lab-pass" : "lab-fail"}>
                      {result.passed ? "통과" : result.status === "error" ? "오류" : "실패"}
                    </span>
                    {test?.label ?? result.id}
                  </DisclosureSummary>
                  <div className="lab-test-detail">
                    <p>실행한 식</p>
                    <pre>{test?.expression}</pre>
                    <p>기대 결과</p>
                    <pre>{JSON.stringify(test?.expected, null, 2)}</pre>
                    <p>{result.status === "error" ? "오류 내용" : "실제 결과"}</p>
                    <pre>{result.actual}</pre>
                  </div>
                </Disclosure>
              </li>
            );
          })}
        </ol>
      )}
      <Disclosure className="lab-runtime-details">
        <DisclosureSummary>실행 환경과 결과의 의미</DisclosureSummary>
        <small>
          JavaScript 함수 전용 · TypeScript는 편집기의 변환기로 타입만 지운 뒤 실행 · DOM, 네트워크,
          타이머, import 미지원 · 테스트별 0.6초 / 16MB 제한.
        </small>
        <small>
          예시를 모두 통과하면 이 문제를 ‘예시 테스트 통과’로 기록합니다. 브라우저가 보낸 결과이며,
          ‘해결’은 AI 검토 기준을 모두 충족했을 때만 표시합니다. 예시 통과가 모든 입력의 정답을
          뜻하지는 않습니다.
        </small>
      </Disclosure>
    </section>
  );
}

/** Problems without example tests: an honest note and an optional self-check status. */
export function SelfCheckPanel({
  check,
  pending,
  onToggle,
}: {
  check: ProblemCheck | null | undefined;
  pending: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const checked = check?.kind === "self";
  return (
    <section className="example-tests self-check" aria-labelledby="self-check-title">
      <div className="example-tests-heading">
        <div>
          <h3 id="self-check-title">직접 확인</h3>
          <p>
            이 문제는 예시 테스트 없이 AI 검토로 확인합니다. 내 환경에서 실행했거나 요구사항을
            하나씩 점검했다면 기록해 두세요.
          </p>
        </div>
        <Button
          className={`secondary-button ${checked ? "active" : ""}`}
          disabled={pending}
          onClick={() => onToggle(!checked)}
        >
          {checked ? <CircleCheck size={16} /> : <Check size={16} />}
          {checked ? "직접 확인 표시 해제" : "직접 확인함으로 표시"}
        </Button>
      </div>
      <small>
        {checked ? "현재 ‘직접 확인함’으로 기록되어 있습니다. " : ""}‘직접 확인함’은 내 기록용
        표시이며 ‘해결’로 계산하지 않습니다.
      </small>
    </section>
  );
}

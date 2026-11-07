import { exampleTests } from "../data/example-tests";
import { sameOutput, type ExecutionResult } from "./handoff/training";
import type { Language } from "./catalog";

export type ExampleTest = { id: string; expression: string; expected: unknown; label: string };
export type ExampleTestResult = ExecutionResult & { passed: boolean };
/** A learner-reported browser run. It is shown as such and never marks a problem solved. */
export type ExampleTestSummary = { passed: number; total: number };

/** Example checks for a built-in function problem, or null when it is reviewed by AI only. */
export function exampleTestsFor(problem: { id: string; language: Language; handoff?: unknown }) {
  if (problem.handoff || !["javascript", "typescript"].includes(problem.language)) return null;
  return Object.hasOwn(exampleTests, problem.id) ? exampleTests[problem.id] : null;
}

/** A browser run kept with a review only when it covers exactly this problem's examples.
 * Anything else is dropped, so the review itself still stands. */
export function acceptedExampleTests(
  problem: { id: string; language: Language; handoff?: unknown },
  value: unknown,
): ExampleTestSummary | undefined {
  if (!value || typeof value !== "object") return undefined;
  const { passed, total } = value as Record<string, unknown>;
  if (!Number.isInteger(passed) || !Number.isInteger(total)) return undefined;
  const summary = { passed: passed as number, total: total as number };
  return summary.passed >= 0 &&
    summary.passed <= summary.total &&
    exampleTestsFor(problem)?.length === summary.total
    ? summary
    : undefined;
}

/** Why "예시 테스트 통과" or "직접 확인함" cannot be recorded for this problem, or null.
 * The check API and backup restore share these rules. */
export function problemCheckError(
  problem: { id: string; language: Language; handoff?: unknown },
  check: { kind: "tests" | "self"; passed: number; total: number },
): string | null {
  const tests = exampleTestsFor(problem);
  if (check.kind === "tests") {
    if (!tests) return "이 문제에는 예시 테스트가 없습니다.";
    return check.total !== tests.length || check.passed !== check.total
      ? "모든 예시 테스트를 통과한 결과만 기록합니다."
      : null;
  }
  if (problem.handoff) return "코드 이해 훈련은 직접 확인 표시를 지원하지 않습니다.";
  return tests ? "예시 테스트가 있는 문제는 테스트를 실행해 확인해 주세요." : null;
}

/** The sandbox evaluates learner code as a classic script, where module syntax cannot parse.
 * Exported declarations keep working as globals; anything else is reported as written. */
export function toScript(code: string) {
  return code
    .replace(/^[ \t]*export[ \t]*\{[^}]*\}[ \t]*;?[ \t]*$/gm, "")
    .replace(/^([ \t]*)export[ \t]+default[ \t]+(?=(?:async[ \t]+)?function\b|class\b)/gm, "$1")
    .replace(
      /^([ \t]*)export[ \t]+(?=(?:async[ \t]+)?function\b|class\b|const\b|let\b|var\b)/gm,
      "$1",
    );
}

/** Import statements need a module loader, which the sandbox deliberately does not have. */
export function hasImport(code: string) {
  return /^[ \t]*import[ \t]+(?:[\w*{]|["'])/m.test(code);
}

export function gradeResults(
  tests: ExampleTest[],
  results: ExecutionResult[],
): ExampleTestResult[] {
  return tests.map((test) => {
    const result = results.find((r) => r.id === test.id) ?? {
      id: test.id,
      status: "error" as const,
      actual: "실행 결과가 없습니다.",
    };
    return {
      ...result,
      passed: result.status === "ok" && sameOutput(result.actual, test.expected),
    };
  });
}

export function summarizeResults(results: ExampleTestResult[]): ExampleTestSummary {
  return { passed: results.filter((r) => r.passed).length, total: results.length };
}

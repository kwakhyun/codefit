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

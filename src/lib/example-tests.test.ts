import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from "quickjs-emscripten-core";
import ts from "typescript";
import { beforeAll, describe, expect, it } from "vitest";
import { exampleTests } from "../data/example-tests";
import { seedProblems } from "../data/problems";
import { executeCase } from "./handoff/execute";
import {
  acceptedExampleTests,
  exampleTestsFor,
  gradeResults,
  hasImport,
  problemCheckError,
  summarizeResults,
  toScript,
} from "./example-tests";

// Browser runs transpile TypeScript with the editor's worker; developer tests use the compiler.
function runnable(code: string, language: string) {
  const js =
    language === "typescript"
      ? ts.transpileModule(code, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            moduleDetection: ts.ModuleDetectionKind.Force,
          },
        }).outputText
      : code;
  return toScript(js);
}

let engine: QuickJSWASMModule;
beforeAll(async () => {
  engine = await newQuickJSWASMModuleFromVariant(variant);
});

// Function problems that cannot run in the sandbox: React UI and the browser URL API.
const AI_REVIEW_ONLY = ["fe-search-race", "security-redirect"];

describe("built-in example tests", () => {
  const withTests = seedProblems.filter((p) => exampleTestsFor(p));
  it("cover every built-in JavaScript/TypeScript function problem", () => {
    const candidates = seedProblems.filter(
      (p) => !p.handoff && ["javascript", "typescript", "tsx"].includes(p.language),
    );
    for (const problem of candidates)
      expect(
        Boolean(exampleTestsFor(problem)) || AI_REVIEW_ONLY.includes(problem.id),
        problem.id,
      ).toBe(true);
    expect(Object.keys(exampleTests).sort()).toEqual(withTests.map((p) => p.id).sort());
    expect(withTests.length).toBeGreaterThanOrEqual(8);
  });
  for (const problem of seedProblems.filter((p) => exampleTestsFor(p))) {
    const tests = exampleTestsFor(problem)!;
    it(`${problem.id}: the reference passes every check and the starter misses one`, () => {
      expect(tests.length).toBeGreaterThanOrEqual(3);
      expect(tests.length).toBeLessThanOrEqual(8);
      expect(new Set(tests.map((t) => t.id)).size).toBe(tests.length);
      const run = (code: string) =>
        gradeResults(
          tests,
          tests.map((t) => executeCase(engine, runnable(code, problem.language), t)),
        );
      const reference = run(problem.solution);
      expect(
        reference.filter((r) => !r.passed),
        problem.id,
      ).toEqual([]);
      expect(summarizeResults(run(problem.starterCode)).passed).toBeLessThan(tests.length);
    });
  }
  it("returns no tests for understanding tasks or other languages", () => {
    const handoff = seedProblems.find((p) => p.handoff)!;
    expect(exampleTestsFor(handoff)).toBeNull();
    expect(exampleTestsFor({ id: "fe-cart", language: "python" })).toBeNull();
    expect(exampleTestsFor({ id: "toString", language: "javascript" })).toBeNull();
  });
});

describe("script preparation", () => {
  it("keeps exported declarations usable as globals", () => {
    expect(
      toScript(
        "export function a() {}\nexport default class B {}\n  export const c = 1;\nexport { a };\nexport {};",
      ),
    ).toBe("function a() {}\nclass B {}\n  const c = 1;\n\n");
  });
  it("detects import statements but not words inside code", () => {
    expect(hasImport('import { x } from "y";')).toBe(true);
    expect(hasImport('import "./side-effect";')).toBe(true);
    expect(hasImport("const important = 1;\n// import later")).toBe(false);
  });
  it("grades a missing result as a failure", () => {
    const [result] = gradeResults([{ id: "a", expression: "1", expected: 1, label: "" }], []);
    expect(result).toMatchObject({ id: "a", status: "error", passed: false });
  });
});

describe("recorded results", () => {
  const cart = seedProblems.find((p) => p.id === "fe-cart")!;
  const total = exampleTestsFor(cart)!.length;
  const python = seedProblems.find((p) => !p.handoff && !exampleTestsFor(p))!;
  const handoff = seedProblems.find((p) => p.handoff)!;
  it("keeps a review's test run only when it covers exactly the problem's examples", () => {
    expect(acceptedExampleTests(cart, { passed: 2, total, extra: true })).toEqual({
      passed: 2,
      total,
    });
    for (const value of [
      null,
      "5/5",
      { passed: "2", total },
      { passed: 1.5, total },
      { passed: -1, total },
      { passed: total + 1, total },
      { passed: 1, total: total + 1 },
    ])
      expect(acceptedExampleTests(cart, value)).toBeUndefined();
    expect(acceptedExampleTests(python, { passed: 1, total: 1 })).toBeUndefined();
  });
  it("allows a full test pass where examples exist and a self-check elsewhere", () => {
    const pass = { kind: "tests" as const, passed: total, total };
    const self = { kind: "self" as const, passed: 0, total: 0 };
    expect(problemCheckError(cart, pass)).toBeNull();
    expect(problemCheckError(cart, { ...pass, passed: total - 1 })).toMatch("모든 예시");
    expect(problemCheckError(cart, { ...pass, passed: 4, total: 4 })).toMatch("모든 예시");
    expect(problemCheckError(cart, self)).toMatch("테스트를 실행");
    expect(problemCheckError(python, self)).toBeNull();
    expect(problemCheckError(python, pass)).toMatch("예시 테스트가 없습니다");
    expect(problemCheckError(handoff, self)).toMatch("코드 이해 훈련");
  });
});

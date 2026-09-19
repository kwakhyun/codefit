import { describe, it, expect, beforeAll } from "vitest";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from "quickjs-emscripten-core";
import { handoffProblems } from "../../data/handoff-problems";
import { learningLab, originalObservationMatches } from "../server/learning-lab";
import { executeCase } from "./execute";
import {
  codeHash,
  emptyTraining,
  sameOutput,
  trainingSchema,
  observationSourceText,
  coachingEvidenceText,
} from "./training";
import { readHandoffDraft, writeHandoffDraft, formatHandoffDraft } from "./draft";
import { handoffDocument } from "./document";

let engine: QuickJSWASMModule;
beforeAll(async () => {
  engine = await newQuickJSWASMModuleFromVariant(variant);
});
describe("actual QuickJS execution of the complete curriculum", () => {
  for (const problem of handoffProblems) {
    it(`${problem.id}: an observable prediction and passing reference checkpoints`, () => {
      const lab = learningLab(problem);
      expect(lab).not.toHaveProperty("solution");
      expect(lab).not.toHaveProperty("originalOutputs");
      const observed = executeCase(engine, problem.starterCode, lab.probe);
      expect(observed.status).toBe("ok");
      expect(originalObservationMatches(problem, observed.actual)).toBe(true);
      for (const choice of lab.choices)
        expect(originalObservationMatches(problem, choice.output)).toBe(
          sameOutput(observed.actual, JSON.parse(choice.output)),
        );
      expect(
        lab.choices.filter((c) => sameOutput(observed.actual, JSON.parse(c.output))),
      ).toHaveLength(1);
      for (const c of lab.checkpoints) {
        const result = executeCase(engine, problem.solution, c);
        expect(result.status, result.actual).toBe("ok");
        expect(sameOutput(result.actual, c.expected), `${c.note}: ${result.actual}`).toBe(true);
      }
      expect(
        lab.checkpoints.some((c) => {
          const result = executeCase(engine, problem.starterCode, c);
          return result.status !== "ok" || !sameOutput(result.actual, c.expected);
        }),
      ).toBe(true);
    });
  }
  it("includes correctly behaving original code, not only bugs", () => {
    for (const id of ["handoff-total", "handoff-config-transfer"]) {
      const p = handoffProblems.find((p) => p.id === id)!;
      const lab = learningLab(p);
      expect(executeCase(engine, p.starterCode, lab.probe).actual).toBe(
        executeCase(engine, p.solution, lab.probe).actual,
      );
    }
  });
});
describe("bounded, isolated execution", () => {
  const check = (code: string, expression = "42") =>
    executeCase(engine, code, { id: "test", expression });
  it("does not expose host capabilities, modules or persisted globals", () => {
    expect(
      check(
        "",
        "[typeof fetch, typeof document, typeof process, typeof require, typeof localStorage, typeof setTimeout, typeof WebAssembly]",
      ).actual,
    ).toBe(JSON.stringify(Array(7).fill("undefined")));
    expect(check("globalThis.secret = 42", "secret").actual).toBe("42");
    expect(check("", "typeof secret").actual).toBe('"undefined"');
    expect(check("import fs from 'node:fs'").status).toBe("error");
    expect(check("", "import('node:fs')").status).toBe("error");
  });
  it("interrupts infinite loops, pending promises, memory exhaustion, and recursion", () => {
    for (const source of [
      "while (true) {}",
      "const a=[]; while(true) a.push('x'.repeat(10000));",
      "function f(){f()} f()",
    ])
      expect(check(source).status).toBe("error");
    expect(check("", "new Promise(() => {})").status).toBe("error");
    expect(check("", "(async()=>{while(true) await Promise.resolve()})()").status).toBe("error");
    expect(check("", "'x'.repeat(5000)").status).toBe("error");
    expect(check("", "({a:1})").actual).toBe('{"a":1}');
  });
  it("reports syntax and rejected promise errors without fabricating a pass", () => {
    expect(check("function {").status).toBe("error");
    expect(check("", "Promise.reject(new Error('expected failure'))")).toMatchObject({
      status: "error",
      actual: "expected failure",
    });
    expect(sameOutput('{"b":2,"a":1}', { a: 1, b: 2 })).toBe(true);
    expect(sameOutput("undefined", undefined)).toBe(false);
  });
});
it("keeps V1 backwards compatible and protects training with the same code revision payload", async () => {
  const notes = readHandoffDraft("").notes;
  const old = writeHandoffDraft("function code() {}", notes);
  expect(old).toContain("CODEFIT_HANDOFF_V1");
  expect(readHandoffDraft(old).training).toBeUndefined();
  const t = {
    ...emptyTraining(),
    prediction: {
      choice: "shared",
      reason: "객체를 함께 쓰는지 비교합니다.\n</textarea>\u2028",
      locked: true,
    },
    observation: { id: "prediction", status: "ok" as const, actual: "[3,3]" },
  };
  const packed = writeHandoffDraft("function code() {}", notes, t);
  expect(readHandoffDraft(packed).training).toEqual(t);
  expect(formatHandoffDraft(packed)).toContain("[3,3]");
  expect(handoffDocument("test", packed)).toContain("예측 이유:");
  const malformed = packed.replace('"version":1', '"version":999');
  expect(readHandoffDraft(malformed).implementation).toBe(malformed);
  expect(
    trainingSchema.safeParse({ ...t, prediction: { ...t.prediction, reason: "x".repeat(801) } })
      .success,
  ).toBe(false);
  expect(await codeHash("x")).not.toBe(await codeHash("y"));
});

describe("saved observation provenance", () => {
  it("invalidates evidence when its original source, probe, or runner changes", async () => {
    const problem = handoffProblems.find((p) => p.id === "handoff-cart")!;
    const lab = learningLab(problem);
    const source = await codeHash(observationSourceText(problem.starterCode, lab));
    for (const [code, changedLab] of [
      [problem.solution, lab],
      [problem.starterCode, { ...lab, version: "next-runner" }],
      [problem.starterCode, { ...lab, probe: { ...lab.probe, expression: "42" } }],
      [problem.starterCode, { ...lab, probe: { ...lab.probe, id: "other-probe" } }],
    ] as const)
      expect(await codeHash(observationSourceText(code, changedLab))).not.toBe(source);
    expect(
      await codeHash(observationSourceText(problem.starterCode, { ...lab, question: "new label" })),
    ).toBe(source);
  });
  it("round-trips provenance and identifies changed evidence independently of coaching replies", async () => {
    const t = {
      ...emptyTraining(),
      prediction: { choice: "shared", reason: "same object", locked: true },
      observation: { id: "prediction", status: "ok" as const, actual: "[3,3]" },
      observationSource: "a".repeat(64),
    };
    const evidenceSnapshot = await codeHash(coachingEvidenceText(t));
    const withCoach = {
      ...t,
      coach: {
        evidenceId: "prediction",
        observation: "둘 다 3입니다.",
        question: "같은 객체일까요?",
        nextCheck: "참조를 비교해 보세요.",
        snapshot: "b".repeat(64),
        evidenceSnapshot,
      },
    };
    const packed = writeHandoffDraft("edited code", readHandoffDraft("").notes, withCoach);
    expect(readHandoffDraft(packed).training).toEqual(withCoach);
    expect(await codeHash(coachingEvidenceText(withCoach))).toBe(evidenceSnapshot);
    for (const changed of [
      { ...t, observation: { ...t.observation, actual: "[2,3]" } },
      { ...t, prediction: { ...t.prediction, reason: "different reason" } },
      { ...t, observationSource: "c".repeat(64) },
    ])
      expect(await codeHash(coachingEvidenceText(changed))).not.toBe(evidenceSnapshot);
    expect(trainingSchema.safeParse({ ...t, observationSource: "not-a-hash" }).success).toBe(false);
  });
});

describe("execution result integrity", () => {
  const check = (code: string, expression: string) =>
    executeCase(engine, code, { id: "integrity", expression });
  it("protects result serialization and test-expression intrinsics from global/prototype changes", () => {
    for (const code of [
      'JSON.stringify = () => "true";',
      'globalThis.JSON = { stringify: () => "true" };',
      "Object.prototype.toJSON = () => true;",
      "Array.prototype.every = () => true;",
      "Reflect.ownKeys = () => [];",
      "Number.isFinite = () => true;",
    ]) {
      const result = check(code, "[false].every(x => x)");
      expect(result).toMatchObject({ status: "ok", actual: "false" });
      expect(sameOutput(result.actual, true)).toBe(false);
    }
    expect(check('const JSON = { stringify: () => "true" };', "false").status).toBe("error");
    expect(
      check('Object.defineProperty(Array.prototype, "every", {value: () => true})', "false").status,
    ).toBe("error");
  });
  it("never invokes custom toJSON or result getters to produce a passing projection", () => {
    expect(check("", "({valid:false,toJSON(){return {valid:true}}})").status).toBe("error");
    expect(
      check("", 'Object.defineProperty({valid:false}, "toJSON", {value:()=>({valid:true})})'),
    ).toMatchObject({ status: "ok", actual: '{"valid":false}' });
    const getter = check("", "({get valid(){while(true) {}}})");
    expect(getter.status).toBe("error");
    expect(getter.actual).toContain("getter");
    expect(check("", "Object.assign([false], {toJSON:()=>[true]})").status).toBe("error");
  });
  it.each([
    "NaN",
    "Infinity",
    "-Infinity",
    "[NaN]",
    "({value:undefined})",
    "[undefined]",
    "Array(1)",
    "1n",
    'Symbol("x")',
    "undefined",
    "() => true",
    "new Date(0)",
    'new Map([["value", false]])',
    '({[Symbol("value")]:true})',
    "Object.assign([1], {extra:2})",
    "(() => {const x={}; x.self=x; return x})()",
  ])("rejects %s instead of silently losing or changing values", (expression) => {
    expect(check("", expression).status).toBe("error");
  });
  it("preserves valid JSON values, shared references, own __proto__ keys and asynchronous results", () => {
    const expressions = [
      ["null", null],
      ["false", false],
      ["0", 0],
      ['"한글 😀 \\n"', "한글 😀 \n"],
      ["Object.assign(Object.create(null), {a:1})", { a: 1 }],
      ['JSON.parse(\'{"__proto__":{"safe":true}}\')', JSON.parse('{"__proto__":{"safe":true}}')],
      ["(() => {const x={a:1}; return [x,x]})()", [{ a: 1 }, { a: 1 }]],
      ["Promise.resolve({result:[true,null,2]})", { result: [true, null, 2] }],
    ] as const;
    for (const [expression, expected] of expressions) {
      const r = check("", expression);
      expect(r.status, r.actual).toBe("ok");
      expect(sameOutput(r.actual, expected)).toBe(true);
    }
  });
  it("bounds recursive serialization and can run again after failure", () => {
    for (const expression of [
      "(() => {let x={}; for(let i=0;i<100;i++)x={x}; return x})()",
      "Array(1001).fill(0)",
      "new Proxy({}, {ownKeys(){while(true){}}})",
    ])
      expect(check("", expression).status).toBe("error");
    expect(check("", "42")).toMatchObject({ status: "ok", actual: "42" });
  });
});

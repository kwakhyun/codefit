import { describe, it, expect, beforeAll } from "vitest";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from "quickjs-emscripten-core";
import { handoffProblems } from "../../data/handoff-problems";
import { learningLab } from "../server/learning-lab";
import { executeCase } from "./execute";
import { codeHash, emptyTraining, sameOutput, trainingSchema } from "./training";
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
      const observed = executeCase(engine, problem.starterCode, lab.probe);
      expect(observed.status).toBe("ok");
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

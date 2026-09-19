import { beforeAll, describe, expect, it } from "vitest";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant, type QuickJSWASMModule } from "quickjs-emscripten-core";
import { handoffProblems } from "../../data/handoff-problems";
import {
  codeHash,
  emptyTraining,
  trainingSchema,
  coachReplySchema,
  generatedCoachReplySchema,
} from "./training";
import { readHandoffDraft, writeHandoffDraft, formatHandoffDraft } from "./draft";
import { executeCase } from "./execute";
let engine: QuickJSWASMModule;
beforeAll(async () => {
  engine = await newQuickJSWASMModuleFromVariant(variant);
});
const p = handoffProblems.find((p) => p.id === "handoff-cart")!;
const expression =
  "(() => { const items = [{id:'a',quantity:2}]; const next = changeQuantity(items,'a',1); return [items[0].quantity,next[0].quantity]; })()";
const check = (source: string, expression: string) =>
  executeCase(engine, source, { id: "experiment", expression });
const legacyCoach = {
  evidenceId: "prediction",
  observation: "표시된 결과입니다.",
  question: "참조를 비교해 볼까요?",
  nextCheck: "원본과 비교해 보세요.",
};
describe("editable comparative experiments", () => {
  it("executes both actual implementations without replacing them or assigning a grade", () => {
    expect(check(p.starterCode, expression)).toMatchObject({ status: "ok", actual: "[3,3]" });
    expect(check(p.solution, expression)).toMatchObject({ status: "ok", actual: "[2,3]" });
    expect(check("function broken {", expression).status).toBe("error");
    expect(check(p.solution, "(() => { return missingLocal; })()").status).toBe("error");
  });
  it("keeps arbitrary experiment code isolated and bounded, then recovers", () => {
    expect(check(p.starterCode, "[typeof fetch, typeof process, typeof document]").actual).toBe(
      '["undefined","undefined","undefined"]',
    );
    expect(check(p.starterCode, "(() => { while(true) {} })()").status).toBe("error");
    expect(check(p.starterCode, "(() => { globalThis.leaked = 1; return leaked; })()").actual).toBe(
      "1",
    );
    expect(check(p.starterCode, "typeof leaked").actual).toBe('"undefined"');
    expect(check(p.solution, expression).actual).toBe("[2,3]");
  });
  it("keeps legacy coaching readable while requiring complete expressions for new responses", () => {
    expect(coachReplySchema.safeParse(legacyCoach).success).toBe(true);
    expect(generatedCoachReplySchema.safeParse(legacyCoach).success).toBe(false);
    expect(
      generatedCoachReplySchema.safeParse({
        ...legacyCoach,
        experiment: { expression },
        focus: { learnerQuote: null, goal: "원본과 수정 코드의 참조를 비교합니다." },
      }).success,
    ).toBe(true);
  });
  it("preserves current draft, old run conditions, and both outputs through save/restore/export", async () => {
    const run = {
      expression,
      prediction: "원본만 바뀔 것입니다.",
      sourceHash: await codeHash(p.starterCode),
      codeHash: await codeHash(p.solution),
      suiteVersion: "runner-test",
      original: check(p.starterCode, expression),
      current: check(p.solution, expression),
    };
    const training = {
      ...emptyTraining(),
      coach: {
        ...legacyCoach,
        snapshot: "old",
        experiment: { expression },
        focus: { learnerQuote: "이전 예측의 설명", goal: "질문 당시 설명을 확인합니다." },
      },
      experiment: { expression: "[1,2]", prediction: "다음 실험 예상", run },
    };
    const notes = { ...readHandoffDraft("").notes, verification: "실험을 비교했습니다." };
    const saved = writeHandoffDraft(p.solution, notes, training);
    expect(readHandoffDraft(saved)).toEqual({ implementation: p.solution, notes, training });
    expect(formatHandoffDraft(saved)).toContain("실행 당시 예상: 원본만 바뀔 것입니다.");
    expect(formatHandoffDraft(saved)).toContain("실험 수정 코드 (ok): [2,3]");
    expect(formatHandoffDraft(saved)).toContain("추가 실험 코드: [1,2]");
    expect(formatHandoffDraft(saved)).toContain("질문 당시 내 설명: 이전 예측의 설명");
    expect(formatHandoffDraft(saved)).toContain("질문으로 확인할 점: 질문 당시 설명을 확인합니다.");
    expect(
      trainingSchema.safeParse({
        ...training,
        experiment: { ...training.experiment, expression: "x".repeat(2001) },
      }).success,
    ).toBe(false);
    expect(
      trainingSchema.safeParse({
        ...training,
        experiment: { ...training.experiment, run: { ...run, codeHash: "bad" } },
      }).success,
    ).toBe(false);
  });
});

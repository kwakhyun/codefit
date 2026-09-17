import { describe, it, expect } from "vitest";
import { Script, createContext } from "node:vm";
import { handoffProblems, handoffSpecs } from "../../data/handoff-problems";
import { readHandoffDraft, writeHandoffDraft, missingHandoffFields } from "./draft";
import { handoffLearning, TRANSFER_DELAY_MS } from "./learning";
import { problemSchema, publicProblem, type AttemptSummary } from "../problem";
import { safeReturnTo } from "../library-state";

// Only checked-in fixtures are executed. node:vm is NOT a sandbox for user code.
async function run(code: string, expression: string) {
  const value = new Script(`${code}\n;${expression}`).runInContext(createContext({}), {
    timeout: 1000,
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    Promise.resolve(value),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error("Fixture did not settle")), 150);
    }),
  ]).finally(() => clearTimeout(timer));
  return JSON.parse(JSON.stringify(result));
}
describe("handoff reference quality", () => {
  for (const problem of handoffProblems) {
    it(`${problem.id}: valid contract, reference examples and a meaningful starting gap`, async () => {
      expect(problemSchema.parse(problem)).toEqual(problem);
      const safe = publicProblem(problem);
      expect(safe).not.toHaveProperty("solution");
      expect(safe).not.toHaveProperty("explanation");
      expect(safe).not.toHaveProperty("hints");
      expect(safe.scenario).not.toContain("서비스는 제출 코드를 실행하지 않습니다.");
      let failures = 0;
      for (const check of handoffSpecs[problem.handoff!.track].cases) {
        expect(await run(problem.solution, check.expression), check.note).toEqual(check.expected);
        try {
          if (
            JSON.stringify(await run(problem.starterCode, check.expression)) !==
            JSON.stringify(check.expected)
          )
            failures++;
        } catch {
          failures++;
        }
      }
      expect(failures).toBeGreaterThan(0);
      for (const example of problem.examples)
        expect(await run(problem.solution, example.input)).toEqual(JSON.parse(example.output));
    });
  }
  it("normal original aggregation behavior is retained, extension tested separately", async () => {
    const spec = handoffSpecs.total;
    for (const orders of [
      [],
      [
        { status: "paid", amount: 10 },
        { status: "pending", amount: 20 },
        { status: "cancelled", amount: 4 },
      ],
    ]) {
      const expression = `summarize(${JSON.stringify(orders)})`;
      const original = await run(spec.starter, expression);
      const next = await run(spec.solution, expression);
      expect(next.paid).toEqual(original.paid);
      expect(next.pending).toEqual(original.pending);
    }
  });
});
const notes = {
  understanding: "입력과 출력의 흐름 및 상태가 살아 있는 범위를 설명합니다.",
  diagnosis: "실패하는 조건과 기존에 유지해야 하는 정상 동작을 구분합니다.",
  verification: "입력과 기대 결과 및 회귀 테스트 코드를 기록합니다. 아직 실행하지 않았습니다.",
  decision: "변경한 부분과 유지한 부분 및 배포 전 남은 위험을 기록합니다.",
};
it("report and implementation roundtrip preserves literal code and hostile text as data", async () => {
  const implementation = "function demo() { return 42; }\n";
  const hostile = {
    ...notes,
    diagnosis: "</textarea>\n// break\u2028globalThis.secret = true;\u2029",
  };
  const packed = writeHandoffDraft(implementation, hostile);
  expect(readHandoffDraft(packed)).toEqual({ implementation, notes: hostile });
  expect(await run(packed, "typeof secret")).toBe("undefined");
  expect(
    missingHandoffFields(readHandoffDraft(writeHandoffDraft(implementation, notes)).notes),
  ).toEqual([]);
  expect(missingHandoffFields(readHandoffDraft(implementation).notes)).toHaveLength(4);
  const corrupt = implementation + "\n// CODEFIT_HANDOFF_V1 {invalid";
  expect(readHandoffDraft(corrupt).implementation).toBe(corrupt);
  expect(() =>
    writeHandoffDraft(implementation, { ...notes, decision: "a".repeat(2001) }),
  ).toThrow();
});
const start = Date.parse("2026-09-01T00:00:00.000Z");
function attempt(id: string, date: number, passed = false, assisted = false): AttemptSummary {
  return {
    id: `${id}-${date}`,
    problemId: id,
    createdAt: new Date(date).toISOString(),
    assisted,
    review: {
      passed,
      score: passed ? 100 : 50,
      summary: "검토 결과입니다.",
      criteria: [0, 1, 2, 3, 4, 5].map((requirementIndex) => ({
        requirementIndex,
        passed: passed || requirementIndex < 3,
        feedback: "코드와 근거를 보완해 주세요.",
      })),
      strengths: [],
      improvements: [],
    },
  };
}
it("recommends seven-day transfer, never mislabels early or assisted attempts as retained skill", () => {
  const base = attempt("handoff-cart", start);
  expect(handoffLearning([], start)[1].due).toBe(false);
  const pending = handoffLearning([base], start + TRANSFER_DELAY_MS - 1)[1];
  expect(pending.due).toBe(false);
  expect(pending.weaknesses).toHaveLength(3);
  expect(handoffLearning([base], start + TRANSFER_DELAY_MS)[1].due).toBe(true);
  const late = attempt("handoff-cart-transfer", start + TRANSFER_DELAY_MS, true);
  expect(handoffLearning([base, late])[1].retention).toBe("independent");
  expect(handoffLearning([base, { ...late, assisted: true }])[1].retention).toBe("needs-practice");
  const early = attempt("handoff-cart-transfer", start + 1000, false);
  expect(handoffLearning([late, early, base])[1].retention).toBe("early");
  expect(handoffLearning([base, late], start + TRANSFER_DELAY_MS)[1].due).toBe(false);
  expect(handoffLearning([late])[1].retention).toBe("early");
});
it("allows only the exact new return destination", () => {
  expect(safeReturnTo("/handoff")).toBe("/handoff");
  for (const value of ["//evil.test", "/handoff?next=https://evil.test", "/handoff/../login"])
    expect(safeReturnTo(value)).toBe("/");
});

it("keeps both live review reports tied to their actual fixtures and records mismatches honestly", async () => {
  const { createHash } = await import("node:crypto");
  const { handoffCases, strengthenedHandoffCases } = await import("../../../evals/handoff-cases");
  const { HANDOFF_REVIEW_PROMPT, HANDOFF_PROMPT_VERSION } = await import("../server/ai-prompts");
  const { default: first } = await import("../../../reports/ai-handoff-review.json");
  const { default: second } = await import("../../../reports/ai-handoff-strengthened.json");
  for (const [report, cases] of [
    [first, handoffCases],
    [second, strengthenedHandoffCases],
  ] as const) {
    expect(report.fingerprint).toBe(
      createHash("sha256")
        .update(JSON.stringify({ cases, prompt: HANDOFF_REVIEW_PROMPT }))
        .digest("hex"),
    );
    expect(report.promptVersion).toBe(HANDOFF_PROMPT_VERSION);
    expect(report.summary.matched).toBe(
      report.results.filter((r) => r.actualPass === r.expectedPass).length,
    );
    expect(report.summary.errors).toBe(report.results.filter((r) => r.actualPass === null).length);
  }
  expect(
    first.results
      .filter((r) => r.category === "starter" || r.category === "injection")
      .every((r) => r.actualPass === false),
  ).toBe(true);
  expect(second.summary).toMatchObject({ cases: 6, matched: 5, errors: 0 });
});

it("does not erase a completed delayed transfer after revisiting the base exercise", () => {
  const base = attempt("handoff-cart", start);
  const transfer = attempt("handoff-cart-transfer", start + TRANSFER_DELAY_MS, true);
  const revisited = attempt("handoff-cart", start + TRANSFER_DELAY_MS * 2, true);
  expect(
    handoffLearning([base, transfer, revisited], start + TRANSFER_DELAY_MS * 2)[1].retention,
  ).toBe("independent");
});
it("shows the latest transfer weaknesses instead of stale base feedback and schedules further practice", () => {
  const base = attempt("handoff-cart", start, true);
  const failed = attempt("handoff-cart-transfer", start + TRANSFER_DELAY_MS, false);
  const item = handoffLearning([base, failed], start + TRANSFER_DELAY_MS * 2)[1];
  expect(item.weaknesses).toHaveLength(3);
  expect(item.due).toBe(true);
});

it("surfaces an unreviewed draft and later practice without rewriting the first-attempt metric", () => {
  const draft = handoffLearning([], start, [{ problemId: "handoff-cart", hasDraft: true }])[1];
  expect(draft.next.label).toBe("작성 중인 과제 이어가기");
  const base = attempt("handoff-cart", start);
  const early = attempt("handoff-cart-transfer", start + 1);
  const retried = attempt("handoff-cart-transfer", start + TRANSFER_DELAY_MS, true);
  const later = handoffLearning([base, early, retried], start + TRANSFER_DELAY_MS * 2)[1];
  expect(later.retention).toBe("early");
  expect(later.due).toBe(true);
  expect(later.weaknesses).toEqual([]);
});
it("exports the complete report without allowing code fences to truncate the code", async () => {
  const { handoffDocument } = await import("./document");
  const code = "const text = `literal`; // ```";
  const doc = handoffDocument("인수인계", writeHandoffDraft(code, notes));
  expect(doc).toContain("````javascript\n" + code + "\n````");
  expect(doc).toContain(notes.verification);
  expect(doc).toContain("실행 검증을 의미하지 않습니다");
});

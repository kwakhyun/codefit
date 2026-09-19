import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { handoffProblems } from "../src/data/handoff-problems";
import { emptyTraining, sameOutput, type ExecutionResult } from "../src/lib/handoff/training";
import { executeCase } from "../src/lib/handoff/execute";
import { learningLab } from "../src/lib/server/learning-lab";
import { coachUnderstanding, COACH_PROMPT_VERSION } from "../src/lib/server/ai-coach";
import type { AiRun } from "../src/lib/ai-telemetry";

const { values } = parseArgs({ options: { live: { type: "boolean" } } });
type Spec = {
  id: string;
  problem: string;
  reason: string;
  target: string;
  replace?: [string, string];
  witness?: string;
};
const specs: Spec[] = [
  {
    id: "page-string-claim",
    problem: "handoff-page-transfer",
    reason:
      "빈 배열의 결과가 0인 건 이해했습니다. Number로 바꾸면 문자열 페이지와 크기도 유효한 숫자 입력으로 받아야 합니다.",
    target: "Prioritize the explicit string-coercion claim over repeating empty-page prediction.",
    replace: [
      "  size = Number.isInteger(size)",
      "  page = Number(page); size = Number(size);\n  size = Number.isInteger(size)",
    ],
    witness: "paginate([1,2,3], '2', '1')",
  },
  {
    id: "dedupe-retry-claim",
    problem: "handoff-dedupe",
    reason:
      "동시에 한 번만 실행되는 건 맞습니다. 실패한 id도 이미 처리했으니 다음 호출에서 작업을 다시 실행하면 안 됩니다.",
    target: "Test retry after rejection, not just simultaneous count.",
    replace: ["      jobs.delete(id);", "      // retain failed job"],
    witness:
      "(async()=>{let calls=0;const run=createOnce(()=>{if(++calls===1)throw Error('x');return 7;});try{await run('a');}catch{}let value;try{value=await run('a');}catch{value='error';}return [calls,value];})()",
  },
  {
    id: "config-port-claim",
    problem: "handoff-config-transfer",
    reason:
      "false 문자열 비교는 맞았습니다. PORT는 parseInt로 앞 숫자만 읽으면 되므로 80x도 80으로 받아야 합니다.",
    target: "Target malformed PORT while keeping the correct DEBUG explanation.",
    replace: [
      "  const raw = env.PORT ?? '3000';",
      "  const raw = env.PORT === undefined ? '3000' : String(parseInt(env.PORT, 10));",
    ],
    witness: "(()=>{try{return parseConfig({PORT:'80x'});}catch{return 'error';}})()",
  },
  {
    id: "config-debug-claim",
    problem: "handoff-config-transfer",
    reason:
      "문자열 false는 불리언 false가 맞습니다. DEBUG가 빈 문자열이어도 생략한 것과 같으니 오류 없이 false로 처리해야 합니다.",
    target: "Test explicit empty DEBUG against omitted DEBUG, not unrelated valid boolean strings.",
    replace: [
      "  if (env.DEBUG !== undefined && env.DEBUG !== 'true' && env.DEBUG !== 'false') throw new Error('Invalid DEBUG');",
      "  // accept all DEBUG strings",
    ],
    witness: "(()=>{try{return parseConfig({DEBUG:''});}catch{return 'error';}})()",
  },
  {
    id: "dispose-load-claim",
    problem: "handoff-latest-transfer",
    reason:
      "같은 검색어면 두 응답이 표시될 수 있습니다. dispose 이후 새 run이 load를 호출해도 publish만 막으면 요구사항을 만족합니다.",
    target: "Observe new load calls after disposal, not only suppressing a pending publication.",
    replace: ["      if (disposed) return;", "      // continue after disposal"],
    witness:
      "(async()=>{let calls=0;const c=createLatest(async()=>++calls,()=>{});c.dispose();await c.run('x');return calls;})()",
  },
  {
    id: "rejection-claim",
    problem: "handoff-latest",
    reason:
      "완료될 때마다 publish하니 두 결과가 나옵니다. load가 실패하면 run이 오류를 삼키고 정상 완료해야 호출자가 안전합니다.",
    target:
      "Test promised rejection propagation with an observed outcome, not a race-only experiment.",
    replace: [
      "      const value = await load(query);",
      "      let value; try { value = await load(query); } catch { return; }",
    ],
    witness:
      "(async()=>{const c=createLatest(async()=>{throw Error('x');},()=>{});try{await c.run('x');return 'fulfilled';}catch{return 'rejected';}})()",
  },
  {
    id: "correct-total-control",
    problem: "handoff-total",
    reason:
      "paid와 pending 조건에 cancelled는 포함되지 않습니다. 기존 두 합계는 정상이며 취소 합계 추가는 별도 요구사항입니다.",
    target:
      "Respect a correct reason; explore a boundary without calling the existing behavior wrong.",
  },
  {
    id: "correct-debug-control",
    problem: "handoff-config-transfer",
    reason:
      "DEBUG가 문자열 false이면 true 문자열과 같지 않아서 불리언 false입니다. 이것만으로 모든 PORT 입력까지 안전하다고 판단할 수는 없습니다.",
    target:
      "Do not invent a conversion misconception; a legal boundary or validation question is appropriate.",
  },
];
if (!values.live) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        paidCalls: specs.length,
        cases: specs.map(({ id, target }) => ({ id, target })),
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
const engine = await newQuickJSWASMModuleFromVariant(variant);
function different(a: ExecutionResult, b: ExecutionResult) {
  if (a.status !== b.status) return true;
  return a.status === "ok" ? !sameOutput(a.actual, JSON.parse(b.actual)) : a.actual !== b.actual;
}
const cases = specs.map((s) => {
  const p = handoffProblems.find((p) => p.id === s.problem)!;
  const lab = learningLab(p);
  const observation = executeCase(engine, p.starterCode, lab.probe);
  if (observation.status !== "ok") throw new Error("Invalid original fixture");
  const choice = lab.choices.find((c) => sameOutput(observation.actual, JSON.parse(c.output)))!;
  let mutant: string | null = null;
  let witness: { reference: ExecutionResult; mutant: ExecutionResult } | null = null;
  if (s.replace && s.witness) {
    if (p.solution.split(s.replace[0]).length !== 2) throw new Error(`Ambiguous mutation ${s.id}`);
    mutant = p.solution.replace(...s.replace);
    const test = { id: "witness", expression: s.witness };
    witness = {
      reference: executeCase(engine, p.solution, test),
      mutant: executeCase(engine, mutant, test),
    };
    if (
      witness.reference.status !== "ok" ||
      witness.mutant.status !== "ok" ||
      !different(witness.reference, witness.mutant)
    )
      throw new Error(`Mutation has no verified distinguishing witness: ${s.id}`);
  }
  return {
    id: s.id,
    target: s.target,
    mutant,
    witness,
    input: {
      originalCode: p.starterCode,
      currentCode: p.solution,
      lab,
      training: {
        ...emptyTraining(),
        prediction: { choice: choice.id, reason: s.reason, locked: true },
        observation,
      },
    },
  };
});
const fixtureHash = createHash("sha256").update(JSON.stringify(cases)).digest("hex");
const sourceHash = createHash("sha256")
  .update(readFileSync("src/lib/server/ai-coach.ts"))
  .update(readFileSync("src/lib/handoff/training.ts"))
  .digest("hex");
const path = `reports/coach-targeting-${Date.now()}.json`;
const entries: unknown[] = [];
for (const c of cases) {
  let run: AiRun | undefined;
  try {
    const reply = await coachUnderstanding(c.input, (r) => {
      run = r;
    });
    const expression = reply.experiment.expression;
    const test = { id: "target-experiment", expression };
    const original = executeCase(engine, c.input.originalCode, test);
    const reference = executeCase(engine, c.input.currentCode, test);
    const mutant = c.mutant ? executeCase(engine, c.mutant, test) : null;
    const detectsTarget = mutant ? reference.status === "ok" && different(reference, mutant) : null;
    entries.push({
      case: c,
      reply,
      run,
      execution: { original, reference, mutant },
      detectsTarget,
      usableTargetExperiment:
        detectsTarget === null ? null : detectsTarget && original.status === "ok",
      semanticReview: null,
    });
    console.log(`${c.id}: target distinction ${detectsTarget ?? "control; review pending"}`);
  } catch (error) {
    entries.push({
      case: c,
      run,
      error: error instanceof Error ? error.message : "Unknown error",
      detectsTarget: false,
      semanticReview: null,
    });
    console.log(`${c.id}: provider failure`);
  }
  writeFileSync(
    path,
    JSON.stringify(
      {
        promptVersion: COACH_PROMPT_VERSION,
        measuredAt: new Date().toISOString(),
        fixtureHash,
        sourceHash,
        completed: entries.length,
        total: cases.length,
        complete: entries.length === cases.length,
        entries,
        limitations:
          "Developer-authored diagnostic mutation adequacy, not independent tutoring accuracy. Mutants/witnesses/target labels are not sent to the model. Same complete task contract used for baseline and candidate. Controls are qualitative.",
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(`Report: ${path}`);

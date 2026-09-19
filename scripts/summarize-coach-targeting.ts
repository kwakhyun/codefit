import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { executeCase } from "../src/lib/handoff/execute";
import { sameOutput, type CoachReply, type ExecutionResult } from "../src/lib/handoff/training";

// Offline audit of preserved calls. This script never invokes an AI provider.
type Entry = {
  case: {
    id: string;
    mutant?: string | null;
    input: {
      originalCode: string;
      currentCode: string;
      training: { prediction: { reason: string } };
    };
  };
  reply?: CoachReply;
  result?: CoachReply;
  run: { estimatedCostUsd: number; model: string };
  execution?: Record<string, ExecutionResult | null>;
  experimentExecution?: Record<string, ExecutionResult>;
};
type Report = {
  complete: boolean;
  completed: number;
  total: number;
  promptVersion: string;
  fixtureHash: string;
  sourceHash: string;
  entries: Entry[];
};
const hash = (text: string | Buffer) => createHash("sha256").update(text).digest("hex");
const sourceHash = createHash("sha256")
  .update(readFileSync("src/lib/server/ai-coach.ts"))
  .update(readFileSync("src/lib/handoff/training.ts"))
  .digest("hex");
const paths = [
  "reports/coach-targeting-1789839039686.json",
  "reports/coach-targeting-1789839183635.json",
  "reports/understanding-coach-1789839275008.json",
  "reports/coach-targeting-1789839492902.json",
  "reports/understanding-coach-1789839497565.json",
];
const engine = await newQuickJSWASMModuleFromVariant(variant);
const differs = (a: ExecutionResult, b: ExecutionResult) =>
  a.status !== b.status ||
  (a.status === "ok" ? !sameOutput(a.actual, JSON.parse(b.actual)) : a.actual !== b.actual);
const runs = paths.map((path) => {
  const raw = readFileSync(path);
  const r = JSON.parse(raw.toString()) as Report;
  assert(r.complete && r.completed === r.total && r.entries.length === r.total, path);
  assert.equal(hash(JSON.stringify(r.entries.map((e) => e.case))), r.fixtureHash, path);
  const final = r.promptVersion === "2026-09-20.coach.4.1";
  if (final) assert.equal(r.sourceHash, sourceHash, "Final source has changed; evaluate it again");
  let replayed = 0;
  const cases = r.entries.map((e) => {
    const reply = e.reply ?? e.result;
    assert(reply?.experiment, e.case.id);
    const execution = e.execution ?? e.experimentExecution;
    assert(execution, e.case.id);
    const quote = reply.focus?.learnerQuote;
    const groundedQuote =
      quote == null
        ? null
        : Boolean(quote.trim()) && e.case.input.training.prediction.reason.includes(quote);
    assert(groundedQuote !== false, e.case.id);
    if (final) {
      for (const [name, saved] of Object.entries(execution)) {
        if (!saved) continue;
        const code =
          name === "original"
            ? e.case.input.originalCode
            : name === "mutant"
              ? e.case.mutant
              : e.case.input.currentCode;
        assert(code, e.case.id);
        const actual = executeCase(engine, code, {
          id: saved.id,
          expression: reply.experiment.expression,
        });
        assert(!differs(actual, saved), `${e.case.id}/${name}: replay changed`);
        replayed++;
      }
    }
    const mutant = execution.mutant;
    const reference = execution.reference;
    const detectsTarget =
      mutant && reference ? reference.status === "ok" && differs(reference, mutant) : null;
    return {
      id: e.case.id,
      detectsTarget,
      usableTargetExperiment:
        detectsTarget === null ? null : detectsTarget && execution.original?.status === "ok",
      groundedQuote,
      executionErrors: Object.entries(execution)
        .filter(([, value]) => value && value.status !== "ok")
        .map(([name]) => name),
    };
  });
  return {
    path,
    sha256: hash(raw),
    promptVersion: r.promptVersion,
    fixtureHash: r.fixtureHash,
    sourceHash: r.sourceHash,
    paidCalls: r.entries.length,
    estimatedCostUsd: Number(r.entries.reduce((s, e) => s + e.run.estimatedCostUsd, 0).toFixed(8)),
    model: [...new Set(r.entries.map((e) => e.run.model))],
    targets: cases.filter((c) => c.detectsTarget !== null).length,
    detectedTargets: cases.filter((c) => c.detectsTarget === true).length,
    usableTargetExperiments: cases.filter((c) => c.usableTargetExperiment === true).length,
    finalExecutionsReplayed: replayed,
    cases,
  };
});
assert.equal(new Set(runs.filter((r) => r.targets).map((r) => r.fixtureHash)).size, 1);
const output = {
  verifiedAt: new Date().toISOString(),
  paidCalls: runs.reduce((s, r) => s + r.paidCalls, 0),
  estimatedCostUsd: Number(runs.reduce((s, r) => s + r.estimatedCostUsd, 0).toFixed(8)),
  additionalPaidCallsForThisAudit: 0,
  finalExecutionsReplayed: runs.reduce((s, r) => s + r.finalExecutionsReplayed, 0),
  runs,
  semanticReview:
    "Developer-agent qualitative review in docs/coach-targeting.md; no independent ratings",
  limitations: [
    "Six authored misconception mutations and two correct-reason controls, reused while refining the prompt.",
    "Eight historical regression cases are not unseen holdouts. Mutation detection is not tutoring accuracy.",
    "Intermediate same-query experiment mislabeled its inputs; runnable does not mean pedagogically valid.",
    "Final direct-provider inconsistent-client-observation case still misses the discrepancy. The product HTTP preflight rejects this input before calling AI.",
    "Literal quote membership does not prove a relevant or correct interpretation.",
    "Estimated token costs use recorded rates, not invoices. No real user data or independent learning study.",
  ],
  independentHumanRaters: 0,
  realStudyParticipants: 0,
  sotaEstablished: false,
};
writeFileSync("reports/coach-targeting-reliability.json", JSON.stringify(output, null, 2) + "\n");
console.log(
  JSON.stringify({
    paidCalls: output.paidCalls,
    estimatedCostUsd: output.estimatedCostUsd,
    finalExecutionsReplayed: output.finalExecutionsReplayed,
    additionalPaidCalls: 0,
  }),
);

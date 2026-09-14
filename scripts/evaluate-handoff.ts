import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { createHash } from "node:crypto";
import { handoffCases, strengthenedHandoffCases } from "../evals/handoff-cases";
import { reviewCode } from "../src/lib/server/ai";
import { HANDOFF_REVIEW_PROMPT, HANDOFF_PROMPT_VERSION } from "../src/lib/server/ai-prompts";
import type { AiRun } from "../src/lib/ai-telemetry";

const strengthened = process.argv.includes("--strengthened");
const cases = strengthened ? strengthenedHandoffCases : handoffCases;

if (!process.argv.includes("--live")) {
  console.log(
    `${cases.length} handoff cases. --live makes paid API calls; writes only a local report.`,
  );
  process.exit(0);
}
try {
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
} catch {
  /* Environment may supply credentials. */
}
if (!process.env.OPENAI_API_KEY) throw Error("AI credentials unavailable");
process.env.OPENAI_REVIEW_MODEL = "gpt-5.6-luna";
const results: {
  id: string;
  category: string;
  expectedPass: boolean;
  actualPass: boolean | null;
  criteria: unknown;
  run: AiRun | null;
}[] = [];
let next = 0;
async function worker() {
  while (next < cases.length) {
    const item = cases[next++];
    let run: AiRun | null = null;
    try {
      const review = await reviewCode(item.problem, item.code, (r) => {
        run = r;
      });
      results.push({
        id: item.id,
        category: item.category,
        expectedPass: item.expectedPass,
        actualPass: review.passed,
        criteria: review.criteria,
        run,
      });
      console.log(`${item.id}: ${review.passed === item.expectedPass ? "matched" : "mismatch"}`);
    } catch {
      results.push({
        id: item.id,
        category: item.category,
        expectedPass: item.expectedPass,
        actualPass: null,
        criteria: [],
        run,
      });
      console.log(`${item.id}: provider error`);
    }
  }
}
await Promise.all([worker(), worker()]);
results.sort((a, b) => a.id.localeCompare(b.id));
const report = {
  measuredAt: new Date().toISOString(),
  model: "gpt-5.6-luna",
  promptVersion: HANDOFF_PROMPT_VERSION,
  fingerprint: createHash("sha256")
    .update(JSON.stringify({ cases, prompt: HANDOFF_REVIEW_PROMPT }))
    .digest("hex"),
  limits:
    "Development fixtures, one run each; written by the implementer, not a held-out or human-adjudicated learning benchmark. No submitted-code execution. No production database writes.",
  summary: {
    cases: results.length,
    matched: results.filter((r) => r.actualPass === r.expectedPass).length,
    errors: results.filter((r) => r.actualPass === null).length,
    estimatedCostUsd: results.reduce((sum, r) => sum + (r.run?.estimatedCostUsd ?? 0), 0),
  },
  results,
};
writeFileSync(
  strengthened ? "reports/ai-handoff-strengthened.json" : "reports/ai-handoff-review.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report.summary));
if (report.summary.matched !== results.length) process.exitCode = 1;

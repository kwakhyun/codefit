import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parseEnv } from "node:util";
import { reviewCases } from "../evals/review-cases";
import { reviewCode } from "../src/lib/server/ai";
import { PROMPT_VERSION, REVIEW_PROMPT, REVIEW_REASONING } from "../src/lib/server/ai-prompts";
import { PRICING, type AiRun } from "../src/lib/ai-telemetry";
import { evaluationSummary, type EvaluationCaseResult } from "../src/lib/evaluation";

if (!process.argv.includes("--live")) {
  console.log(
    `${reviewCases.length} fixed cases ready. Use --live to call the configured provider (maximum 16 requests, concurrency 2).`,
  );
  process.exit(0);
}
try {
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  for (const key of ["OPENAI_API_KEY", "OPENAI_MODEL", "OPENAI_REVIEW_MODEL"])
    if (!process.env[key] && env[key]) process.env[key] = env[key];
} catch {
  /* CI may supply the key directly. */
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required for live evaluation");
const results: (EvaluationCaseResult & { run: AiRun | null; feedback: string[] })[] = [];
let index = 0;
async function worker() {
  while (index < reviewCases.length) {
    const test = reviewCases[index++];
    let run: AiRun | null = null;
    const started = performance.now();
    let actual: boolean[] | null = null;
    let feedback: string[] = [];
    try {
      const review = await reviewCode(test.problem, test.code, (value) => {
        run = value;
      });
      actual = review.criteria.map((c) => c.passed);
      feedback = review.criteria.map((c) => c.feedback);
    } catch {
      /* No request body or raw provider errors are written to reports. */
    }
    results.push({
      id: test.id,
      category: test.category,
      expected: test.expected,
      actual,
      latencyMs: Math.round(performance.now() - started),
      run,
      feedback,
    });
    console.log(
      `${test.id}: ${actual === null ? "provider/validation error" : JSON.stringify(actual) === JSON.stringify(test.expected) ? "matched" : "mismatch"}`,
    );
  }
}
await Promise.all([worker(), worker()]);
results.sort((a, b) => a.id.localeCompare(b.id));
const report = {
  measuredAt: new Date().toISOString(),
  mode: "live-static-review",
  promptVersion: PROMPT_VERSION,
  reasoningEffort: REVIEW_REASONING,
  fingerprint: createHash("sha256")
    .update(
      JSON.stringify({ cases: reviewCases, prompt: REVIEW_PROMPT, reasoning: REVIEW_REASONING }),
    )
    .digest("hex"),
  models: [...new Set(results.flatMap((r) => (r.run ? [r.run.model] : [])))],
  summary: evaluationSummary(results),
  usage: {
    inputTokens: results.reduce((sum, r) => sum + (r.run?.inputTokens || 0), 0),
    outputTokens: results.reduce((sum, r) => sum + (r.run?.outputTokens || 0), 0),
    estimatedCostUsd: results.reduce((sum, r) => sum + (r.run?.estimatedCostUsd || 0), 0),
    unpricedRequests: results.filter((r) => r.run?.estimatedCostUsd == null).length,
    pricing: PRICING,
  },
  limitations: [
    "16 development cases across four languages; not a held-out benchmark or an estimate of all-language accuracy.",
    "One stochastic run per case; labels were manually authored against requirements, not independently adjudicated.",
    "AI performs static review. No submitted code is executed. Provider failures are reported separately, never counted as passes.",
    "Estimated cost uses published standard text-token prices; unmetered failures and account-specific billing are excluded.",
  ],
  results,
};
mkdirSync("reports", { recursive: true });
writeFileSync("reports/ai-evaluation.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ summary: report.summary, usage: report.usage }));
if (report.summary.errors || report.summary.falsePasses || report.summary.falseRejects)
  process.exitCode = 1;

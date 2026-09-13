import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs, parseEnv } from "node:util";
import { generationCases, generationRubric } from "../evals/generation-cases";
import { generateProblem } from "../src/lib/server/ai";
import { GENERATION_PROMPT, PROMPT_VERSION } from "../src/lib/server/ai-prompts";
import { MODEL_PRICING, type AiRun } from "../src/lib/ai-telemetry";
import { generationSchema } from "../src/lib/problem";
import { percentile } from "../src/lib/evaluation";

const { values } = parseArgs({
  options: {
    live: { type: "boolean" },
    resume: { type: "boolean" },
    model: { type: "string" },
    repeat: { type: "string", default: "2" },
  },
});
const models = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"];
const model = values.model;
const repeats = Number(values.repeat);
if (!model || !models.includes(model))
  throw new Error("Choose --model gpt-5.6-sol|gpt-5.6-terra|gpt-5.6-luna");
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error("repeat must be 1-3");
if (!values.live) {
  console.log(
    `${generationCases.length * repeats} requests planned for ${model}; use --live (paid, concurrency 2, no DB writes).`,
  );
  process.exit(0);
}
try {
  const env = parseEnv(readFileSync(".env.local", "utf8"));
  if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY;
} catch {
  /* CI can supply the key. */
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
process.env.OPENAI_GENERATION_MODEL = model;
const jobs = Array.from({ length: repeats }, (_, repetition) =>
  generationCases.map((test) => ({ test, repetition: repetition + 1 })),
).flat();
// Validate every fixture before the first paid request.
for (const { test } of jobs) generationSchema.parse({ ...test, requestId: randomUUID() });
type Result = {
  id: string;
  repetition: number;
  run: AiRun | null;
  content: Awaited<ReturnType<typeof generateProblem>> | null;
};
const results: Result[] = [];
let index = 0;
mkdirSync("reports", { recursive: true });
const output = `reports/ai-generation-${model.replace("gpt-5.6-", "")}.json`;
let correctedFixtureFailures = 0;
if (values.resume) {
  const previous = JSON.parse(readFileSync(output, "utf8"));
  const expectedPreviousFingerprint = createHash("sha256")
    .update(
      JSON.stringify({
        cases: previous.cases,
        prompt: GENERATION_PROMPT,
        rubric: generationRubric,
      }),
    )
    .digest("hex");
  if (
    previous.model !== model ||
    previous.repeats !== repeats ||
    previous.promptVersion !== PROMPT_VERSION ||
    previous.fingerprint !== expectedPreviousFingerprint
  )
    throw new Error("Cannot resume a different model, repetition count or prompt version");
  correctedFixtureFailures = previous.correctedFixtureFailures ?? 0;
  for (const result of previous.results as Result[]) {
    if (!result.run) {
      correctedFixtureFailures++;
      continue;
    }
    const currentCase = generationCases.find((c) => c.id === result.id);
    const previousCase = previous.cases.find((c: { id: string }) => c.id === result.id);
    if (JSON.stringify(currentCase) !== JSON.stringify(previousCase))
      throw new Error("Cannot reuse a paid result after changing its fixture");
    results.push(result);
  }
}
function persist() {
  writeFileSync(
    output,
    JSON.stringify(
      {
        measuredAt: new Date().toISOString(),
        model,
        repeats,
        promptVersion: PROMPT_VERSION,
        fingerprint: createHash("sha256")
          .update(
            JSON.stringify({
              cases: generationCases,
              correctedFixtureFailures,
              prompt: GENERATION_PROMPT,
              rubric: generationRubric,
            }),
          )
          .digest("hex"),
        settings: {
          reasoning: "provider default (medium per model docs)",
          maxOutputTokens: 10000,
          timeoutMs: 90000,
          maxRetries: 0,
          concurrency: 2,
          existingTitles: [],
        },
        cases: generationCases,
        rubric: generationRubric,
        summary: {
          planned: jobs.length,
          completed: results.filter((r) => r.content).length,
          errors: results.filter((r) => !r.content).length,
          latencyP50Ms: percentile(
            results.map((r) => r.run?.latencyMs ?? 0),
            0.5,
          ),
          latencyP95Ms: percentile(
            results.map((r) => r.run?.latencyMs ?? 0),
            0.95,
          ),
          inputTokens: results.reduce((s, r) => s + (r.run?.inputTokens ?? 0), 0),
          outputTokens: results.reduce((s, r) => s + (r.run?.outputTokens ?? 0), 0),
          estimatedCostUsd: results.reduce((s, r) => s + (r.run?.estimatedCostUsd ?? 0), 0),
          unpricedRequests: results.filter((r) => r.run?.estimatedCostUsd == null).length,
        },
        pricing: MODEL_PRICING,
        limitations: [
          "Small development sample, not a held-out benchmark or proof of equivalence.",
          "Schema success does not establish semantic quality; separate source-level assessment is required.",
          "Provider errors/response loss can incur unmetered costs. No production database writes or generated-code execution by this script.",
        ],
        results: [...results].sort(
          (a, b) => a.id.localeCompare(b.id) || a.repetition - b.repetition,
        ),
      },
      null,
      2,
    ) + "\n",
  );
}
async function worker() {
  while (index < jobs.length) {
    const { test, repetition } = jobs[index++];
    if (results.some((r) => r.id === test.id && r.repetition === repetition)) continue;
    const result: Result = { id: test.id, repetition, run: null, content: null };
    try {
      result.content = await generateProblem(
        generationSchema.parse({ ...test, requestId: randomUUID() }),
        [],
        (run) => {
          result.run = run;
        },
      );
    } catch {
      /* Do not persist raw provider errors, headers or secrets. */
    }
    results.push(result);
    persist();
    console.log(
      `${model} ${test.id} run ${repetition}: ${result.content ? "schema valid (quality pending)" : "provider/validation error"}`,
    );
  }
}
await Promise.all([worker(), worker()]);
if (results.some((r) => !r.content)) process.exitCode = 1;

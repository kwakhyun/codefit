import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { analyzeProject } from "../src/lib/server/ai-project-check";
import type { AiRun } from "../src/lib/ai-telemetry";

const { values } = parseArgs({
  options: {
    live: { type: "boolean" },
    model: { type: "string" },
    snapshot: { type: "string", default: "artifacts/project-quality/page.json" },
  },
});
if (!values.model || !["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"].includes(values.model))
  throw new Error("Choose --model gpt-5.6-luna|gpt-5.6-terra|gpt-5.6-sol");
if (!values.live) {
  console.log("One paid request, no database writes. Add --live to run.");
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY)
  throw new Error("Load OPENAI_API_KEY using --env-file or environment");
process.env.OPENAI_PROJECT_MODEL = values.model;
const page = JSON.parse(readFileSync(values.snapshot!, "utf8"));
let run: AiRun | undefined;
let content, error;
try {
  content = await analyzeProject(page, "", AbortSignal.timeout(60_000), (value) => {
    run = value;
  });
} catch (e) {
  error = e instanceof Error ? e.message : "Request failed";
}
const report = {
  model: values.model,
  inputHash: createHash("sha256").update(JSON.stringify(page)).digest("hex"),
  page,
  description: "",
  run,
  content,
  error,
};
const path = `reports/project-questions-${values.model}.json`;
writeFileSync(path, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ path, run, content, error }, null, 2));

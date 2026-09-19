import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { ASSESSMENT_RUBRIC_VERSION } from "../src/lib/server/project-assessment-references";
import { assessProject } from "../src/lib/server/ai-project-check";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import type { AssessmentEvidence } from "../src/lib/project-check/types";
import type { AiRun } from "../src/lib/ai-telemetry";
import { assessmentCases as regressionCases } from "./fixtures/project-assessment-cases";
import { assessmentStressCases } from "./fixtures/project-assessment-stress-cases";
import { assessmentMixedCases } from "./fixtures/project-assessment-mixed-cases";
const { values } = parseArgs({
  options: {
    live: { type: "boolean" },
    model: { type: "string", default: "gpt-5.6-luna" },
    suite: { type: "string", default: "regression" },
  },
});
if (!["regression", "stress", "mixed"].includes(values.suite!))
  throw new Error("Unsupported suite");
const assessmentCases =
  values.suite === "mixed"
    ? assessmentMixedCases
    : values.suite === "stress"
      ? assessmentStressCases
      : regressionCases;
const models = ["gpt-5.6-luna", "gpt-5.6-terra", "gpt-5.6-sol"];
if (!models.includes(values.model!)) throw new Error("Unsupported model");
if (!values.live) {
  console.log(
    JSON.stringify(
      {
        mode: "dry-run",
        cases: assessmentCases.length,
        model: values.model,
        suite: values.suite,
        maxOutputTokensPerCall: 6500,
        note: `No API calls. --live performs ${assessmentCases.length} paid calls with synthetic answers only.`,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
process.env.OPENAI_PROJECT_REVIEW_MODEL = values.model;
const startedAt = new Date().toISOString();
const sourceHash = createHash("sha256")
  .update(readFileSync("src/lib/server/ai-project-check.ts"))
  .update(readFileSync("src/lib/server/project-assessment.ts"))
  .update(readFileSync("src/lib/server/project-assessment-references.ts"))
  .update(readFileSync("src/lib/project-check/types.ts"))
  .digest("hex");
const entries: unknown[] = [];
let passed = 0;
mkdirSync("reports", { recursive: true });
const path = `reports/project-assessment-${values.suite}-${values.model}-${Date.now()}.json`;
for (const item of assessmentCases) {
  const answers =
    "answers" in item
      ? item.answers
      : Array.from({ length: 5 }, (_, i) => (i === item.index ? item.answer : ""));
  let run: AiRun | undefined;
  let raw: unknown;
  try {
    const result = await assessProject(
      fixtureCheck,
      answers,
      AbortSignal.timeout(60_000),
      (value) => {
        run = value;
      },
      (value) => {
        raw = value;
      },
    );
    const feedback = result.feedback[item.index];
    const absent: readonly string[] = "absent" in item ? item.absent : [];
    const ok =
      feedback.level >= item.range[0] &&
      feedback.level <= item.range[1] &&
      absent.every((key) => feedback.evidence?.[key as keyof AssessmentEvidence] === null) &&
      result.feedback.every((f) => {
        const range =
          "ranges" in item
            ? item.ranges[f.questionIndex]
            : f.questionIndex === item.index
              ? item.range
              : [0, 0];
        return (
          f.level >= range[0] &&
          f.level <= range[1] &&
          (!("absentByQuestion" in item) ||
            item.absentByQuestion[f.questionIndex].every(
              (key) => f.evidence?.[key as keyof AssessmentEvidence] === null,
            ))
        );
      });
    if (ok) passed++;
    entries.push({ case: item, passed: ok, result, raw, run });
    console.log(
      `${item.id}: ${ok ? "PASS" : "FAIL"} ${"ranges" in item ? `levels=${result.feedback.map((f) => f.level).join(",")}` : `level=${feedback.level}, expected=${item.range.join("..")}`}`,
    );
  } catch (error) {
    entries.push({
      case: item,
      passed: false,
      error: error instanceof Error ? error.message : "Unknown error",
      run,
      raw,
    });
    console.log(`${item.id}: ERROR (see report)`);
  }
  // Preserve completed calls if interrupted; never silently retry paid calls.
  writeFileSync(
    path,
    JSON.stringify(
      {
        startedAt,
        updatedAt: new Date().toISOString(),
        model: values.model,
        suite: values.suite,
        rubricVersion: ASSESSMENT_RUBRIC_VERSION,
        sourceHash,
        completed: entries.length,
        complete: entries.length === assessmentCases.length,
        fixtureHash: createHash("sha256")
          .update(JSON.stringify({ fixtureCheck, assessmentCases }))
          .digest("hex"),
        passed,
        total: assessmentCases.length,
        limitations:
          "Authored regression cases; one sample per case, no independent raters. Not evidence of learning effectiveness or SOTA.",
        entries,
      },
      null,
      2,
    ) + "\n",
  );
}
console.log(`Report: ${path}; ${passed}/${assessmentCases.length} passed`);
if (passed !== assessmentCases.length) process.exitCode = 1;

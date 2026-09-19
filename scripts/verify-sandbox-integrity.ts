import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import { newQuickJSWASMModuleFromVariant } from "quickjs-emscripten-core";
import { executeCase } from "../src/lib/handoff/execute";
import { sameOutput, LAB_VERSION } from "../src/lib/handoff/training";
import { handoffProblems } from "../src/data/handoff-problems";
import { learningLab } from "../src/lib/server/learning-lab";

// Reviewed pre-change source, immutable Git reference; never execute learner code
// directly in Node. Both versions run the synthetic code inside bounded QuickJS.
const baselineCommit = "43eb771e1cf3aa7e40dd6c9e626e7c07364f60b8";
const source = execFileSync("git", ["show", `${baselineCommit}:src/lib/handoff/execute.ts`], {
  encoding: "utf8",
});
const javascript = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const baseline: { executeCase: typeof executeCase } = await import(
  `data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`
);
const engine = await newQuickJSWASMModuleFromVariant(variant);
const cases = [
  {
    id: "replaced-json",
    code: 'JSON.stringify = () => "true";',
    expression: "false",
    expected: true,
  },
  {
    id: "spoofed-toJSON",
    code: "",
    expression: "({valid:false,toJSON(){return {valid:true}}})",
    expected: { valid: true },
  },
  { id: "nonfinite-null", code: "", expression: "NaN", expected: null },
  { id: "sparse-array", code: "", expression: "Array(1)", expected: [null] },
];
const reproductions = cases.map((c) => {
  const before = baseline.executeCase(engine, c.code, c),
    after = executeCase(engine, c.code, c);
  return {
    ...c,
    before,
    after,
    falsePassBefore: before.status === "ok" && sameOutput(before.actual, c.expected),
    falsePassAfter: after.status === "ok" && sameOutput(after.actual, c.expected),
  };
});
const curriculum = handoffProblems.map((problem) => {
  const lab = learningLab(problem);
  return {
    id: problem.id,
    cases: lab.checkpoints.map((c) => {
      const result = executeCase(engine, problem.solution, c);
      return {
        id: c.id,
        result,
        passed: result.status === "ok" && sameOutput(result.actual, c.expected),
      };
    }),
  };
});
const paths = [
  "src/lib/handoff/execute.ts",
  "src/lib/handoff/sandbox-bootstrap.ts",
  "src/lib/handoff/training.ts",
];
const report = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: process.platform,
  arch: process.arch,
  quickjsVersion: JSON.parse(
    readFileSync("node_modules/quickjs-emscripten-core/package.json", "utf8"),
  ).version,
  baselineCommit,
  baselineSourceHash: createHash("sha256").update(source).digest("hex"),
  sourceHashes: Object.fromEntries(
    paths.map((p) => [p, createHash("sha256").update(readFileSync(p)).digest("hex")]),
  ),
  labVersion: LAB_VERSION,
  reproductions,
  curriculum,
  summary: {
    falsePassesBefore: reproductions.filter((r) => r.falsePassBefore).length,
    falsePassesAfter: reproductions.filter((r) => r.falsePassAfter).length,
    referenceProblems: curriculum.length,
    referenceCheckpoints: curriculum.flatMap((r) => r.cases).length,
    referenceCheckpointsPassed: curriculum.flatMap((r) => r.cases).filter((r) => r.passed).length,
  },
  limitations: [
    "Four authored reproductions, not an exhaustive adversarial security audit.",
    "Browser-side exercise evidence is not a server-certified grade.",
    "No paid AI calls or production database access.",
    "This script checks values and curriculum compatibility, not performance or learning effectiveness.",
  ],
};
writeFileSync("reports/sandbox-integrity.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report.summary, null, 2));
if (
  report.summary.falsePassesBefore !== 4 ||
  report.summary.falsePassesAfter !== 0 ||
  report.summary.referenceCheckpointsPassed !== report.summary.referenceCheckpoints
)
  process.exitCode = 1;

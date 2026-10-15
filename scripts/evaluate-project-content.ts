/** Opt-in live regression harness. Reports stay in ignored artifacts; no database writes. */
import { mkdir, readFile, writeFile, rename, realpath } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readProjectRepository } from "../src/lib/server/project-repository";
import {
  evaluateProjectContent,
  parseContentSnapshot,
  parseContentStages,
  safeContentFailure,
} from "./lib/project-content-evaluation";
const { values } = parseArgs({
  options: {
    live: { type: "boolean" },
    url: { type: "string" },
    snapshot: { type: "string" },
    stages: { type: "string" },
    out: { type: "string", default: `artifacts/project-content/${Date.now()}.json` },
  },
});
const selected = parseContentStages(values.stages);
if (!values.live) {
  console.log(
    `Dry run: ${selected.join(", ")}. No API calls or file writes. Use --live and exactly one of --url or --snapshot. Omitted prerequisites must exist in the saved report. Reports contain private source and generated drafts; keep them in ignored artifacts/.`,
  );
  process.exit(0);
}
if (!process.env.OPENAI_API_KEY) throw new Error("Load OPENAI_API_KEY through the environment.");
if (Boolean(values.url) === Boolean(values.snapshot))
  throw new Error("Provide exactly one of --url or --snapshot (a saved page or report).");
const output = path.resolve(values.out!);
const artifacts = path.resolve("artifacts");
if (!output.startsWith(artifacts + path.sep))
  throw new Error("Keep reports under ignored artifacts/.");
await mkdir(path.dirname(output), { recursive: true });
const realArtifacts = await realpath(artifacts);
const realDirectory = await realpath(path.dirname(output));
if (realDirectory !== realArtifacts && !realDirectory.startsWith(realArtifacts + path.sep))
  throw new Error(
    "Report directory must remain inside artifacts/; external symlinks are not allowed.",
  );
// TypeSafe batches may finish concurrently. Serialize and atomically replace reports.
let writing = Promise.resolve();
const save = (report: unknown) => {
  const serialized = JSON.stringify(report, null, 2) + "\n";
  writing = writing.then(async () => {
    await writeFile(output + ".tmp", serialized);
    await rename(output + ".tmp", output);
  });
  return writing;
};
try {
  let input;
  try {
    input = parseContentSnapshot(
      values.url
        ? await readProjectRepository(values.url, AbortSignal.timeout(40_000))
        : JSON.parse(await readFile(values.snapshot!, "utf8")),
    );
  } catch (error) {
    await save({
      version: 2,
      selectedStages: selected,
      passed: false,
      stages: { page: { status: "failed", failure: safeContentFailure(error) } },
    });
    throw error;
  }
  const report = await evaluateProjectContent(input, selected, save, undefined, (name, status) =>
    console.log(`${name}: ${status}`),
  );
  process.exitCode = report.passed ? 0 : 1;
  console.log(
    `Static content gates ${report.passed ? "passed" : "incomplete"}. Private report: ${output}`,
  );
} catch {
  console.error(`Evaluation did not complete. Inspect the private report: ${output}`);
  process.exitCode = 1;
}

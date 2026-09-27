/** Opt-in live regression harness. Reports stay in ignored artifacts; no database writes. */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { randomUUID } from "node:crypto";
import { readProjectRepository } from "../src/lib/server/project-repository";
import { analyzeProject, generateProjectExercises } from "../src/lib/server/ai-project-check";
import { ContentQualityError } from "../src/lib/server/project-content-quality";
import { repositorySnapshotSchema } from "../src/lib/project-check/repository";
import type { PageSnapshot, StoredCheck } from "../src/lib/project-check/types";
import type { AiRun } from "../src/lib/ai-telemetry";

const { values } = parseArgs({
  options: {
    live: { type: "boolean" },
    url: { type: "string" },
    snapshot: { type: "string" },
    out: { type: "string", default: `artifacts/project-content/${Date.now()}.json` },
  },
});
if (!values.live) {
  console.log(
    "Paid generation + independent quality review; up to one repair per stage. No database writes. Use --live and exactly one of --url or --snapshot. Load credentials through the environment.",
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
const report: Record<string, unknown> = { startedAt: new Date().toISOString(), stages: {} };
const stages = report.stages as Record<string, unknown>;
await mkdir(path.dirname(output), { recursive: true });
const save = () => writeFile(output, JSON.stringify(report, null, 2) + "\n");
async function stage<T>(name: string, action: () => Promise<T>) {
  const started = performance.now();
  try {
    const result = await action();
    report[name] = result;
    stages[name] = { status: "passed", elapsedMs: Math.round(performance.now() - started) };
    await save();
    console.log(`${name}: passed`);
    return result;
  } catch (error) {
    stages[name] = {
      status: "failed",
      elapsedMs: Math.round(performance.now() - started),
      errorType: error instanceof Error ? error.constructor.name : "unknown",
      ...(error instanceof ContentQualityError ? { findings: error.findings } : {}),
    };
    await save();
    throw error;
  }
}
try {
  const page = await stage("page", async (): Promise<PageSnapshot> => {
    if (values.url) return readProjectRepository(values.url, AbortSignal.timeout(40_000));
    const snapshot = JSON.parse(await readFile(values.snapshot!, "utf8"));
    const page = (snapshot.page ?? snapshot) as PageSnapshot;
    // Pinning the saved source makes comparisons independent of a moving branch.
    page.repository = repositorySnapshotSchema.parse(page.repository);
    return page;
  });
  const runs: AiRun[] = [];
  report.analysisRuns = runs;
  const analysis = await stage("analysis", () =>
    analyzeProject(page, "", AbortSignal.timeout(105_000), (run) => {
      runs.push(run);
    }),
  );
  const check: StoredCheck = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    description: "",
    page,
    analysis,
  };
  const code = await stage(
    "code",
    async () => (await generateProjectExercises(check, AbortSignal.timeout(105_000), "code")).code,
  );
  await stage(
    "service",
    async () =>
      (
        await generateProjectExercises(
          check,
          AbortSignal.timeout(105_000),
          "service",
          code.map(({ title, situation, question }) => ({ title, situation, question })),
        )
      ).service,
  );
  report.completedAt = new Date().toISOString();
  await save();
  console.log(
    `5 questions + 3 code + 3 service exercises passed generation gates. Static review only. Report: ${output}`,
  );
} catch {
  console.error(`Generation did not pass all stages. Inspect the private report: ${output}`);
  process.exitCode = 1;
}

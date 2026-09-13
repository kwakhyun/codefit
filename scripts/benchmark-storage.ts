import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir, cpus, platform } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { SqliteStore } from "../src/lib/server/sqlite-store";
import { seedProblems } from "../src/data/problems";
import { percentile } from "../src/lib/evaluation";

// Never use DATABASE_URL or DATABASE_PATH: this benchmark owns a disposable local database.
const directory = mkdtempSync(join(tmpdir(), "codefit-benchmark-"));
const store = new SqliteStore(join(directory, "benchmark.sqlite"));
try {
  const problems = Array.from({ length: 5000 }, (_, i) => ({
    ...seedProblems[i % seedProblems.length],
    id: `bench-${String(i).padStart(5, "0")}`,
    source: "ai" as const,
    createdAt: new Date(1700000000000 + i * 1000).toISOString(),
  }));
  store.importBackup("benchmark", {
    version: 2,
    problems,
    attempts: [],
    progress: {},
    legacy: null,
  });
  const params = new URLSearchParams({ domain: "frontend", source: "ai", sort: "newest" });
  const legacy = () => store.summaries();
  const query = () => store.queries.library("benchmark", params);
  const before = legacy(),
    after = await query();
  assert.deepEqual(
    after.problems.map((p) => p.id),
    before
      .filter((p) => p.domain === "frontend" && p.source === "ai")
      .slice(0, 8)
      .map((p) => p.id),
  );
  const measure = async (run: () => unknown) => {
    for (let i = 0; i < 10; i++) await run();
    const samples = [];
    for (let i = 0; i < 100; i++) {
      const start = performance.now();
      await run();
      samples.push(performance.now() - start);
    }
    return { p50Ms: percentile(samples, 0.5), p95Ms: percentile(samples, 0.95) };
  };
  const report = {
    measuredAt: new Date().toISOString(),
    runtime: process.version,
    platform: platform(),
    cpu: cpus()[0]?.model,
    database: "SQLite / disposable local fixture",
    rows: problems.length + seedProblems.length,
    warmups: 10,
    iterations: 100,
    query: { domain: "frontend", source: "ai", sort: "newest", page: 1, pageSize: 8 },
    before: {
      description: "Read and parse every summary, as the previous workspace API did",
      ...(await measure(legacy)),
      payloadBytes: Buffer.byteLength(JSON.stringify(before)),
    },
    after: {
      description: "Count and retrieve one filtered page with the same ordering",
      ...(await measure(query)),
      payloadBytes: Buffer.byteLength(JSON.stringify(after)),
    },
    plan: store.db
      .prepare(
        "EXPLAIN QUERY PLAN SELECT summary FROM problem_catalog WHERE domain=? AND source=? ORDER BY created_at DESC,id DESC LIMIT 8",
      )
      .all("frontend", "ai"),
    limitations:
      "Local warm-cache read timings, excluding HTTP and network latency. This is a bounded-response comparison, not production PostgreSQL throughput or load capacity.",
  };
  mkdirSync("reports", { recursive: true });
  writeFileSync("reports/storage-benchmark.json", JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ rows: report.rows, before: report.before, after: report.after }));
} finally {
  store.db.close();
  rmSync(directory, { recursive: true });
}

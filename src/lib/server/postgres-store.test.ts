import { projectContract } from "./project-contract.test-helper";
import { concurrencyContract } from "./concurrency-contract.test-helper";
import { queryContract } from "./query-contract.test-helper";
import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedProblems } from "../../data/problems";
import type { Review } from "../problem";
import { PostgresStore } from "./postgres-store";
import { Pool } from "pg";
import { createAuth } from "./auth-config";
import { serializeSignedCookie } from "better-call";
import { getMigrations } from "better-auth/db/migration";

const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL persistence and concurrency", () => {
  const schema = `codefit_test_${randomUUID().replaceAll("-", "")}`;
  let admin: Sql;
  let sql: Sql;
  let store: PostgresStore;
  beforeAll(async () => {
    admin = postgres(url!, { max: 1, prepare: false, onnotice: () => {} });
    await admin.unsafe(`CREATE SCHEMA ${schema}`);
    sql = postgres(url!, {
      max: 5,
      prepare: false,
      connection: { options: `-c search_path=${schema}` },
      onnotice: () => {},
    });
    // Some hosted poolers ignore startup search_path; never write fixtures to public.
    expect((await sql`SELECT current_schema() AS schema`)[0].schema).toBe(schema);
    store = new PostgresStore(sql);
    await store.initialize();
  }, 60_000);
  afterAll(async () => {
    if (sql) await sql.end();
    if (admin) {
      await admin.unsafe(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  }, 30_000);
  queryContract(() => store);
  projectContract(() => store);
  concurrencyContract(
    () => store,
    (id) => sql`UPDATE jobs SET expires=0 WHERE id=${id}`,
  );
  it("stores and revokes authenticated sessions with the hosted PostgreSQL driver", async () => {
    const pool = new Pool({ connectionString: url, max: 1, options: `-c search_path=${schema}` });
    try {
      expect((await pool.query("SELECT current_schema() AS schema")).rows[0].schema).toBe(schema);
      const secret = "postgres-test-secret-with-at-least-32-characters";
      const auth = createAuth({ database: pool, baseURL: "http://localhost:3010", secret });
      const migrations = await getMigrations(auth.options);
      expect(migrations.toBeCreated).toEqual([]);
      expect(migrations.toBeAdded).toEqual([]);
      const context = await auth.$context;
      const user = await context.internalAdapter.createUser(
        { name: "Hosted Developer", email: `${randomUUID()}@example.com`, emailVerified: true },
        { method: "test" },
      );
      const session = (await context.internalAdapter.createSession(user.id))!;
      const cookie = (
        await serializeSignedCookie("codefit.session_token", session.token, secret)
      ).split(";", 1)[0];
      const read = () =>
        auth.handler(
          new Request("http://localhost:3010/api/auth/get-session", { headers: { cookie } }),
        );
      expect((await (await read()).json()).user.id).toBe(user.id);
      const response = await auth.handler(
        new Request("http://localhost:3010/api/auth/sign-out", {
          method: "POST",
          headers: { cookie, origin: "http://localhost:3010", "content-type": "application/json" },
          body: "{}",
        }),
      );
      expect(response.status).toBe(200);
      expect(await (await read()).json()).toBeNull();
    } finally {
      await pool.end();
    }
  }, 30000);
  it("seeds without exposing answers and keeps owners separate", async () => {
    expect((await store.summaries()).filter((p) => p.source === "curated").length).toBe(
      seedProblems.length,
    );
    expect((await store.summaries())[0]).not.toHaveProperty("solution");
    await store.saveProgress("alice", "be-pagination", {
      baseRevision: 0,
      code: "my draft",
      bookmarked: true,
    });
    expect((await store.progress("alice"))["be-pagination"].code).toBe("my draft");
    expect((await store.progress("bob"))["be-pagination"]).toBeUndefined();
    const fresh = new PostgresStore(sql);
    expect((await fresh.progress("alice"))["be-pagination"].bookmarked).toBe(true);
  }, 30000);
  it("caps concurrent hints and preserves a changed draft during review", async () => {
    const p = (await store.problem("be-pagination"))!;
    await Promise.all(Array.from({ length: 8 }, () => store.reveal("alice", p, "hint")));
    expect((await store.progress("alice"))[p.id].hintsViewed).toBe(p.hints.length);
    await store.saveProgress("alice", p.id, { baseRevision: 1, code: "newer draft" });
    const review: Review = {
      score: 100,
      passed: true,
      summary: "모든 요구사항을 충족했습니다.",
      criteria: p.requirements.map((_, i) => ({
        requirementIndex: i,
        passed: true,
        feedback: "요구사항을 충족했습니다.",
      })),
      strengths: ["경계 조건을 처리했습니다."],
      improvements: [],
    };
    await store.saveAttempt("alice", p.id, "submitted draft", review);
    expect((await store.progress("alice"))[p.id]).toMatchObject({
      code: "newer draft",
      status: "solved",
    });
    expect((await store.attempts("alice", p.id))[0]).toMatchObject({
      code: "submitted draft",
      assisted: true,
    });
  }, 30000);
  it("enforces rate limits atomically across concurrent requests", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.consumeLimits([{ key: "test-concurrent", max: 3, windowMs: 60000 }]),
      ),
    );
    expect(attempts.filter(Boolean)).toHaveLength(3);
    expect(
      await store.consumeLimits(
        [{ key: "test-concurrent", max: 3, windowMs: 60000 }],
        Date.now() + 61000,
      ),
    ).toBe(true);
  }, 30000);
  it("claims a generation once and commits its problem with the job result", async () => {
    const id = randomUUID();
    const jobs = await Promise.all(
      Array.from({ length: 6 }, () => store.startJob("alice", id, "generate", "same-input")),
    );
    expect(jobs.filter((j) => j.state === "new")).toHaveLength(1);
    const p = { ...seedProblems[0], id: `ai-${randomUUID()}`, source: "ai" as const };
    const winner = jobs.find((j) => j.state === "new")!;
    if (winner.state !== "new") throw new Error("Missing winner");
    await store.reserveGeneration(winner.lease);
    await store.completeGeneration(p, winner.lease);
    expect(await store.startJob("alice", id, "generate", "same-input")).toEqual({
      state: "done",
      result: p.id,
    });
    expect((await store.problem(p.id))?.title).toBe(p.title);
    await expect(store.startJob("bob", id, "generate", "same-input")).rejects.toThrow();
  }, 30000);
  it("uses five distinct connections for competing conditional code writes and duplicate completions", async () => {
    const connections = await Promise.all(Array.from({ length: 5 }, () => sql.reserve()));
    try {
      const pids = await Promise.all(connections.map((c) => c`SELECT pg_backend_pid() AS pid`));
      expect(new Set(pids.map((rows) => rows[0].pid)).size).toBe(5);
    } finally {
      connections.forEach((c) => c.release());
    }
    const owner = randomUUID(),
      id = seedProblems[0].id;
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, (_, i) =>
        store.saveProgress(owner, id, { code: `writer-${i}`, baseRevision: 0 }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await store.progressFor(owner, id))?.codeRevision).toBe(1);
    const job = await store.startJob(owner, randomUUID(), `review:${id}`, "same-input");
    if (job.state !== "new") throw new Error("No execution");
    const review: Review = {
      score: 0,
      passed: false,
      summary: "검토",
      criteria: [],
      strengths: [],
      improvements: [],
    };
    const completions = await Promise.allSettled(
      Array.from({ length: 5 }, () => store.saveAttempt(owner, id, "same code", review, job.lease)),
    );
    expect(completions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await store.attempts(owner)).toHaveLength(1);
  }, 30000);
  it("rolls back problem, completion and quota together if final job update fails", async () => {
    const owner = `user:${randomUUID()}`,
      id = randomUUID();
    const job = await store.startJob(owner, id, "generate", "input");
    if (job.state !== "new") throw new Error("No lease");
    await store.reserveGeneration(job.lease);
    const problem = { ...seedProblems[0], id: `atomic-${randomUUID()}`, source: "ai" as const };
    await sql.unsafe(
      `CREATE FUNCTION reject_completion() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.state='done' THEN RAISE EXCEPTION 'injected completion failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER reject_completion BEFORE UPDATE ON jobs FOR EACH ROW EXECUTE FUNCTION reject_completion();`,
    );
    try {
      await expect(store.completeGeneration(problem, job.lease)).rejects.toThrow();
      expect(await store.problem(problem.id)).toBeNull();
      expect((await sql`SELECT state FROM generation_usage WHERE request_id=${id}`)[0].state).toBe(
        "pending",
      );
      expect((await store.startJob(owner, id, "generate", "input")).state).toBe("pending");
    } finally {
      await sql.unsafe(
        "DROP TRIGGER reject_completion ON jobs; DROP FUNCTION reject_completion();",
      );
    }
    await store.completeGeneration(problem, job.lease);
    expect((await sql`SELECT state FROM generation_usage WHERE request_id=${id}`)[0].state).toBe(
      "done",
    );
  }, 30000);
  it("imports idempotently and rolls back a malformed backup atomically", async () => {
    const backup = {
      version: 2 as const,
      exportedAt: new Date().toISOString(),
      problems: seedProblems,
      progress: await store.progress("alice"),
      attempts: await store.attempts("alice"),
      legacy: null,
    };
    const first = await store.importBackup("restored", backup);
    expect(first.attempts).toBe(1);
    expect((await store.progress("restored"))["be-pagination"].code).toBe("newer draft");
    expect((await store.importBackup("restored", backup)).attempts).toBe(0);
    const freshProblem = { ...seedProblems[0], id: `rollback-${randomUUID()}` };
    const invalid = {
      ...backup,
      problems: [freshProblem],
      attempts: [{ ...backup.attempts[0], problemId: "missing" }],
    };
    await expect(store.importBackup("invalid", invalid)).rejects.toThrow();
    expect(await store.problem(freshProblem.id)).toBeNull();
    expect(await store.progress("invalid")).toEqual({});
  }, 30000);
});

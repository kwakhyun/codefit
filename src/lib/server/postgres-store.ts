import { StoreQueries } from "./store-queries";
import { catalogColumns, catalogValues } from "./catalog-record";
import { validateLimits } from "./usage-policy";
import postgres, { type Sql, type TransactionSql } from "postgres";
import { seedProblems } from "../../data/problems";
import type { Backup } from "../backup";
import {
  validateReview,
  type Attempt,
  type Problem,
  type ProblemSummary,
  type Progress,
  type Review,
} from "../problem";
import type { JobClaim, ProblemStore, ProgressPatch, UsageLimit } from "./store-contract";
import { createAttempt, importedAttemptId, toAttempt, toProgress } from "./store-records";

import { storageSchema } from "./storage-schema.mjs";

export class PostgresStore implements ProblemStore {
  constructor(
    private readonly sql: Sql | TransactionSql,
    private readonly inTransaction = false,
  ) {}
  get queries() {
    return new StoreQueries(async (text, values = []) => {
      let index = 0;
      return this.sql.unsafe(
        text.replace(/\?/g, () => `$${++index}`),
        values,
      );
    }, "postgres");
  }
  private async addCatalog(problem: Problem) {
    await this.sql.unsafe(
      `INSERT INTO problem_catalog (${catalogColumns}) VALUES (${catalogValues(problem)
        .map((_, i) => `$${i + 1}`)
        .join(",")}) ON CONFLICT(id) DO NOTHING`,
      catalogValues(problem),
    );
  }
  private async transaction<T>(fn: (store: PostgresStore) => Promise<T>): Promise<T> {
    if (this.inTransaction) return fn(this);
    return (await (this.sql as Sql).begin(async (tx) => fn(new PostgresStore(tx, true)))) as T;
  }
  async initialize() {
    await this.transaction(async (store) => {
      // Serialize cold-start migrations across serverless instances.
      await store.sql`SELECT pg_advisory_xact_lock(704712001)`;
      await store.sql.unsafe(storageSchema);
      for (const problem of seedProblems)
        await store.sql`INSERT INTO problems(id,content,created_at) VALUES(${problem.id},${JSON.stringify(problem)},${problem.createdAt}) ON CONFLICT(id) DO NOTHING`;
      while (true) {
        const rows =
          await store.sql`SELECT content FROM problems p WHERE NOT EXISTS (SELECT 1 FROM problem_catalog c WHERE c.id=p.id) LIMIT 100`;
        if (!rows.length) break;
        for (const row of rows) await store.addCatalog(JSON.parse(row.content));
      }
    });
  }
  async problem(id: string): Promise<Problem | null> {
    const [row] = await this.sql`SELECT content FROM problems WHERE id=${id}`;
    return row ? JSON.parse(row.content) : null;
  }
  async problems() {
    return (await this.sql`SELECT content FROM problems ORDER BY created_at DESC`).map(
      (row) => JSON.parse(row.content) as Problem,
    );
  }
  async summaries(): Promise<ProblemSummary[]> {
    const rows = await this
      .sql`SELECT content::jsonb - ARRAY['solution','hints','explanation','scenario','requirements','starterCode','examples'] AS summary, jsonb_array_length(content::jsonb->'hints') AS hint_count FROM problems ORDER BY created_at DESC`;
    return rows.map((row) => ({ ...row.summary, hintCount: Number(row.hint_count) }));
  }
  async addProblem(problem: Problem) {
    await this.transaction(async (store) => {
      await store.sql`INSERT INTO problems(id,content,created_at) VALUES(${problem.id},${JSON.stringify(problem)},${problem.createdAt})`;
      await store.addCatalog(problem);
    });
  }
  async progressFor(owner: string, id: string): Promise<Progress | null> {
    const [row] = await this.sql`SELECT * FROM progress WHERE owner=${owner} AND problem_id=${id}`;
    return row ? toProgress(row) : null;
  }
  async completeGeneration(problem: Problem, jobId: string) {
    await this.transaction(async (store) => {
      await store.addProblem(problem);
      await store.finishJob(jobId, problem.id);
    });
  }
  async progress(owner: string): Promise<Record<string, Progress>> {
    return Object.fromEntries(
      (await this.sql`SELECT * FROM progress WHERE owner=${owner}`).map((row) => [
        row.problem_id,
        toProgress(row),
      ]),
    );
  }
  private async ensureProgress(owner: string, id: string) {
    await this
      .sql`INSERT INTO progress(owner,problem_id,updated_at) VALUES(${owner},${id},${new Date().toISOString()}) ON CONFLICT(owner,problem_id) DO NOTHING`;
  }
  async saveProgress(owner: string, id: string, patch: ProgressPatch) {
    return this.transaction(async (store) => {
      await store.ensureProgress(owner, id);
      const now = new Date().toISOString();
      if (patch.code !== undefined)
        await store.sql`UPDATE progress SET code=${patch.code},status=CASE WHEN status='solved' THEN status ELSE 'in-progress' END,updated_at=${now} WHERE owner=${owner} AND problem_id=${id}`;
      if (patch.bookmarked !== undefined)
        await store.sql`UPDATE progress SET bookmarked=${Number(patch.bookmarked)},updated_at=${now} WHERE owner=${owner} AND problem_id=${id}`;
      return (await store.progressFor(owner, id))!;
    });
  }
  async reveal(owner: string, problem: Problem, kind: "hint" | "solution") {
    return this.transaction(async (store) => {
      await store.ensureProgress(owner, problem.id);
      if (kind === "hint")
        await store.sql`UPDATE progress SET hints_viewed=LEAST(hints_viewed+1,${problem.hints.length}),updated_at=${new Date().toISOString()} WHERE owner=${owner} AND problem_id=${problem.id}`;
      else
        await store.sql`UPDATE progress SET solution_viewed=1,updated_at=${new Date().toISOString()} WHERE owner=${owner} AND problem_id=${problem.id}`;
      return (await store.progressFor(owner, problem.id))!;
    });
  }
  async attempts(owner: string, problemId?: string): Promise<Attempt[]> {
    const rows = problemId
      ? await this
          .sql`SELECT * FROM attempts WHERE owner=${owner} AND problem_id=${problemId} ORDER BY created_at DESC`
      : await this.sql`SELECT * FROM attempts WHERE owner=${owner} ORDER BY created_at DESC`;
    return rows.map(toAttempt);
  }
  async saveAttempt(
    owner: string,
    id: string,
    code: string,
    review: Review,
    jobId?: string,
  ): Promise<Attempt> {
    return this.transaction(async (store) => {
      await store.ensureProgress(owner, id);
      const [row] =
        await store.sql`SELECT * FROM progress WHERE owner=${owner} AND problem_id=${id} FOR UPDATE`;
      const p = toProgress(row);
      const attempt = createAttempt(id, code, review, p);
      await store.sql`INSERT INTO attempts VALUES(${attempt.id},${owner},${id},${code},${JSON.stringify(review)},${Number(attempt.assisted)},${attempt.createdAt})`;
      await store.sql`UPDATE progress SET status=CASE WHEN status='solved' OR ${Number(review.passed)}=1 THEN 'solved' ELSE 'in-progress' END,updated_at=${attempt.createdAt} WHERE owner=${owner} AND problem_id=${id}`;
      if (jobId) await store.finishJob(jobId, attempt.id);
      return attempt;
    });
  }
  async consumeLimits(entries: UsageLimit[], now = Date.now()) {
    validateLimits(entries);
    return this.transaction(async (store) => {
      await store.sql`SELECT pg_advisory_xact_lock(704712002)`;
      await store.sql`DELETE FROM limits WHERE expires<=${now}`;
      for (const entry of entries) {
        const [row] = await store.sql`SELECT count FROM limits WHERE key=${entry.key}`;
        if (Number(row?.count || 0) + (entry.cost ?? 1) > entry.max) return false;
      }
      for (const entry of entries)
        await store.sql`INSERT INTO limits VALUES(${entry.key},${entry.cost ?? 1},${now + entry.windowMs}) ON CONFLICT(key) DO UPDATE SET count=limits.count+EXCLUDED.count`;
      return true;
    });
  }
  async startJob(owner: string, id: string, kind: string): Promise<JobClaim> {
    return this.transaction(async (store) => {
      await store.sql`SELECT pg_advisory_xact_lock(hashtextextended(${"codefit-job:" + id},0))`;
      const [row] = await store.sql`SELECT * FROM jobs WHERE id=${id}`;
      if (row && (row.owner !== owner || row.kind !== kind)) return { state: "pending" };
      if (row?.state === "done") return { state: "done", result: String(row.result) };
      if (row && Number(row.expires) > Date.now()) return { state: "pending" };
      await store.sql`INSERT INTO jobs VALUES(${id},${owner},${kind},'pending',NULL,${Date.now() + 150_000}) ON CONFLICT(id) DO UPDATE SET state='pending',result=NULL,expires=EXCLUDED.expires`;
      return { state: "new" };
    });
  }
  async finishJob(id: string, result: string) {
    await this.sql`UPDATE jobs SET state='done',result=${result} WHERE id=${id}`;
  }
  async failJob(id: string) {
    await this.sql`DELETE FROM jobs WHERE id=${id} AND state='pending'`;
  }
  async importBackup(owner: string, backup: Backup) {
    return this.transaction(async (store) => {
      await store.sql`SELECT pg_advisory_xact_lock(704712003)`;
      let problems = 0,
        attempts = 0;
      for (const problem of backup.problems) {
        const rows =
          await store.sql`INSERT INTO problems VALUES(${problem.id},${JSON.stringify(problem)},${problem.createdAt}) ON CONFLICT(id) DO NOTHING RETURNING id`;
        if (rows.length) await store.addCatalog(problem);
        problems += rows.length;
      }
      for (const p of Object.values(backup.progress)) {
        if (!(await store.problem(p.problemId)))
          throw new Error("Backup references an unknown problem");
        await store.sql`INSERT INTO progress VALUES(${owner},${p.problemId},${p.code},${Number(p.bookmarked)},${p.hintsViewed},${Number(p.solutionViewed)},${p.status},${p.updatedAt}) ON CONFLICT(owner,problem_id) DO NOTHING`;
      }
      for (const attempt of backup.attempts) {
        const problem = await store.problem(attempt.problemId);
        if (!problem) throw new Error("Backup references an unknown problem");
        const review = validateReview(attempt.review, problem);
        if (
          (await store.sql`SELECT 1 FROM attempts WHERE owner=${owner} AND id=${attempt.id}`).length
        )
          continue;
        const id = importedAttemptId(owner, attempt.id);
        const rows =
          await store.sql`INSERT INTO attempts VALUES(${id},${owner},${attempt.problemId},${attempt.code},${JSON.stringify(review)},${Number(attempt.assisted)},${attempt.createdAt}) ON CONFLICT(id) DO NOTHING RETURNING id`;
        attempts += rows.length;
      }
      if (backup.legacy) await store.archiveLegacy(owner, backup.legacy);
      return { problems, attempts };
    });
  }
  async archiveLegacy(owner: string, content: unknown) {
    await this
      .sql`INSERT INTO legacy VALUES(${owner},${JSON.stringify(content)},${new Date().toISOString()}) ON CONFLICT(owner) DO NOTHING`;
  }
  async legacy(owner: string): Promise<unknown> {
    const [row] = await this.sql`SELECT content FROM legacy WHERE owner=${owner}`;
    return row ? JSON.parse(row.content) : null;
  }
}
export function connectPostgres(url: string) {
  return postgres(url, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
    onnotice: () => {},
  });
}

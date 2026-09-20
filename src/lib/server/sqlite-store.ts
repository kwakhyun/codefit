import { randomUUID } from "node:crypto";
import { checkCodeRevision, existingClaim, ownsJob, StaleJob } from "./write-conflicts";
import { StoreQueries } from "./store-queries";
import { authSchema } from "./auth-schema.mjs";
import { generationAllowance, GENERATION_LEASE_MS, generationDay } from "./generation-quota";
import { catalogColumns, catalogValues } from "./catalog-record";
import { validateLimits } from "./usage-policy";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { seedProblems } from "../../data/problems";
import type { Backup } from "../backup";
import {
  backupReads,
  backupParameters,
  buildBackup,
  prepareBackup,
  restoredProjectId,
  restoredProjectJobs,
} from "./workspace-backup";
import {
  validateReview,
  type Attempt,
  type Problem,
  type ProblemSummary,
  type Progress,
  type Review,
} from "../problem";
import { storageSchema, storageColumns } from "./storage-schema.mjs";
import type { JobLease, JobClaim, ProblemStore, ProgressPatch, UsageLimit } from "./store-contract";
import { createAttempt, importedAttemptId, toAttempt, toProgress } from "./store-records";

export class SqliteStore implements ProblemStore {
  readonly db: DatabaseSync;
  private inTransaction = false;
  get queries() {
    return new StoreQueries(
      async (sql, values = []) => this.db.prepare(sql).all(...values),
      "sqlite",
    );
  }
  constructor(location: string | DatabaseSync) {
    if (typeof location !== "string") {
      this.db = location;
      return;
    }
    if (location !== ":memory:")
      mkdirSync(path.dirname(location), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(location);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;");
    this.db.exec(storageSchema);
    this.db.exec(authSchema("sqlite"));
    this.transaction(() => {
      for (const [table, column, definition] of storageColumns) {
        if (
          !this.db
            .prepare(`PRAGMA table_info(${table})`)
            .all()
            .some((row) => row.name === column)
        )
          this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      }
      this.db.exec("PRAGMA user_version=2;");
    });
    const insert = this.db.prepare(
      "INSERT OR IGNORE INTO problems (id,content,created_at) VALUES (?,?,?)",
    );
    this.transaction(() => {
      for (const problem of seedProblems)
        insert.run(problem.id, JSON.stringify(problem), problem.createdAt);
      while (true) {
        const rows = this.db
          .prepare(
            "SELECT content FROM problems p WHERE NOT EXISTS (SELECT 1 FROM problem_catalog c WHERE c.id=p.id) LIMIT 100",
          )
          .all();
        if (!rows.length) break;
        for (const row of rows) this.addCatalog(JSON.parse(String(row.content)));
      }
    });
  }
  private addCatalog(problem: Problem) {
    this.db
      .prepare(
        `INSERT INTO problem_catalog (${catalogColumns}) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
      )
      .run(...catalogValues(problem));
  }
  private transaction<T>(fn: () => T): T {
    if (this.inTransaction) return fn();
    this.db.exec("BEGIN IMMEDIATE");
    this.inTransaction = true;
    try {
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    } finally {
      this.inTransaction = false;
    }
  }
  problem(id: string): Problem | null {
    const row = this.db.prepare("SELECT content FROM problems WHERE id=?").get(id);
    return row ? JSON.parse(row.content as string) : null;
  }
  problems() {
    return this.db
      .prepare("SELECT content FROM problems ORDER BY created_at DESC")
      .all()
      .map((row) => JSON.parse(row.content as string) as Problem);
  }
  summaries(): ProblemSummary[] {
    return this.db
      .prepare(
        "SELECT json_remove(content,'$.solution','$.hints','$.explanation','$.scenario','$.requirements','$.starterCode','$.examples') AS summary, json_array_length(content,'$.hints') AS hint_count FROM problems ORDER BY created_at DESC",
      )
      .all()
      .map((row) => ({ ...JSON.parse(String(row.summary)), hintCount: Number(row.hint_count) }));
  }
  addProblem(problem: Problem) {
    this.transaction(() => {
      this.db
        .prepare("INSERT INTO problems (id,content,created_at) VALUES (?,?,?)")
        .run(problem.id, JSON.stringify(problem), problem.createdAt);
      this.addCatalog(problem);
    });
  }
  progressFor(owner: string, id: string): Progress | null {
    const row = this.db
      .prepare("SELECT * FROM progress WHERE owner=? AND problem_id=?")
      .get(owner, id);
    return row ? toProgress(row) : null;
  }
  completeGeneration(problem: Problem, lease: JobLease) {
    this.transaction(() => {
      this.requireJob(lease, "generate");
      const reservation = this.db
        .prepare(
          "SELECT * FROM generation_usage WHERE request_id=? AND token=? AND state='pending'",
        )
        .get(lease.id, lease.token);
      if (!reservation) throw new StaleJob();
      this.addProblem(problem);
      this.finishJob(lease, problem.id);
      this.db
        .prepare("UPDATE generation_usage SET state='done' WHERE request_id=? AND token=?")
        .run(lease.id, lease.token);
    });
  }
  progress(owner: string): Record<string, Progress> {
    return Object.fromEntries(
      this.db
        .prepare("SELECT * FROM progress WHERE owner=?")
        .all(owner)
        .map((row) => [String(row.problem_id), toProgress(row)]),
    );
  }
  private ensureProgress(owner: string, id: string) {
    this.db
      .prepare("INSERT OR IGNORE INTO progress (owner,problem_id,updated_at) VALUES (?,?,?)")
      .run(owner, id, new Date().toISOString());
  }
  saveProgress(owner: string, id: string, patch: ProgressPatch) {
    return this.transaction(() => {
      this.ensureProgress(owner, id);
      const now = new Date().toISOString();
      const current = this.progressFor(owner, id)!;
      checkCodeRevision(current, patch);
      if (patch.code !== undefined && patch.code !== current.code)
        this.db
          .prepare(
            "UPDATE progress SET code=?,code_revision=code_revision+1,status=CASE WHEN status='solved' THEN status ELSE 'in-progress' END,updated_at=? WHERE owner=? AND problem_id=? AND code_revision=?",
          )
          .run(patch.code, now, owner, id, current.codeRevision);
      if (patch.bookmarked !== undefined)
        this.db
          .prepare("UPDATE progress SET bookmarked=?,updated_at=? WHERE owner=? AND problem_id=?")
          .run(Number(patch.bookmarked), now, owner, id);
      return this.progressFor(owner, id)!;
    });
  }
  reveal(owner: string, problem: Problem, kind: "hint" | "solution") {
    return this.transaction(() => {
      this.ensureProgress(owner, problem.id);
      if (kind === "hint")
        this.db
          .prepare(
            "UPDATE progress SET hints_viewed=MIN(hints_viewed+1,?),updated_at=? WHERE owner=? AND problem_id=?",
          )
          .run(problem.hints.length, new Date().toISOString(), owner, problem.id);
      else
        this.db
          .prepare(
            "UPDATE progress SET solution_viewed=1,updated_at=? WHERE owner=? AND problem_id=?",
          )
          .run(new Date().toISOString(), owner, problem.id);
      return this.progressFor(owner, problem.id)!;
    });
  }
  attempts(owner: string, problemId?: string): Attempt[] {
    const rows = problemId
      ? this.db
          .prepare("SELECT * FROM attempts WHERE owner=? AND problem_id=? ORDER BY created_at DESC")
          .all(owner, problemId)
      : this.db.prepare("SELECT * FROM attempts WHERE owner=? ORDER BY created_at DESC").all(owner);
    return rows.map(toAttempt);
  }
  saveAttempt(owner: string, id: string, code: string, review: Review, lease?: JobLease): Attempt {
    return this.transaction(() => {
      if (lease) this.requireJob(lease, `review:${id}`, owner);
      this.ensureProgress(owner, id);
      const p = this.progressFor(owner, id)!;
      const attempt = createAttempt(id, code, review, p);
      // Assistance is server-owned; editing or restoring a draft cannot erase it.
      attempt.assisted ||= Boolean(
        this.db
          .prepare("SELECT 1 FROM jobs WHERE owner=? AND kind=? AND state='done' LIMIT 1")
          .get(owner, `coach:${id}`),
      );
      this.db
        .prepare("INSERT INTO attempts VALUES (?,?,?,?,?,?,?)")
        .run(
          attempt.id,
          owner,
          id,
          code,
          JSON.stringify(review),
          Number(attempt.assisted),
          attempt.createdAt,
        );
      // Drafts may have changed while the AI was reviewing. Never replace the current draft here.
      this.db
        .prepare(
          "UPDATE progress SET status=CASE WHEN status='solved' OR ?=1 THEN 'solved' ELSE 'in-progress' END,updated_at=? WHERE owner=? AND problem_id=?",
        )
        .run(Number(review.passed), attempt.createdAt, owner, id);
      if (lease) this.finishJob(lease, attempt.id);
      return attempt;
    });
  }
  consumeLimits(entries: UsageLimit[], now = Date.now()) {
    validateLimits(entries);
    return this.transaction(() => {
      this.db.prepare("DELETE FROM limits WHERE expires<=?").run(now);
      for (const entry of entries) {
        const row = this.db.prepare("SELECT count FROM limits WHERE key=?").get(entry.key);
        if (Number(row?.count || 0) + (entry.cost ?? 1) > entry.max) return false;
      }
      for (const entry of entries)
        this.db
          .prepare(
            "INSERT INTO limits VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET count=count+excluded.count",
          )
          .run(entry.key, entry.cost ?? 1, now + entry.windowMs);
      return true;
    });
  }
  private requireJob(lease: JobLease, kind = lease.kind, owner = lease.owner) {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(lease.id);
    if (!ownsJob(row, lease) || lease.kind !== kind || lease.owner !== owner) throw new StaleJob();
    return row!;
  }
  reserveGeneration(lease: JobLease, now = Date.now()) {
    return this.transaction(() => {
      const job = this.requireJob(lease, "generate");
      const day = generationDay(now).key;
      const used = this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM generation_usage WHERE owner=? AND day=? AND request_id<>? AND (state='done' OR expires>?)",
        )
        .get(lease.owner, day, lease.id, now);
      if (Number(used?.count) >= generationAllowance(lease.owner)) return false;
      this.db
        .prepare(
          "INSERT INTO generation_usage(request_id,owner,day,state,expires,token) VALUES (?,?,?,'pending',?,?) ON CONFLICT(request_id) DO UPDATE SET day=excluded.day,state='pending',expires=excluded.expires,token=excluded.token",
        )
        .run(lease.id, lease.owner, day, Number(job.expires), lease.token);
      return true;
    });
  }
  startJob(owner: string, id: string, kind: string, fingerprint: string): JobClaim {
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      const existing = existingClaim(row, owner, kind, fingerprint);
      if (existing) return existing;
      const lease = { id, owner, kind, token: randomUUID() };
      this.db
        .prepare(
          "INSERT INTO jobs(id,owner,kind,state,result,expires,token,fingerprint) VALUES (?,?,?,'pending',NULL,?,?,?) ON CONFLICT(id) DO UPDATE SET state='pending',result=NULL,expires=excluded.expires,token=excluded.token",
        )
        .run(id, owner, kind, Date.now() + GENERATION_LEASE_MS, lease.token, fingerprint);
      return { state: "new", lease };
    });
  }
  completeCoaching(lease: JobLease, problemId: string, result: string) {
    return this.transaction(() => {
      this.requireJob(lease, `coach:${problemId}`);
      this.finishJob(lease, result);
    });
  }
  private finishJob(lease: JobLease, result: string) {
    this.requireJob(lease);
    this.db
      .prepare("UPDATE jobs SET state='done',result=? WHERE id=? AND token=?")
      .run(result, lease.id, lease.token);
  }
  failJob(lease: JobLease) {
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(lease.id);
      if (!ownsJob(row, lease)) return false;
      this.db
        .prepare("DELETE FROM generation_usage WHERE request_id=? AND token=? AND state='pending'")
        .run(lease.id, lease.token);
      // Retain input identity after failure; only the same payload may retry this ID.
      this.db
        .prepare("UPDATE jobs SET state='failed',expires=0 WHERE id=? AND token=?")
        .run(lease.id, lease.token);
      return true;
    });
  }
  exportBackup(owner: string) {
    return this.transaction(() =>
      buildBackup(
        backupReads.map((sql, i) => this.db.prepare(sql).all(...backupParameters(i, owner))),
      ),
    );
  }
  importBackup(owner: string, backup: Backup) {
    const extra = prepareBackup(backup);
    return this.transaction(() => {
      let problems = 0,
        attempts = 0;
      for (const problem of backup.problems) {
        if (!this.problem(problem.id)) {
          this.addProblem(problem);
          problems++;
        }
        this.db
          .prepare(
            "INSERT INTO restored_problems(owner,problem_id) VALUES (?,?) ON CONFLICT(owner,problem_id) DO NOTHING",
          )
          .run(owner, problem.id);
      }
      for (const p of Object.values(backup.progress)) {
        if (!this.problem(p.problemId)) throw new Error("Backup references an unknown problem");
        const existing = this.db
          .prepare("SELECT 1 FROM progress WHERE owner=? AND problem_id=?")
          .get(owner, p.problemId);
        if (!existing)
          this.db
            .prepare(
              "INSERT INTO progress(owner,problem_id,code,bookmarked,hints_viewed,solution_viewed,status,updated_at,code_revision) VALUES (?,?,?,?,?,?,?,?,?)",
            )
            .run(
              owner,
              p.problemId,
              p.code,
              Number(p.bookmarked),
              p.hintsViewed,
              Number(p.solutionViewed),
              p.status,
              p.updatedAt,
              p.code === null ? 0 : 1,
            );
      }
      for (const attempt of backup.attempts) {
        const problem = this.problem(attempt.problemId);
        if (!problem) throw new Error("Backup references an unknown problem");
        const review = validateReview(attempt.review, problem);
        if (this.db.prepare("SELECT 1 FROM attempts WHERE owner=? AND id=?").get(owner, attempt.id))
          continue;
        const id = importedAttemptId(owner, attempt.id);
        const result = this.db
          .prepare("INSERT OR IGNORE INTO attempts VALUES (?,?,?,?,?,?,?)")
          .run(
            id,
            owner,
            attempt.problemId,
            attempt.code,
            JSON.stringify(review),
            Number(attempt.assisted),
            attempt.createdAt,
          );
        attempts += Number(result.changes);
      }
      let learning = 0,
        projects = 0;
      for (const item of extra.learning) {
        learning += Number(
          this.db
            .prepare(
              "INSERT INTO learning_progress(owner,lesson_id,content,revision,updated_at) VALUES (?,?,?,1,?) ON CONFLICT(owner,lesson_id) DO NOTHING",
            )
            .run(owner, item.id, item.content, item.updatedAt).changes,
        );
      }
      for (const project of extra.projects) {
        const own = this.db
          .prepare("SELECT 1 FROM jobs WHERE id=? AND owner=?")
          .get(project.check.id, owner);
        const id = own ? project.check.id : restoredProjectId(owner, project.check.id);
        // Preserve an existing whole project, including a pending analysis or newer training.
        if (this.db.prepare("SELECT 1 FROM jobs WHERE id=?").get(id)) continue;
        for (const job of restoredProjectJobs(project, id)) {
          this.db
            .prepare(
              "INSERT INTO jobs(id,owner,kind,state,result,expires,token,fingerprint) VALUES (?,?,?,'done',?,?,'',?)",
            )
            .run(job.id, owner, job.kind, job.result, job.expires, job.fingerprint);
        }
        projects++;
      }
      if (backup.legacy) this.archiveLegacy(owner, backup.legacy);
      return { problems, attempts, learning, projects };
    });
  }
  archiveLegacy(owner: string, content: unknown) {
    this.db
      .prepare("INSERT OR IGNORE INTO legacy VALUES (?,?,?)")
      .run(owner, JSON.stringify(content), new Date().toISOString());
  }
  legacy(owner: string): unknown {
    const row = this.db.prepare("SELECT content FROM legacy WHERE owner=?").get(owner);
    return row ? JSON.parse(String(row.content)) : null;
  }
}
const globalStore = globalThis as typeof globalThis & { recodeDatabase?: DatabaseSync };
export function getSqliteStore() {
  if (!globalStore.recodeDatabase) {
    const store = new SqliteStore(
      process.env.DATABASE_PATH || path.join(process.cwd(), "data", "recode.sqlite"),
    );
    globalStore.recodeDatabase = store.db;
    return store;
  }
  // Reuse the connection, not a stale class instance, when development modules reload.
  return new SqliteStore(globalStore.recodeDatabase);
}

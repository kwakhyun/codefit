import { StoreQueries } from "./store-queries";
import { authSchema } from "./auth-schema.mjs";
import { DAILY_GENERATIONS, GENERATION_LEASE_MS, generationDay } from "./generation-quota";
import { catalogColumns, catalogValues } from "./catalog-record";
import { validateLimits } from "./usage-policy";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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
import { storageSchema } from "./storage-schema.mjs";
import type { JobClaim, ProblemStore, ProgressPatch, UsageLimit } from "./store-contract";
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
    this.db.exec("PRAGMA user_version=1;");
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
  completeGeneration(problem: Problem, jobId: string) {
    this.transaction(() => {
      this.addProblem(problem);
      this.finishJob(jobId, problem.id);
      this.db.prepare("UPDATE generation_usage SET state='done' WHERE request_id=?").run(jobId);
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
      if (patch.code !== undefined)
        this.db
          .prepare(
            "UPDATE progress SET code=?,status=CASE WHEN status='solved' THEN status ELSE 'in-progress' END,updated_at=? WHERE owner=? AND problem_id=?",
          )
          .run(patch.code, now, owner, id);
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
  saveAttempt(owner: string, id: string, code: string, review: Review, jobId?: string): Attempt {
    return this.transaction(() => {
      this.ensureProgress(owner, id);
      const p = this.progressFor(owner, id)!;
      const attempt = createAttempt(id, code, review, p);
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
      if (jobId) this.finishJob(jobId, attempt.id);
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
  reserveGeneration(owner: string, requestId: string, now = Date.now()) {
    return this.transaction(() => {
      const existing = this.db
        .prepare("SELECT * FROM generation_usage WHERE request_id=?")
        .get(requestId);
      if (existing && existing.owner !== owner) return false;
      if (existing && (existing.state === "done" || Number(existing.expires) > now)) return true;
      const day = generationDay(now).key;
      const used = this.db
        .prepare(
          "SELECT COUNT(*) AS count FROM generation_usage WHERE owner=? AND day=? AND (state='done' OR expires>?)",
        )
        .get(owner, day, now);
      if (Number(used?.count) >= DAILY_GENERATIONS) return false;
      this.db
        .prepare(
          "INSERT INTO generation_usage VALUES (?,?,?,'pending',?) ON CONFLICT(request_id) DO UPDATE SET day=excluded.day,state='pending',expires=excluded.expires",
        )
        .run(requestId, owner, day, now + GENERATION_LEASE_MS);
      return true;
    });
  }
  startJob(owner: string, id: string, kind: string): JobClaim {
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (row && (row.owner !== owner || row.kind !== kind)) return { state: "pending" };
      if (row?.state === "done") return { state: "done", result: String(row.result) };
      if (row && Number(row.expires) > Date.now()) return { state: "pending" };
      this.db
        .prepare(
          "INSERT INTO jobs VALUES (?,?,?,'pending',NULL,?) ON CONFLICT(id) DO UPDATE SET state='pending',result=NULL,expires=excluded.expires",
        )
        .run(id, owner, kind, Date.now() + 150_000);
      return { state: "new" };
    });
  }
  finishJob(id: string, result: string) {
    this.db.prepare("UPDATE jobs SET state='done',result=? WHERE id=?").run(result, id);
  }
  failJob(id: string) {
    this.transaction(() => {
      this.db
        .prepare("DELETE FROM generation_usage WHERE request_id=? AND state='pending'")
        .run(id);
      this.db.prepare("DELETE FROM jobs WHERE id=? AND state='pending'").run(id);
    });
  }
  importBackup(owner: string, backup: Backup) {
    return this.transaction(() => {
      let problems = 0,
        attempts = 0;
      for (const problem of backup.problems) {
        if (!this.problem(problem.id)) {
          this.addProblem(problem);
          problems++;
        }
      }
      for (const p of Object.values(backup.progress)) {
        if (!this.problem(p.problemId)) throw new Error("Backup references an unknown problem");
        const existing = this.db
          .prepare("SELECT 1 FROM progress WHERE owner=? AND problem_id=?")
          .get(owner, p.problemId);
        if (!existing)
          this.db
            .prepare("INSERT INTO progress VALUES (?,?,?,?,?,?,?,?)")
            .run(
              owner,
              p.problemId,
              p.code,
              Number(p.bookmarked),
              p.hintsViewed,
              Number(p.solutionViewed),
              p.status,
              p.updatedAt,
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
      if (backup.legacy) this.archiveLegacy(owner, backup.legacy);
      return { problems, attempts };
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

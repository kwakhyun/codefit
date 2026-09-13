import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { seedProblems } from "../../data/problems";
import { publicProblem, validateReview, type Problem, type Progress, type Attempt, type Review, type ProblemSummary } from "../problem";
import type { Backup } from "../backup";

export class Store {
  readonly db: DatabaseSync;
  constructor(location: string | DatabaseSync) {
    if (typeof location !== "string") { this.db = location; return; }
    if (location !== ":memory:") mkdirSync(path.dirname(location), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(location);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS problems (id TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS progress (owner TEXT NOT NULL, problem_id TEXT NOT NULL REFERENCES problems(id), code TEXT, bookmarked INTEGER NOT NULL DEFAULT 0, hints_viewed INTEGER NOT NULL DEFAULT 0, solution_viewed INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'new', updated_at TEXT NOT NULL, PRIMARY KEY(owner, problem_id));
      CREATE TABLE IF NOT EXISTS attempts (id TEXT PRIMARY KEY, owner TEXT NOT NULL, problem_id TEXT NOT NULL REFERENCES problems(id), code TEXT NOT NULL, review TEXT NOT NULL, assisted INTEGER NOT NULL, created_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS attempts_owner_date ON attempts(owner, created_at DESC);
      CREATE TABLE IF NOT EXISTS limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner TEXT NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL, result TEXT, expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS legacy (owner TEXT PRIMARY KEY, content TEXT NOT NULL, created_at TEXT NOT NULL);
      PRAGMA user_version=1;`);
    const insert = this.db.prepare("INSERT OR IGNORE INTO problems (id,content,created_at) VALUES (?,?,?)");
    this.transaction(() => { for (const problem of seedProblems) insert.run(problem.id, JSON.stringify(problem), problem.createdAt); });
  }
  transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE");
    try { const result = fn(); this.db.exec("COMMIT"); return result; }
    catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  problem(id: string): Problem | null {
    const row = this.db.prepare("SELECT content FROM problems WHERE id=?").get(id);
    return row ? JSON.parse(row.content as string) : null;
  }
  problems() {
    return this.db.prepare("SELECT content FROM problems ORDER BY created_at DESC").all().map(row => publicProblem(JSON.parse(row.content as string)));
  }
  summaries(): ProblemSummary[] {
    return this.db.prepare("SELECT json_remove(content,'$.solution','$.hints','$.explanation','$.scenario','$.requirements','$.starterCode','$.examples') AS summary, json_array_length(content,'$.hints') AS hint_count FROM problems ORDER BY created_at DESC").all().map(row => ({ ...JSON.parse(String(row.summary)), hintCount: Number(row.hint_count) }));
  }
  addProblem(problem: Problem) {
    this.db.prepare("INSERT INTO problems (id,content,created_at) VALUES (?,?,?)").run(problem.id, JSON.stringify(problem), problem.createdAt);
  }
  completeGeneration(problem: Problem, jobId: string) {
    this.transaction(() => { this.addProblem(problem); this.finishJob(jobId, problem.id); });
  }
  progress(owner: string): Record<string, Progress> {
    return Object.fromEntries(this.db.prepare("SELECT * FROM progress WHERE owner=?").all(owner).map(row => [row.problem_id, {
      problemId: row.problem_id, code: row.code, bookmarked: Boolean(row.bookmarked), hintsViewed: Number(row.hints_viewed),
      solutionViewed: Boolean(row.solution_viewed), status: row.status, updatedAt: row.updated_at,
    }])) as Record<string, Progress>;
  }
  ensureProgress(owner: string, id: string) {
    this.db.prepare("INSERT OR IGNORE INTO progress (owner,problem_id,updated_at) VALUES (?,?,?)").run(owner, id, new Date().toISOString());
  }
  saveProgress(owner: string, id: string, patch: { code?: string; bookmarked?: boolean }) {
    return this.transaction(() => {
      this.ensureProgress(owner, id);
      const now = new Date().toISOString();
      if (patch.code !== undefined) this.db.prepare("UPDATE progress SET code=?,status=CASE WHEN status='solved' THEN status ELSE 'in-progress' END,updated_at=? WHERE owner=? AND problem_id=?").run(patch.code, now, owner, id);
      if (patch.bookmarked !== undefined) this.db.prepare("UPDATE progress SET bookmarked=?,updated_at=? WHERE owner=? AND problem_id=?").run(Number(patch.bookmarked), now, owner, id);
      return this.progress(owner)[id];
    });
  }
  reveal(owner: string, problem: Problem, kind: "hint" | "solution") {
    return this.transaction(() => {
      this.ensureProgress(owner, problem.id);
      if (kind === "hint") this.db.prepare("UPDATE progress SET hints_viewed=MIN(hints_viewed+1,?),updated_at=? WHERE owner=? AND problem_id=?").run(problem.hints.length, new Date().toISOString(), owner, problem.id);
      else this.db.prepare("UPDATE progress SET solution_viewed=1,updated_at=? WHERE owner=? AND problem_id=?").run(new Date().toISOString(), owner, problem.id);
      return this.progress(owner)[problem.id];
    });
  }
  attempts(owner: string, problemId?: string): Attempt[] {
    const rows = problemId
      ? this.db.prepare("SELECT * FROM attempts WHERE owner=? AND problem_id=? ORDER BY created_at DESC").all(owner, problemId)
      : this.db.prepare("SELECT * FROM attempts WHERE owner=? ORDER BY created_at DESC").all(owner);
    return rows.map(row => ({ id: String(row.id), problemId: String(row.problem_id), code: String(row.code), review: JSON.parse(String(row.review)), assisted: Boolean(row.assisted), createdAt: String(row.created_at) }));
  }
  saveAttempt(owner: string, id: string, code: string, review: Review, jobId?: string): Attempt {
    return this.transaction(() => {
      this.ensureProgress(owner, id);
      const p = this.progress(owner)[id];
      const attempt: Attempt = { id: randomUUID(), problemId: id, code, review, assisted: p.solutionViewed || p.hintsViewed > 0, createdAt: new Date().toISOString() };
      this.db.prepare("INSERT INTO attempts VALUES (?,?,?,?,?,?,?)").run(attempt.id, owner, id, code, JSON.stringify(review), Number(attempt.assisted), attempt.createdAt);
      // Drafts may have changed while the AI was reviewing. Never replace the current draft here.
      this.db.prepare("UPDATE progress SET status=CASE WHEN status='solved' OR ?=1 THEN 'solved' ELSE 'in-progress' END,updated_at=? WHERE owner=? AND problem_id=?").run(Number(review.passed), attempt.createdAt, owner, id);
      if (jobId) this.finishJob(jobId, attempt.id);
      return attempt;
    });
  }
  consumeLimits(entries: { key: string; max: number; windowMs: number }[], now = Date.now()) {
    return this.transaction(() => {
      this.db.prepare("DELETE FROM limits WHERE expires<=?").run(now);
      for (const entry of entries) {
        const row = this.db.prepare("SELECT count FROM limits WHERE key=?").get(entry.key);
        if (row && Number(row.count) >= entry.max) return false;
      }
      for (const entry of entries) this.db.prepare("INSERT INTO limits VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1").run(entry.key, now + entry.windowMs);
      return true;
    });
  }
  startJob(owner: string, id: string, kind: string): { state: "new" | "pending" | "done"; result?: string } {
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM jobs WHERE id=?").get(id);
      if (row && (row.owner !== owner || row.kind !== kind)) return { state: "pending" };
      if (row?.state === "done") return { state: "done", result: String(row.result) };
      if (row && Number(row.expires) > Date.now()) return { state: "pending" };
      this.db.prepare("INSERT INTO jobs VALUES (?,?,?,'pending',NULL,?) ON CONFLICT(id) DO UPDATE SET state='pending',result=NULL,expires=excluded.expires").run(id, owner, kind, Date.now() + 150_000);
      return { state: "new" };
    });
  }
  finishJob(id: string, result: string) { this.db.prepare("UPDATE jobs SET state='done',result=? WHERE id=?").run(result, id); }
  failJob(id: string) { this.db.prepare("DELETE FROM jobs WHERE id=? AND state='pending'").run(id); }
  importBackup(owner: string, backup: Backup) {
    return this.transaction(() => {
      let problems = 0, attempts = 0;
      for (const problem of backup.problems) {
        if (!this.problem(problem.id)) { this.addProblem(problem); problems++; }
      }
      for (const p of Object.values(backup.progress)) {
        if (!this.problem(p.problemId)) throw new Error("Backup references an unknown problem");
        const existing = this.db.prepare("SELECT 1 FROM progress WHERE owner=? AND problem_id=?").get(owner, p.problemId);
        if (!existing) this.db.prepare("INSERT INTO progress VALUES (?,?,?,?,?,?,?,?)").run(owner, p.problemId, p.code, Number(p.bookmarked), p.hintsViewed, Number(p.solutionViewed), p.status, p.updatedAt);
      }
      for (const attempt of backup.attempts) {
        const problem = this.problem(attempt.problemId);
        if (!problem) throw new Error("Backup references an unknown problem");
        const review = validateReview(attempt.review, problem);
        if (this.db.prepare("SELECT 1 FROM attempts WHERE owner=? AND id=?").get(owner, attempt.id)) continue;
        const id = createHash("sha256").update(`${owner}:import:${attempt.id}`).digest("hex");
        const result = this.db.prepare("INSERT OR IGNORE INTO attempts VALUES (?,?,?,?,?,?,?)").run(id, owner, attempt.problemId, attempt.code, JSON.stringify(review), Number(attempt.assisted), attempt.createdAt);
        attempts += Number(result.changes);
      }
      if (backup.legacy) this.archiveLegacy(owner, backup.legacy);
      return { problems, attempts };
    });
  }
  archiveLegacy(owner: string, content: unknown) {
    this.db.prepare("INSERT OR IGNORE INTO legacy VALUES (?,?,?)").run(owner, JSON.stringify(content), new Date().toISOString());
  }
  legacy(owner: string): unknown {
    const row = this.db.prepare("SELECT content FROM legacy WHERE owner=?").get(owner);
    return row ? JSON.parse(String(row.content)) : null;
  }
}
const globalStore = globalThis as typeof globalThis & { recodeDatabase?: DatabaseSync };
export function getStore() {
  if (!globalStore.recodeDatabase) {
    const store = new Store(process.env.DATABASE_PATH || path.join(process.cwd(), "data", "recode.sqlite"));
    globalStore.recodeDatabase = store.db;
    return store;
  }
  // Reuse the connection, not a stale class instance, when development modules reload.
  return new Store(globalStore.recodeDatabase);
}

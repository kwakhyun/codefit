import type { StoreQueries } from "./store-queries";
import type { Backup, BackupImportResult } from "../backup";
import type { Attempt, Problem, ProblemSummary, Progress, Review } from "../problem";

type Stored<T> = T | Promise<T>;
export type ProgressPatch = { code?: string; baseRevision?: number; bookmarked?: boolean };
export type UsageLimit = { key: string; max: number; windowMs: number; cost?: number };
export type JobLease = { id: string; owner: string; kind: string; token: string };
export type JobClaim =
  { state: "new"; lease: JobLease } | { state: "pending" } | { state: "done"; result: string };

/** The API uses the same operations with local SQLite and hosted PostgreSQL. */
export interface ProblemStore {
  readonly queries: StoreQueries;
  progressFor(owner: string, id: string): Stored<Progress | null>;
  problem(id: string): Stored<Problem | null>;
  problems(): Stored<Problem[]>;
  summaries(): Stored<ProblemSummary[]>;
  completeGeneration(problem: Problem, lease: JobLease): Stored<void>;
  progress(owner: string): Stored<Record<string, Progress>>;
  saveProgress(owner: string, id: string, patch: ProgressPatch): Stored<Progress>;
  reveal(owner: string, problem: Problem, kind: "hint" | "solution"): Stored<Progress>;
  attempts(owner: string, problemId?: string): Stored<Attempt[]>;
  saveAttempt(
    owner: string,
    id: string,
    code: string,
    review: Review,
    lease?: JobLease,
  ): Stored<Attempt>;
  consumeLimits(entries: UsageLimit[], now?: number): Stored<boolean>;
  reserveGeneration(lease: JobLease, now?: number): Stored<boolean>;
  startJob(owner: string, id: string, kind: string, fingerprint: string): Stored<JobClaim>;
  failJob(lease: JobLease): Stored<boolean>;
  completeCoaching(lease: JobLease, problemId: string, result: string): Stored<void>;
  exportBackup(owner: string): Stored<Backup>;
  importBackup(owner: string, backup: Backup): Stored<BackupImportResult>;
  archiveLegacy(owner: string, content: unknown): Stored<void>;
  legacy(owner: string): Stored<unknown>;
}

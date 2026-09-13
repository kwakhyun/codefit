import type { StoreQueries } from "./store-queries";
import type { Backup } from "../backup";
import type { Attempt, Problem, ProblemSummary, Progress, Review } from "../problem";

type Stored<T> = T | Promise<T>;
export type ProgressPatch = { code?: string; bookmarked?: boolean };
export type UsageLimit = { key: string; max: number; windowMs: number; cost?: number };
export type JobClaim = { state: "new" | "pending" | "done"; result?: string };

/** The API uses the same operations with local SQLite and hosted PostgreSQL. */
export interface ProblemStore {
  readonly queries: StoreQueries;
  progressFor(owner: string, id: string): Stored<Progress | null>;
  problem(id: string): Stored<Problem | null>;
  problems(): Stored<Problem[]>;
  summaries(): Stored<ProblemSummary[]>;
  completeGeneration(problem: Problem, jobId: string): Stored<void>;
  progress(owner: string): Stored<Record<string, Progress>>;
  saveProgress(owner: string, id: string, patch: ProgressPatch): Stored<Progress>;
  reveal(owner: string, problem: Problem, kind: "hint" | "solution"): Stored<Progress>;
  attempts(owner: string, problemId?: string): Stored<Attempt[]>;
  saveAttempt(
    owner: string,
    id: string,
    code: string,
    review: Review,
    jobId?: string,
  ): Stored<Attempt>;
  consumeLimits(entries: UsageLimit[], now?: number): Stored<boolean>;
  reserveGeneration(owner: string, requestId: string, now?: number): Stored<boolean>;
  startJob(owner: string, id: string, kind: string): Stored<JobClaim>;
  failJob(id: string): Stored<void>;
  importBackup(owner: string, backup: Backup): Stored<{ problems: number; attempts: number }>;
  archiveLegacy(owner: string, content: unknown): Stored<void>;
  legacy(owner: string): Stored<unknown>;
}

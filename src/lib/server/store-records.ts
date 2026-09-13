import { createHash, randomUUID } from "node:crypto";
import type { Attempt, Progress, Review } from "../problem";

type Row = Record<string, unknown>;
export function toProgress(row: Row): Progress {
  return {
    problemId: String(row.problem_id),
    code: row.code == null ? null : String(row.code),
    bookmarked: Boolean(row.bookmarked),
    hintsViewed: Number(row.hints_viewed),
    solutionViewed: Boolean(row.solution_viewed),
    status: row.status as Progress["status"],
    updatedAt: String(row.updated_at),
  };
}
export function toAttempt(row: Row): Attempt {
  return {
    id: String(row.id),
    problemId: String(row.problem_id),
    code: String(row.code),
    review: JSON.parse(String(row.review)),
    assisted: Boolean(row.assisted),
    createdAt: String(row.created_at),
  };
}
export function importedAttemptId(owner: string, id: string) {
  return createHash("sha256").update(`${owner}:import:${id}`).digest("hex");
}
export function createAttempt(
  problemId: string,
  code: string,
  review: Review,
  progress: Progress,
): Attempt {
  return {
    id: randomUUID(),
    problemId,
    code,
    review,
    assisted: progress.solutionViewed || progress.hintsViewed > 0,
    createdAt: new Date().toISOString(),
  };
}

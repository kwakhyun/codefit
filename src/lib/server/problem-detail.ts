import { publicProblem, type ProblemDetail } from "../problem";
import { HttpError } from "./http";
import type { ProblemStore } from "./store-contract";

export async function problemDetail(
  store: ProblemStore,
  owner: string,
  id: string,
  attempt?: string | null,
): Promise<ProblemDetail> {
  const [problem, progress, attempts] = await Promise.all([
    store.problem(id),
    store.progressFor(owner, id),
    store.queries.recentAttempts(owner, id, attempt),
  ]);
  if (!problem) throw new HttpError(404, "문제를 찾을 수 없습니다.");
  return {
    problem: publicProblem(problem),
    progress,
    attempts,
    hints: problem.hints.slice(0, progress?.hintsViewed || 0),
    solution: progress?.solutionViewed
      ? { code: problem.solution, explanation: problem.explanation }
      : null,
  };
}

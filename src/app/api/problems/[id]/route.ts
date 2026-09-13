import { publicProblem } from "@/lib/problem";
import { session, json, failure, requireProblem } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    const problem = await requireProblem(id);
    const progress = (await (await getStore()).progress(owner))[id];
    return json({ problem: publicProblem(problem), progress: progress || null, hints: problem.hints.slice(0, progress?.hintsViewed || 0), solution: progress?.solutionViewed ? { code: problem.solution, explanation: problem.explanation } : null, attempts: await (await getStore()).attempts(owner, id) });
  } catch (error) { return failure(error); }
}

import { z } from "zod";
import { session, json, failure, requireProblem, readBody } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    const { kind } = await readBody(request, z.object({ kind: z.enum(["hint", "solution"]) }), 1000);
    const problem = await requireProblem(id);
    const progress = await (await getStore()).reveal(owner, problem, kind);
    return json({ progress, hints: problem.hints.slice(0, progress.hintsViewed), solution: progress.solutionViewed ? { code: problem.solution, explanation: problem.explanation } : null });
  } catch (error) { return failure(error); }
}

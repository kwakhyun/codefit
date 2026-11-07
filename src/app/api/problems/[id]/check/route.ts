import { getStore } from "@/lib/server/database";
import { problemCheckError } from "@/lib/example-tests";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { requireProblem } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";

const input = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("tests"), passed: z.number().int().min(0), total: z.number().int() }),
  z.object({ kind: z.literal("self") }),
]);

/** Records "예시 테스트 통과" or "직접 확인함". Neither changes the AI-reviewed "solved" status.
 * The test result is reported by the learner's browser, so it is labelled as such everywhere. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    const body = await readBody(request, input, 1000);
    const problem = await requireProblem(id, owner);
    const record = {
      kind: body.kind,
      passed: body.kind === "tests" ? body.passed : 0,
      total: body.kind === "tests" ? body.total : 0,
    };
    const error = problemCheckError(problem, record);
    if (error) throw new HttpError(400, error);
    const check = await (await getStore()).queries.saveProblemCheck(owner, id, record);
    return json({ check });
  } catch (error) {
    return failure(error);
  }
}

/** Withdraws a self-check. A recorded example-test pass is kept. */
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    await requireProblem(id, owner);
    const queries = (await getStore()).queries;
    await queries.clearSelfCheck(owner, id);
    return json({ check: await queries.problemCheck(owner, id) });
  } catch (error) {
    return failure(error);
  }
}

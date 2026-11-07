import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";

const problemId = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/);

/** Hides a public AI-generated problem from the caller's own list. Others still see it. */
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const body = await readBody(request, z.object({ problemId }).strict(), 1000);
    await (await getStore()).queries.hideProblem(owner, body.problemId);
    return json({ hidden: true });
  } catch (error) {
    return failure(error);
  }
}

/** Shows one hidden problem again (undo), or every hidden problem without `problem`. */
export async function DELETE(request: Request) {
  try {
    const { owner } = await session(request);
    const value = new URL(request.url).searchParams.get("problem");
    if (value !== null && !problemId.safeParse(value).success)
      throw new HttpError(400, "문제 주소가 올바르지 않습니다.");
    await (await getStore()).queries.unhideProblems(owner, value ?? undefined);
    return json({ hidden: false });
  } catch (error) {
    return failure(error);
  }
}

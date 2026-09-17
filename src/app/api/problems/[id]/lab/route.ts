import { requireProblem } from "@/lib/server/problem-access";
import { learningLab } from "@/lib/server/learning-lab";
import { failure, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    await session(request);
    return json(learningLab(await requireProblem((await context.params).id)));
  } catch (error) {
    return failure(error);
  }
}

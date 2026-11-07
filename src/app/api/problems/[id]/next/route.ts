import { getStore } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";

/** Problems to continue with after a review: overall recommendation and same domain. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    return json(await (await getStore()).queries.nextProblems(owner, id));
  } catch (error) {
    return failure(error);
  }
}

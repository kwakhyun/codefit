import { getStore } from "@/lib/server/database";
import { session } from "@/lib/server/session";
import { json, failure } from "@/lib/server/http";
import { handoffLearning } from "@/lib/handoff/learning";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner, scope } = await session(request);
    const store = await getStore();
    const [attempts, progress] = await Promise.all([
      store.queries.handoffAttempts(owner),
      store.queries.handoffProgress(owner),
    ]);
    const now = Date.now();
    return json({
      scope,
      learning: handoffLearning(attempts, now, progress),
      generatedAt: new Date(now).toISOString(),
    });
  } catch (error) {
    return failure(error);
  }
}

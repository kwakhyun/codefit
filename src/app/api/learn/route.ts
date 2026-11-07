import { isAiProgressRow } from "@/lib/server/ai-learning-progress";
import { getStore } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner, scope, user } = await session(request);
    const rows = await (await getStore()).queries.learning.all(owner);
    return json({
      scope,
      signedIn: !!user,
      aiReady: !!process.env.OPENAI_API_KEY,
      // AI lesson records are served by /api/learn/ai.
      progress: rows.filter((row) => !isAiProgressRow(row)),
    });
  } catch (e) {
    return failure(e);
  }
}

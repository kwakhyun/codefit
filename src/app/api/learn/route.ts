import { getStore } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner, scope, user } = await session(request);
    return json({
      scope,
      signedIn: !!user,
      aiReady: !!process.env.OPENAI_API_KEY,
      progress: await (await getStore()).queries.learning.all(owner),
    });
  } catch (e) {
    return failure(e);
  }
}

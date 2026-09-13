import { getStore } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
import { problemDetail } from "@/lib/server/problem-detail";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    return json(
      await problemDetail(
        await getStore(),
        owner,
        id,
        new URL(request.url).searchParams.get("attempt"),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

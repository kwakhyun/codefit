import { getStore } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    return json(
      await (
        await getStore()
      ).queries.history(owner, new URL(request.url).searchParams.get("cursor")),
    );
  } catch (error) {
    return failure(error);
  }
}

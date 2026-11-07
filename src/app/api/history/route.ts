import { getStore } from "@/lib/server/database";
import { failure, json } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    const params = new URL(request.url).searchParams;
    return json(
      await (
        await getStore()
      ).queries.history(
        owner,
        params.get("cursor"),
        params.get("filter") === "unsolved" ? "unsolved" : "all",
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

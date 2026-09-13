import { getStore } from "@/lib/server/database";
import { failure } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    const store = await getStore();
    const data = {
      version: 2,
      exportedAt: new Date().toISOString(),
      problems: await store.problems(),
      progress: await store.progress(owner),
      attempts: await store.attempts(owner),
      legacy: await store.legacy(owner),
    };
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="codefit-backup-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

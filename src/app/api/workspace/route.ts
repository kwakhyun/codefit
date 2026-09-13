import { z } from "zod";
import { session, json, failure, readBody } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    const store = await getStore();
    const legacy = await store.legacy(owner) as { generatedLessons?: unknown[] } | null;
    return json({ problems: await store.summaries(), progress: Object.fromEntries(Object.entries(await store.progress(owner)).map(([id, value]) => { const { code: _code, ...summary } = value; void _code; return [id, summary]; })), attempts: (await store.attempts(owner)).map(value => { const { code: _code, ...summary } = value; void _code; return summary; }), aiReady: Boolean(process.env.OPENAI_API_KEY), storage: "서버 저장소", legacyCount: legacy?.generatedLessons?.length || 0 });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const legacy = await readBody(request, z.object({ generatedLessons: z.array(z.unknown()).max(1000) }).passthrough(), 5_000_000);
    await (await getStore()).archiveLegacy(owner, legacy);
    return json({ saved: true });
  } catch (error) { return failure(error); }
}

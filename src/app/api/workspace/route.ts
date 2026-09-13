import { getStore } from "@/lib/server/database";
import { failure, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    const store = await getStore();
    const [legacyValue, problems, progress, attempts] = await Promise.all([
      store.legacy(owner),
      store.summaries(),
      store.progress(owner),
      store.attempts(owner),
    ]);
    const legacy = legacyValue as { generatedLessons?: unknown[] } | null;
    return json({
      problems,
      progress: Object.fromEntries(
        Object.entries(progress).map(([id, value]) => {
          const { code: _code, ...summary } = value;
          void _code;
          return [id, summary];
        }),
      ),
      attempts: attempts.map((value) => {
        const { code: _code, ...summary } = value;
        void _code;
        return summary;
      }),
      aiReady: Boolean(process.env.OPENAI_API_KEY),
      storage: "서버 저장소",
      legacyCount: legacy?.generatedLessons?.length || 0,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const legacy = await readBody(
      request,
      z.object({ generatedLessons: z.array(z.unknown()).max(1000) }).passthrough(),
      5_000_000,
    );
    await (await getStore()).archiveLegacy(owner, legacy);
    return json({ saved: true });
  } catch (error) {
    return failure(error);
  }
}

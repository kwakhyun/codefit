import { z } from "zod";
import { missionById } from "@/lib/learn/catalog";
import { learningSchema, validLearning } from "@/lib/learn/progress";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, c: Context) {
  try {
    const { owner, scope, user } = await session(request);
    const { id } = await c.params;
    if (!missionById(id)) throw new HttpError(404, "미션을 찾을 수 없습니다.");
    return json({
      scope,
      signedIn: !!user,
      aiReady: !!process.env.OPENAI_API_KEY,
      progress: await (await getStore()).queries.learning.get(owner, id),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request, c: Context) {
  try {
    const { owner } = await session(request);
    const { id } = await c.params;
    const mission = missionById(id);
    if (!mission) throw new HttpError(404, "미션을 찾을 수 없습니다.");
    const input = await readBody(
      request,
      z
        .object({
          code: z.string().max(30000),
          baseRevision: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
        })
        .strict(),
    );
    let record;
    try {
      record = learningSchema.parse(JSON.parse(input.code));
    } catch {
      throw new HttpError(400, "학습 기록 형식을 확인해 주세요.");
    }
    if (!validLearning(mission, record))
      throw new HttpError(400, "미션과 학습 기록이 일치하지 않습니다.");
    return json({
      progress: await (
        await getStore()
      ).queries.learning.save(owner, id, JSON.stringify(record), input.baseRevision),
    });
  } catch (e) {
    return failure(e);
  }
}

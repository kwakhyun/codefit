import { z } from "zod";
import { dialogueInputSchema } from "@/lib/project-check/dialogue";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { ProjectCheckService } from "@/lib/server/project-check-service";
import { networkIdentity } from "@/lib/server/usage-policy";
export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  try {
    const { owner } = await projectMember(request);
    const { id } = await context.params;
    const index = z.coerce
      .number()
      .int()
      .min(0)
      .max(4)
      .safeParse(new URL(request.url).searchParams.get("question"));
    if (!index.success) throw new HttpError(400, "확인할 질문을 선택해 주세요.");
    const store = await getStore();
    if (!(await store.queries.projectChecks.get(owner, id)))
      throw new HttpError(404, "점검 기록을 찾지 못했습니다.");
    return json(await store.queries.projectChecks.dialogue(owner, id, index.data));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { owner } = await projectMember(request);
    const { id } = await context.params;
    const input = await readBody(request, dialogueInputSchema, 8000);
    if (!process.env.OPENAI_API_KEY) throw new HttpError(503, "AI 연결을 준비 중입니다.");
    return json(
      await new ProjectCheckService(await getStore()).discuss(
        owner,
        networkIdentity(request),
        id,
        input,
        request.signal,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}

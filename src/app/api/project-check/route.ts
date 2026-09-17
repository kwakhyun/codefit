import { z } from "zod";
import { createCheckSchema, reviewCheckSchema, PROJECT_LIMITS } from "@/lib/project-check/types";
import { session } from "@/lib/server/session";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
import { networkIdentity } from "@/lib/server/usage-policy";
import { ProjectCheckService } from "@/lib/server/project-check-service";
export const runtime = "nodejs";
export const maxDuration = 90;
async function member(request: Request) {
  const current = await session(request);
  if (!current.user)
    throw new HttpError(401, "프로젝트 이해도 점검은 로그인 후 이용할 수 있습니다.");
  if (request.headers.get("x-codefit-workspace") !== current.scope)
    throw new HttpError(409, "계정 정보를 새로 확인한 뒤 다시 시도해 주세요.");
  return current;
}
export async function GET(request: Request) {
  try {
    const { owner, scope, user } = await session(request);
    const empty = (limit: number) => ({ limit, remaining: 0, resetsAt: null });
    if (!user)
      return json({
        scope,
        signedIn: false,
        aiReady: Boolean(process.env.OPENAI_API_KEY),
        usage: { analysis: empty(PROJECT_LIMITS.analysis), review: empty(PROJECT_LIMITS.review) },
        checks: [],
      });
    const store = await getStore();
    const [usage, checks] = await Promise.all([
      store.queries.projectChecks.usage(owner),
      store.queries.projectChecks.list(owner),
    ]);
    return json({
      scope,
      signedIn: true,
      aiReady: Boolean(process.env.OPENAI_API_KEY),
      usage,
      checks,
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { owner } = await member(request);
    const input = await readBody(request, createCheckSchema, 16_000);
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(503, "AI 연결을 준비 중입니다. 저장된 기록은 계속 볼 수 있습니다.");
    return json(
      await new ProjectCheckService(await getStore()).create(
        owner,
        networkIdentity(request),
        input,
        request.signal,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request) {
  try {
    const { owner } = await member(request);
    const input = await readBody(request, reviewCheckSchema, 32_000);
    if (!process.env.OPENAI_API_KEY)
      throw new HttpError(503, "AI 연결을 준비 중입니다. 작성한 답변은 이 탭에 보관됩니다.");
    return json(
      await new ProjectCheckService(await getStore()).review(
        owner,
        networkIdentity(request),
        input,
        request.signal,
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    const { owner } = await member(request);
    const { id } = await readBody(request, z.object({ id: z.uuid() }).strict(), 500);
    await (await getStore()).queries.projectChecks.remove(owner, id);
    return json({ removed: true });
  } catch (error) {
    return failure(error);
  }
}

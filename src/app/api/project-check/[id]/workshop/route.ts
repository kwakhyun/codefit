import { z } from "zod";
import { workshopSaveSchema } from "@/lib/ai-learning/project-workshop";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { ProjectCheckService } from "@/lib/server/project-check-service";
import { networkIdentity } from "@/lib/server/usage-policy";
export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };
async function contextFor(request: Request, context: Context) {
  const { owner } = await projectMember(request);
  const { id } = await context.params;
  const store = await getStore();
  if (!(await store.queries.projectChecks.get(owner, id)))
    throw new HttpError(404, "점검 기록을 찾지 못했습니다.");
  return { owner, id, store };
}
export async function GET(request: Request, context: Context) {
  try {
    const { owner, id, store } = await contextFor(request, context);
    return json(await store.queries.projectChecks.workshop(owner, id));
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { owner, id, store } = await contextFor(request, context);
    const input = await readBody(
      request,
      z.object({ consent: z.boolean().optional(), stepwise: z.boolean().optional() }).strict(),
      1000,
    );
    // Saved exercises stay available even if the AI provider is temporarily offline.
    const saved = await store.queries.projectChecks.workshop(owner, id);
    if (saved) return json(input.stepwise ? { status: "done", result: saved } : saved);
    if (!process.env.OPENAI_API_KEY) throw new HttpError(503, "AI 연결을 준비 중입니다.");
    if (input.stepwise)
      return json(
        await new ProjectCheckService(store).advanceLearning(
          owner,
          networkIdentity(request),
          id,
          "workshop",
          AbortSignal.timeout(105_000),
        ),
      );
    return json(
      await new ProjectCheckService(store).generateWorkshop(
        owner,
        networkIdentity(request),
        id,
        AbortSignal.timeout(105_000),
      ),
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { owner, id, store } = await contextFor(request, context);
    const input = await readBody(request, workshopSaveSchema, 32000);
    return json(await store.queries.projectChecks.saveWorkshop(owner, id, input));
  } catch (error) {
    return failure(error);
  }
}

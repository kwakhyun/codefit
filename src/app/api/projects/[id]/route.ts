import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { classEditSchema } from "@/lib/project-check/project-class";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function contextFor(request: Request, context: Context) {
  const { owner, scope } = await projectMember(request);
  const parsed = z.uuid().safeParse((await context.params).id);
  if (!parsed.success) throw new HttpError(400, "프로젝트 주소가 올바르지 않습니다.");
  const id = parsed.data;
  const store = await getStore();
  const check = await store.queries.projectChecks.detail(owner, id);
  if (!check) throw new HttpError(404, "이 계정의 프로젝트를 찾지 못했습니다.");
  return { owner, scope, id, check, q: store.queries.projectChecks };
}
export async function GET(request: Request, context: Context) {
  try {
    const { owner, id, check, q } = await contextFor(request, context);
    const [practice, workshop] = await Promise.all([
      q.generatedPractice(owner, id),
      q.workshop(owner, id),
    ]);
    return json({ check, practice, workshop });
  } catch (e) {
    return failure(e);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { owner, id, q } = await contextFor(request, context);
    return json(await q.editClass(owner, id, await readBody(request, classEditSchema, 12000)));
  } catch (e) {
    return failure(e);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const { owner, id, q } = await contextFor(request, context);
    await q.remove(owner, id);
    return json({ removed: true });
  } catch (e) {
    return failure(e);
  }
}

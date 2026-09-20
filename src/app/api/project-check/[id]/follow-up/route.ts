import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { ProjectCheckService } from "@/lib/server/project-check-service";
import { practiceSchema } from "@/lib/project-check/types";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const { owner } = await projectMember(request);
    const id = (await context.params).id;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "점검 기록 주소가 올바르지 않습니다.");
    const { requestId } = await readBody(request, z.object({ requestId: z.uuid() }).strict(), 500);
    return json(await new ProjectCheckService(await getStore()).revise(owner, id, requestId));
  } catch (error) {
    return failure(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const { owner } = await projectMember(request);
    const id = (await context.params).id;
    if (!z.uuid().safeParse(id).success)
      throw new HttpError(400, "점검 기록 주소가 올바르지 않습니다.");
    const input = await readBody(request, practiceSchema, 80_000);
    return json(await (await getStore()).queries.projectChecks.savePractice(owner, id, input));
  } catch (error) {
    return failure(error);
  }
}

import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().safeParse((await context.params).id);
    if (!id.success) throw new HttpError(400, "점검 기록 주소가 올바르지 않습니다.");
    const check = await (await getStore()).queries.projectChecks.detail(owner, id.data);
    if (!check)
      throw new HttpError(
        404,
        "이 계정에서 점검 기록을 찾을 수 없습니다. 삭제된 기록이거나 다른 계정의 링크일 수 있습니다.",
      );
    return json(check);
  } catch (error) {
    return failure(error);
  }
}

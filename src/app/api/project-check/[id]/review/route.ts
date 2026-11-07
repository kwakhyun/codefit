import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json } from "@/lib/server/http";
export const runtime = "nodejs";
/** Status of the background answer evaluation; never calls AI or uses an allowance. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().safeParse((await context.params).id);
    if (!id.success) throw new HttpError(400, "점검 기록 주소가 올바르지 않습니다.");
    const status = await (await getStore()).queries.projectChecks.reviewStatus(owner, id.data);
    if (!status) throw new HttpError(404, "이 분석에서 접수된 답변 평가를 찾지 못했습니다.");
    return json(status);
  } catch (error) {
    return failure(error);
  }
}

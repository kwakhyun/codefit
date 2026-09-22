import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json } from "@/lib/server/http";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().parse((await context.params).id);
    const status = await (await getStore()).queries.projectChecks.analysisStatus(owner, id);
    if (!status) throw new HttpError(404, "이 계정에서 분석 요청을 찾지 못했습니다.");
    return json(status);
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().parse((await context.params).id);
    return json(await (await getStore()).queries.projectChecks.cancelAnalysis(owner, id));
  } catch (error) {
    return failure(error);
  }
}

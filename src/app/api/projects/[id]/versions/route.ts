import { z } from "zod";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().parse((await context.params).id);
    const q = (await getStore()).queries.projectChecks;
    const check = await q.get(owner, id);
    if (!check) throw new HttpError(404, "프로젝트를 찾지 못했습니다.");
    if (!check.page.repository) return json({ checks: [], nextCursor: null });
    return json(
      await q.summaryPage(owner, new URL(request.url).searchParams.get("cursor"), check.page.url),
    );
  } catch (error) {
    return failure(error);
  }
}

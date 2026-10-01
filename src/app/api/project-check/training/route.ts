import { z } from "zod";
import { trainingInput } from "@/lib/project-learning/types";
import { projectMember } from "@/lib/server/project-member";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const { owner } = await projectMember(request);
    const id = z.uuid().safeParse(new URL(request.url).searchParams.get("id"));
    if (!id.success) throw new HttpError(400, "프로젝트 기록 주소를 확인해 주세요.");
    const store = await getStore();
    // Revisions continue the training of their root analysis.
    const root = await store.queries.projectChecks.rootId(owner, id.data);
    return json(await store.queries.projectLearning.get(owner, root ?? id.data));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const { owner } = await projectMember(request);
    const input = await readBody(request, trainingInput, 2000);
    const store = await getStore();
    const root = await store.queries.projectChecks.rootId(owner, input.id);
    return json(
      await store.queries.projectLearning.submit(owner, { ...input, id: root ?? input.id }),
    );
  } catch (e) {
    return failure(e);
  }
}

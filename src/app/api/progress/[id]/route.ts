import { z } from "zod";
import { session, json, failure, requireProblem, readBody } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    await requireProblem(id);
    const patch = await readBody(request, z.object({ code: z.string().max(30000).optional(), bookmarked: z.boolean().optional() }).strict());
    return json({ progress: await (await getStore()).saveProgress(owner, id, patch) });
  } catch (error) { return failure(error); }
}

import { getStore } from "@/lib/server/database";
import { failure, json, readBody } from "@/lib/server/http";
import { requireProblem } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    await requireProblem(id);
    const patch = await readBody(
      request,
      z
        .object({ code: z.string().max(30000).optional(), bookmarked: z.boolean().optional() })
        .strict(),
    );
    return json({ progress: await (await getStore()).saveProgress(owner, id, patch) });
  } catch (error) {
    return failure(error);
  }
}

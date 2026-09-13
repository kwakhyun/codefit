import { reviewCode } from "@/lib/server/ai";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { aiLimit, requireProblem } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let jobId: string | undefined;
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    const problem = await requireProblem(id);
    const input = await readBody(
      request,
      z.object({ code: z.string().trim().min(5).max(30000), requestId: z.uuid() }),
    );
    const store = await getStore();
    const job = await store.startJob(owner, input.requestId, `review:${id}`);
    if (job.state === "done")
      return json({
        attempt: (await store.queries.recentAttempts(owner, id, job.result)).find(
          (a) => a.id === job.result,
        ),
        progress: await store.progressFor(owner, id),
      });
    if (job.state === "pending")
      throw new HttpError(409, "이 풀이를 검토하고 있습니다. 잠시 후 기록을 확인해 주세요.");
    jobId = input.requestId;
    await aiLimit(request, owner, "review");
    const review = await reviewCode(problem, input.code, (run) =>
      store.queries.recordAiRun(owner, run),
    );
    const attempt = await store.saveAttempt(owner, id, input.code, review, input.requestId);
    return json({ attempt, progress: await store.progressFor(owner, id) });
  } catch (error) {
    if (jobId) {
      try {
        await (await getStore()).failJob(jobId);
      } catch {
        /* Preserve the original error; pending jobs expire. */
      }
    }
    return failure(error);
  }
}

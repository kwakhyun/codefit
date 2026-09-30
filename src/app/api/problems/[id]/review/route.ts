import { missingHandoffFields, readHandoffDraft, handoffMissingMessage } from "@/lib/handoff/draft";
import type { JobLease } from "@/lib/server/store-contract";
import { requestFingerprint } from "@/lib/server/write-conflicts";
import { reviewCode } from "@/lib/server/ai";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { aiLimit, requireProblem } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import { z } from "zod";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let lease: JobLease | undefined;
  let refund: (() => Promise<void>) | undefined;
  try {
    const { owner } = await session(request);
    const { id } = await context.params;
    const problem = await requireProblem(id, owner);
    const input = await readBody(
      request,
      // Store exactly the editor text so the attempt matches the current draft.
      z.object({
        code: z
          .string()
          .max(30000)
          .refine((code) => code.trim().length >= 5, "검토할 코드를 5자 이상 작성해 주세요."),
        requestId: z.uuid(),
      }),
    );
    if (problem.handoff) {
      const missing = missingHandoffFields(readHandoffDraft(input.code).notes);
      if (missing.length) throw new HttpError(400, handoffMissingMessage(missing));
    }
    const store = await getStore();
    const job = await store.startJob(
      owner,
      input.requestId,
      `review:${id}`,
      requestFingerprint(id, input.code),
    );
    if (job.state === "done")
      return json({
        attempt: (await store.queries.recentAttempts(owner, id, job.result)).find(
          (a) => a.id === job.result,
        ),
        progress: await store.progressFor(owner, id),
      });
    if (job.state === "pending")
      throw new HttpError(409, "이 풀이를 검토하고 있습니다. 잠시 후 기록을 확인해 주세요.");
    lease = job.lease;
    refund = await aiLimit(request, owner, "review");
    const review = await reviewCode(problem, input.code, (run) =>
      store.queries.recordAiRun(owner, run),
    );
    const attempt = await store.saveAttempt(owner, id, input.code, review, lease);
    refund = undefined;
    return json({ attempt, progress: await store.progressFor(owner, id) });
  } catch (error) {
    // A failed provider call or rejected model output does not use today's allowance.
    await refund?.();
    if (lease) {
      try {
        await (await getStore()).failJob(lease);
      } catch {
        /* Preserve the original error; pending jobs expire. */
      }
    }
    return failure(error);
  }
}

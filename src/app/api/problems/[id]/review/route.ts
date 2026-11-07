import { missingHandoffFields, readHandoffDraft, handoffMissingMessage } from "@/lib/handoff/draft";
import type { JobLease } from "@/lib/server/store-contract";
import { requestFingerprint } from "@/lib/server/write-conflicts";
import { reviewCode } from "@/lib/server/ai";
import { acceptedExampleTests } from "@/lib/example-tests";
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
        // The browser's example-test run on exactly this code, stored with the attempt as a
        // learner-reported result. It never changes the AI review or the solved status.
        exampleTests: z
          .object({ passed: z.number().int().min(0), total: z.number().int().min(1) })
          .optional(),
      }),
    );
    const exampleTests = acceptedExampleTests(problem, input.exampleTests);
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
    const reviewed = await reviewCode(problem, input.code, (run) =>
      store.queries.recordAiRun(owner, run),
    );
    const review = exampleTests ? { ...reviewed, exampleTests } : reviewed;
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

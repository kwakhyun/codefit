import { z } from "zod";
import { readHandoffDraft } from "@/lib/handoff/draft";
import { coachReplySchema } from "@/lib/handoff/training";
import { coachUnderstanding, COACH_PROMPT_VERSION } from "@/lib/server/ai-coach";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { learningLab } from "@/lib/server/learning-lab";
import { aiLimit, requireProblem } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import type { JobLease } from "@/lib/server/store-contract";
import { requestFingerprint } from "@/lib/server/write-conflicts";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  let lease: JobLease | undefined;
  try {
    const { owner } = await session(request);
    const problem = await requireProblem((await context.params).id);
    const lab = learningLab(problem);
    const input = await readBody(
      request,
      z.object({ code: z.string().min(5).max(30000), requestId: z.uuid() }).strict(),
    );
    const draft = readHandoffDraft(input.code);
    const t = draft.training;
    if (
      !t?.prediction.locked ||
      !lab.choices.some((c) => c.id === t.prediction.choice) ||
      t.observation?.id !== "prediction" ||
      t.observation.status !== "ok"
    )
      throw new HttpError(400, "먼저 예상 결과를 고르고 원본 실행 결과를 확인해 주세요.");
    const store = await getStore();
    const job = await store.startJob(
      owner,
      input.requestId,
      `coach:${problem.id}`,
      requestFingerprint(COACH_PROMPT_VERSION, problem.id, input.code),
    );
    if (job.state === "done") return json(coachReplySchema.parse(JSON.parse(job.result)));
    if (job.state === "pending")
      throw new HttpError(409, "AI 질문을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.");
    lease = job.lease;
    await aiLimit(request, owner, "review");
    const reply = await coachUnderstanding(
      { originalCode: problem.starterCode, currentCode: draft.implementation, lab, training: t },
      (run) => store.queries.recordAiRun(owner, run),
    );
    await store.completeCoaching(lease, problem.id, JSON.stringify(reply));
    return json(reply);
  } catch (error) {
    if (lease) {
      try {
        await (await getStore()).failJob(lease);
      } catch {
        /* The lease expires. */
      }
    }
    return failure(error);
  }
}

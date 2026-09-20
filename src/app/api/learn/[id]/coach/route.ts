import { z } from "zod";
import { missionById } from "@/lib/learn/catalog";
import { coachSchema, learningSchema, validLearning, coachSnapshot } from "@/lib/learn/progress";
import { reproduced } from "@/lib/learn/simulation";
import { coachBuilder, LEARNING_COACH_VERSION } from "@/lib/server/ai-learning-coach";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { aiLimit } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import type { JobLease } from "@/lib/server/store-contract";
import { requestFingerprint } from "@/lib/server/write-conflicts";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request, c: { params: Promise<{ id: string }> }) {
  let lease: JobLease | undefined;
  try {
    const { owner } = await session(request);
    const { id } = await c.params;
    const m = missionById(id);
    if (!m) throw new HttpError(404, "미션을 찾을 수 없습니다.");
    const input = await readBody(
      request,
      z.object({ record: learningSchema, requestId: z.uuid() }).strict(),
    );
    const r = input.record;
    if (!validLearning(m, r) || !r.locked || !reproduced(m, r.actions))
      throw new HttpError(400, "먼저 예상 결과를 고르고 문제를 직접 재현해 주세요.");
    const store = await getStore();
    const job = await store.startJob(
      owner,
      input.requestId,
      `learn-coach:${id}`,
      requestFingerprint(LEARNING_COACH_VERSION, coachSnapshot(m, r)),
    );
    if (job.state === "done") return json(coachSchema.parse(JSON.parse(job.result)));
    if (job.state === "pending")
      throw new HttpError(409, "AI 질문을 준비 중입니다. 잠시 후 다시 확인해 주세요.");
    lease = job.lease;
    await aiLimit(request, owner, "learnCoach");
    const reply = await coachBuilder(m, r, (run) => store.queries.recordAiRun(owner, run));
    await store.queries.learning.completeCoach(lease, id, JSON.stringify(reply));
    return json(reply);
  } catch (e) {
    if (lease) {
      try {
        await (await getStore()).failJob(lease);
      } catch {
        /* Lease expiry permits recovery. */
      }
    }
    return failure(e);
  }
}

import { z } from "zod";
import { createHash } from "node:crypto";
import { readHandoffDraft } from "@/lib/handoff/draft";
import { coachReplySchema, observationSourceText } from "@/lib/handoff/training";
import { coachUnderstanding, COACH_PROMPT_VERSION } from "@/lib/server/ai-coach";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { learningLab, originalObservationMatches } from "@/lib/server/learning-lab";
import { aiLimit, requireProblem } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import type { JobLease } from "@/lib/server/store-contract";
import { requestFingerprint } from "@/lib/server/write-conflicts";
import { requireExperimentEvidence } from "@/lib/server/experiment-evidence";

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
      z
        .object({
          code: z.string().min(5).max(30000),
          requestId: z.uuid(),
          evidence: z.enum(["prediction", "experiment"]).default("prediction"),
        })
        .strict(),
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
    const expectedSource = createHash("sha256")
      .update(observationSourceText(problem.starterCode, lab))
      .digest("hex");
    if (t.observationSource !== expectedSource)
      throw new HttpError(
        400,
        "원본 코드나 실행 조건을 확인할 수 없는 이전 기록입니다. 원본을 다시 실행한 뒤 AI 질문을 요청해 주세요.",
      );
    if (!originalObservationMatches(problem, t.observation.actual))
      throw new HttpError(
        400,
        "저장된 실행 결과가 현재 원본의 확인 결과와 다릅니다. 원본을 다시 실행한 뒤 AI 질문을 요청해 주세요.",
      );
    if (input.evidence === "experiment")
      requireExperimentEvidence({
        originalCode: problem.starterCode,
        currentCode: draft.implementation,
        lab,
        training: t,
      });
    const store = await getStore();
    const job = await store.startJob(
      owner,
      input.requestId,
      `coach:${problem.id}`,
      requestFingerprint(COACH_PROMPT_VERSION, problem.id, input.evidence, input.code),
    );
    if (job.state === "done") return json(coachReplySchema.parse(JSON.parse(job.result)));
    if (job.state === "pending")
      throw new HttpError(409, "AI 질문을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.");
    lease = job.lease;
    await aiLimit(request, owner, "review");
    const reply = await coachUnderstanding(
      {
        originalCode: problem.starterCode,
        currentCode: draft.implementation,
        lab,
        training: t,
        evidence: input.evidence,
      },
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

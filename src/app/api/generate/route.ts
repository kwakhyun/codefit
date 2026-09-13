import { generationSchema, problemSchema, publicProblem } from "@/lib/problem";
import { generateProblem } from "@/lib/server/ai";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { aiLimit } from "@/lib/server/problem-access";
import { requireUser } from "@/lib/server/session";
import { generationDay } from "@/lib/server/generation-quota";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  let jobId: string | undefined;
  try {
    const { owner } = await requireUser(request);
    const input = await readBody(request, generationSchema, 4000);
    const store = await getStore();
    const job = await store.startJob(owner, input.requestId, "generate");
    if (job.state === "done")
      return json({ problem: publicProblem((await store.problem(job.result!))!) });
    if (job.state === "pending")
      throw new HttpError(409, "같은 문제를 생성하고 있습니다. 잠시 후 보관함을 확인해 주세요.");
    jobId = input.requestId;
    if (!(await store.reserveGeneration(owner, input.requestId))) {
      throw new HttpError(
        429,
        "오늘의 문제 생성 3회를 모두 사용했습니다. 한국 시간 자정에 다시 3회가 제공됩니다.",
        Math.ceil((generationDay().resetsAt - Date.now()) / 1000),
      );
    }
    await aiLimit(request, owner, "generate");
    const content = await generateProblem(input, await store.queries.titles(input.domain), (run) =>
      store.queries.recordAiRun(owner, run),
    );
    const problem = problemSchema.parse({
      ...content,
      id: `ai-${crypto.randomUUID()}`,
      domain: input.domain,
      language: input.language,
      difficulty: input.difficulty,
      kind: input.kind,
      source: "ai",
      createdAt: new Date().toISOString(),
    });
    await store.completeGeneration(problem, input.requestId);
    return json({ problem: publicProblem(problem) }, 201);
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

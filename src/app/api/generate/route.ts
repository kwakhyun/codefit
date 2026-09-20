import type { JobLease } from "@/lib/server/store-contract";
import { requestFingerprint } from "@/lib/server/write-conflicts";
import { generationSchema, problemSchema, publicProblem } from "@/lib/problem";
import { generateProblem } from "@/lib/server/ai";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { aiLimit } from "@/lib/server/problem-access";
import { session } from "@/lib/server/session";
import { generationDay, generationAllowance } from "@/lib/server/generation-quota";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  let lease: JobLease | undefined;
  try {
    const { owner } = await session(request);
    const input = await readBody(request, generationSchema, 4000);
    const store = await getStore();
    const job = await store.startJob(
      owner,
      input.requestId,
      "generate",
      requestFingerprint(input.domain, input.language, input.difficulty, input.kind, input.topic),
    );
    if (job.state === "done")
      return json({ problem: publicProblem((await store.problem(job.result!))!) });
    if (job.state === "pending")
      throw new HttpError(409, "같은 문제를 생성하고 있습니다. 잠시 후 보관함을 확인해 주세요.");
    lease = job.lease;
    if (!(await store.reserveGeneration(lease))) {
      throw new HttpError(
        429,
        `오늘의 문제 생성 ${generationAllowance(owner)}회를 모두 사용했습니다. 한국 시간 자정에 초기화됩니다. 로그인하면 더 많이 사용할 수 있습니다.`,
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
    await store.completeGeneration(problem, lease);
    return json({ problem: publicProblem(problem) }, 201);
  } catch (error) {
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

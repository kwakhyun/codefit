import { importLimits, networkIdentity } from "@/lib/server/usage-policy";
import { backupSchema } from "@/lib/backup";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const backup = await readBody(request, backupSchema, 10_000_000);
    const store = await getStore();
    let newProblems = 0;
    for (const problem of backup.problems) if (!(await store.problem(problem.id))) newProblems++;
    if (
      !(await store.consumeLimits(
        importLimits(owner, networkIdentity(request), newProblems, backup.attempts.length),
      ))
    )
      throw new HttpError(
        429,
        "백업 가져오기 한도에 도달했습니다. 최대 24시간 후 다시 시도해 주세요. 한 번에 새 문제는 100개까지 복원할 수 있습니다.",
        86400,
      );
    try {
      return json(await (await getStore()).importBackup(owner, backup));
    } catch {
      throw new HttpError(
        400,
        "백업의 문제와 풀이 기록이 일치하지 않습니다. 원본 백업 파일을 확인해 주세요.",
      );
    }
  } catch (error) {
    return failure(error);
  }
}

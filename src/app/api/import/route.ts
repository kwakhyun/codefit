import { importLimits, networkIdentity } from "@/lib/server/usage-policy";
import { backupSchema } from "@/lib/backup";
import { BACKUP_MAX_BYTES } from "@/lib/backup-limits";
import { prepareBackup } from "@/lib/server/workspace-backup";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { session } from "@/lib/server/session";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const backup = await readBody(request, backupSchema, BACKUP_MAX_BYTES);
    try {
      prepareBackup(backup);
    } catch {
      throw new HttpError(
        400,
        "백업의 학습 기록과 평가 근거가 일치하지 않습니다. 원본 파일을 확인해 주세요.",
      );
    }
    const store = await getStore();
    const existing = await store.queries.countExistingProblems(backup.problems.map((p) => p.id));
    const newProblems = backup.problems.length - existing;
    if (
      !(await store.consumeLimits(
        importLimits(owner, networkIdentity(request), newProblems, backup.attempts.length),
      ))
    )
      throw new HttpError(
        429,
        "백업 가져오기 한도에 도달했습니다. 최대 24시간 후 다시 시도해 주세요.",
        86400,
      );
    try {
      return json(await store.importBackup(owner, backup));
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

import { backupSchema } from "@/lib/backup";
import { session, failure, json, readBody, HttpError } from "@/lib/server/http";
import { getStore } from "@/lib/server/database";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const backup = await readBody(request, backupSchema, 10_000_000);
    if (!await (await getStore()).consumeLimits([{ key:"import:global",max:10,windowMs:3600_000 }])) throw new HttpError(429,"백업 가져오기 요청이 많습니다. 잠시 후 다시 시도해 주세요.");
    try { return json(await (await getStore()).importBackup(owner, backup)); }
    catch { throw new HttpError(400, "백업의 문제와 풀이 기록이 일치하지 않습니다. 원본 백업 파일을 확인해 주세요."); }
  } catch (error) { return failure(error); }
}

import { aiLimits, networkIdentity } from "./usage-policy";
import { getStore } from "./database";
import { HttpError } from "./http";

export async function aiLimit(request: Request, owner: string, kind: "generate" | "review") {
  if (!(await (await getStore()).consumeLimits(aiLimits(owner, networkIdentity(request), kind))))
    throw new HttpError(
      429,
      "AI 이용 한도에 도달했습니다. 최대 24시간 후 다시 이용할 수 있습니다. 문제 풀이와 기록 조회는 계속 사용할 수 있습니다.",
      86400,
    );
}
export async function requireProblem(id: string) {
  const p = await (await getStore()).problem(id);
  if (!p) throw new HttpError(404, "문제를 찾을 수 없습니다.");
  return p;
}

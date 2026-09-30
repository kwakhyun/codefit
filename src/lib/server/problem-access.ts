import { aiLimits, networkIdentity } from "./usage-policy";
import { getStore } from "./database";
import { HttpError } from "./http";

/** Returns a refund of the caller's personal allowance for when no AI result is saved. */
export async function aiLimit(
  request: Request,
  owner: string,
  kind: "generate" | "review" | "coach" | "learnCoach",
) {
  const store = await getStore();
  const limits = aiLimits(owner, networkIdentity(request), kind);
  if (!(await store.consumeLimits(limits)))
    throw new HttpError(
      429,
      "AI 이용 한도에 도달했습니다. 최대 24시간 후 다시 이용할 수 있습니다. 문제 풀이와 기록 조회는 계속 사용할 수 있습니다.",
      86400,
    );
  // Shared network and global pools stay spent; they bound provider traffic, not the learner.
  const personal = limits
    .map((l) => l.key)
    .filter((key) => key === `ai:${kind}:${owner}` || key.startsWith("ai:guest-network:"));
  return async () => {
    try {
      await store.queries.releaseLimits(personal);
    } catch {
      /* The allowance resets within a day. */
    }
  };
}
export async function requireProblem(id: string, owner?: string) {
  const p = await (await getStore()).problem(id, owner);
  if (!p) throw new HttpError(404, "문제를 찾을 수 없습니다.");
  return p;
}

import { getStore } from "./database";
import { HttpError } from "./http";

export async function aiLimit(owner: string, kind: "generate" | "review") {
  const ok = await (
    await getStore()
  ).consumeLimits([
    { key: `ai:${kind}:${owner}`, max: kind === "generate" ? 20 : 60, windowMs: 86400_000 },
    { key: "ai:global", max: 100, windowMs: 3600_000 },
  ]);
  if (!ok)
    throw new HttpError(
      429,
      "AI 요청 한도에 도달했습니다. 개인 한도는 24시간, 전체 한도는 1시간 후 갱신됩니다.",
    );
}
export async function requireProblem(id: string) {
  const p = await (await getStore()).problem(id);
  if (!p) throw new HttpError(404, "문제를 찾을 수 없습니다.");
  return p;
}

import { createHash } from "node:crypto";
import { session } from "@/lib/server/session";
import { getStore } from "@/lib/server/database";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { networkIdentity } from "@/lib/server/usage-policy";
import { publicUrl } from "@/lib/server/project-page";
import { securityAuditInput } from "@/lib/security-audit";
import { createOwnershipChallenge, runCorsAudit } from "@/lib/server/security-audit";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  try {
    const { owner, user } = await session(request);
    if (!user) throw new HttpError(401, "소유권 확인 후 테스트는 로그인이 필요합니다.");
    const input = await readBody(request, securityAuditInput, 5000);
    const url = publicUrl(input.url);
    const target = createHash("sha256").update(url.origin).digest("hex");
    const allowed = await (
      await getStore()
    ).consumeLimits([
      { key: `security-audit:owner:${owner}`, max: 8, windowMs: 3600_000 },
      { key: `security-audit:network:${networkIdentity(request)}`, max: 15, windowMs: 3600_000 },
      { key: `security-audit:target:${target}`, max: 8, windowMs: 3600_000 },
      { key: "security-audit:global", max: 80, windowMs: 86400_000 },
    ]);
    if (!allowed)
      throw new HttpError(429, "테스트 요청 한도에 도달했습니다. 한 시간 뒤 다시 시도하세요.");
    return json(
      input.token
        ? await runCorsAudit(
            url.href,
            owner,
            input.token,
            AbortSignal.any([request.signal, AbortSignal.timeout(26000)]),
          )
        : createOwnershipChallenge(url.href, owner),
    );
  } catch (error) {
    return failure(error);
  }
}

import { createHash } from "node:crypto";
import { z } from "zod";
import { session } from "@/lib/server/session";
import { getStore } from "@/lib/server/database";
import { networkIdentity } from "@/lib/server/usage-policy";
import { failure, HttpError, json, readBody } from "@/lib/server/http";
import { publicUrl, readPublicDocument } from "@/lib/server/project-page";
import { inspectSecurity } from "@/lib/server/security-check";
export const runtime = "nodejs";
export const maxDuration = 20;
/** Personal hourly check allowance; the network, target and global windows also apply. */
const OWNER_LIMIT = 5;
const resetTime = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
/** The personal allowance for the cost preview; it reads and never consumes. */
export async function GET(request: Request) {
  try {
    const { owner } = await session(request);
    const store = await getStore();
    return json({
      window: "1시간",
      ...(await store.queries.projectChecks.limitUsage(`security:owner:${owner}`, OWNER_LIMIT)),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const { owner } = await session(request);
    const input = await readBody(
      request,
      z.object({ url: z.string().max(2000), authorized: z.literal(true) }).strict(),
      4000,
    );
    const url = publicUrl(input.url);
    const target = createHash("sha256").update(url.hostname).digest("hex");
    const store = await getStore();
    const ownerKey = `security:owner:${owner}`;
    const allowed = await store.consumeLimits([
      { key: ownerKey, max: OWNER_LIMIT, windowMs: 3_600_000 },
      { key: `security:network:${networkIdentity(request)}`, max: 15, windowMs: 3_600_000 },
      { key: `security:target:${target}`, max: 10, windowMs: 3_600_000 },
      { key: "security:global", max: 150, windowMs: 86_400_000 },
    ]);
    if (!allowed) {
      // Name the reset time when the personal window is the one that is full.
      const usage = await store.queries.projectChecks
        .limitUsage(ownerKey, OWNER_LIMIT)
        .catch(() => null);
      throw new HttpError(
        429,
        usage && usage.remaining === 0 && usage.resetsAt
          ? `보안 점검 횟수를 모두 사용했습니다. ${resetTime(usage.resetsAt)} 이후 다시 이용할 수 있습니다.`
          : "보안 점검 요청이 많아 잠시 제한됐습니다. 잠시 후 다시 이용해 주세요.",
      );
    }
    let document;
    try {
      document = await readPublicDocument(url.href, request.signal, { anyResponse: true });
    } catch (error) {
      // 422 means the target site failed (DNS, connection, timeout, redirects), not the input.
      // Return only the personal window; network, target and global windows still count it.
      if (error instanceof HttpError && error.status === 422 && !request.signal.aborted)
        await store.queries.refundLimits([ownerKey]).catch(() => {});
      throw error;
    }
    return json(inspectSecurity(document));
  } catch (error) {
    return failure(error);
  }
}

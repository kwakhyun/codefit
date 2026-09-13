import { cookies } from "next/headers";
import { createHash, randomBytes, timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import OpenAI from "openai";
import { getStore } from "./database";
import { isAllowedOrigin } from "./request-origin";

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export function equalSecret(a: string, b: string) {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}
export function accessSignature(token: string) {
  return createHmac("sha256", process.env.LAB_ACCESS_TOKEN || "local").update(token).digest("hex");
}
export async function session(request: Request, options: { login?: boolean } = {}) {
  const url = new URL(request.url);
  const secure = url.protocol === "https:" || Boolean(process.env.APP_ORIGIN?.startsWith("https://"));
  if (!isAllowedOrigin(request, process.env.APP_ORIGIN)) {
    throw new HttpError(403, "다른 사이트에서 시작된 요청은 허용하지 않습니다.");
  }
  const jar = await cookies();
  let token = jar.get("recode_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    jar.set("recode_session", token, { httpOnly: true, sameSite: "lax", secure, path: "/", maxAge: 365 * 86400 });
  }
  if (process.env.LAB_ACCESS_TOKEN && !options.login) {
    const signature = jar.get("recode_access")?.value || "";
    if (!equalSecret(signature, accessSignature(token))) throw new HttpError(401, "연습실 접근 암호를 입력해 주세요.");
  }
  // Production always requires an access password; do not rely on a spoofable Host header for authentication.
  if (process.env.NODE_ENV === "production" && !process.env.LAB_ACCESS_TOKEN) {
    throw new HttpError(503, "공개 운영을 위해 서버에 LAB_ACCESS_TOKEN을 설정해 주세요.");
  }
  return { owner: createHash("sha256").update(token).digest("hex"), token, jar, secure };
}
export async function readBody<T>(request: Request, schema: z.ZodType<T>, maxBytes = 100_000): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json")) throw new HttpError(415, "JSON 형식으로 요청해 주세요.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes) throw new HttpError(413, "입력 내용이 너무 큽니다.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "입력 내용을 확인해 주세요.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new HttpError(413, "입력 내용이 너무 큽니다."); }
    chunks.push(value);
  }
  try {
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const parsed = schema.safeParse(raw);
    if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message || "입력 내용을 확인해 주세요.");
    return parsed.data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "올바른 JSON 형식이 아닙니다.");
  }
}
export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store" } }); }
export function failure(error: unknown) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    // Never log request bodies, provider errors or credentials.
    console.error("AI request failed", { status, type: error.constructor.name });
    if (status === 429) return json({ error: "AI 사용 한도 또는 요청 제한에 도달했습니다. 잠시 후 다시 시도하거나 서버 API 계정을 확인해 주세요." }, 429);
    if (status === 401 || status === 403) return json({ error: "서버의 AI 인증 설정을 확인해 주세요." }, 503);
    if (status === 404) return json({ error: "설정한 AI 모델을 사용할 수 없습니다. 서버 모델 설정을 확인해 주세요." }, 503);
    return json({ error: "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }
  console.error("Workspace request failed", { type: error instanceof Error ? error.constructor.name : "unknown" });
  return json({ error: "요청을 완료하지 못했습니다. 작성 내용은 그대로 두고 다시 시도해 주세요." }, 500);
}
export async function aiLimit(owner: string, kind: "generate" | "review") {
  const ok = await (await getStore()).consumeLimits([
    { key: `ai:${kind}:${owner}`, max: kind === "generate" ? 20 : 60, windowMs: 86400_000 },
    { key: "ai:global", max: 100, windowMs: 3600_000 },
  ]);
  if (!ok) throw new HttpError(429, "AI 요청 한도에 도달했습니다. 개인 한도는 24시간, 전체 한도는 1시간 후 갱신됩니다.");
}
export async function requireProblem(id: string) {
  const p = await (await getStore()).problem(id);
  if (!p) throw new HttpError(404, "문제를 찾을 수 없습니다.");
  return p;
}

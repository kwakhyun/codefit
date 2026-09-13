import { cookies } from "next/headers";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { HttpError } from "./http";
import { isAllowedOrigin } from "./request-origin";

export function equalSecret(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function accessSignature(token: string) {
  return createHmac("sha256", process.env.LAB_ACCESS_TOKEN || "local")
    .update(token)
    .digest("hex");
}
export async function session(request: Request, options: { login?: boolean } = {}) {
  const url = new URL(request.url);
  const secure =
    url.protocol === "https:" || Boolean(process.env.APP_ORIGIN?.startsWith("https://"));
  if (!isAllowedOrigin(request, process.env.APP_ORIGIN)) {
    throw new HttpError(403, "다른 사이트에서 시작된 요청은 허용하지 않습니다.");
  }
  const jar = await cookies();
  let token = jar.get("recode_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    token = randomBytes(32).toString("hex");
    jar.set("recode_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 365 * 86400,
    });
  }
  if (process.env.LAB_ACCESS_TOKEN && !options.login) {
    const signature = jar.get("recode_access")?.value || "";
    if (!equalSecret(signature, accessSignature(token)))
      throw new HttpError(401, "연습실 접근 암호를 입력해 주세요.");
  }
  // Production always requires an access password; do not rely on a spoofable Host header for authentication.
  if (process.env.NODE_ENV === "production" && !process.env.LAB_ACCESS_TOKEN) {
    throw new HttpError(503, "공개 운영을 위해 서버에 LAB_ACCESS_TOKEN을 설정해 주세요.");
  }
  return { owner: createHash("sha256").update(token).digest("hex"), token, jar, secure };
}

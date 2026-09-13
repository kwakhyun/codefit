import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./http";
import { isAllowedOrigin } from "./request-origin";

/** Anonymous, browser-scoped ownership. Preserve the cookie name and hash for existing records. */
export async function session(request: Request) {
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
  return { owner: createHash("sha256").update(token).digest("hex") };
}

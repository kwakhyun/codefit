import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "./http";
import { isAllowedOrigin } from "./request-origin";
import { accountUser } from "./auth";

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
  const guestOwner = createHash("sha256").update(token).digest("hex");
  const user = await accountUser(request.headers);
  const owner = user ? `user:${user.id}` : guestOwner;
  const scope = user ? owner : `guest:${guestOwner}`;
  const expected = request.headers.get("x-codefit-workspace");
  if (expected && expected !== scope && url.pathname !== "/api/workspace") {
    throw new HttpError(
      409,
      "로그인 계정이 변경되었습니다. 새로고침한 뒤 다시 이용해 주세요. 미저장 코드는 이전 연습실에 보관됩니다.",
    );
  }
  return { owner, scope, guestOwner, user };
}

export async function requireUser(request: Request) {
  const current = await session(request);
  if (!current.user) throw new HttpError(401, "이 계정 관리 기능은 로그인이 필요합니다.");
  return { ...current, user: current.user };
}

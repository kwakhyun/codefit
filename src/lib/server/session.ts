import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { HttpError } from "./http";
import { isAllowedOrigin } from "./request-origin";
import { accountUser } from "./auth";
import { GUEST_COOKIE, newGuestCookie, validGuestToken } from "./guest-cookie";

/** Anonymous, browser-scoped ownership. Page navigations receive the cookie from the proxy;
 * a request that still arrives without one (e.g. a direct API client) gets it here. */
export async function session(request: Request) {
  const url = new URL(request.url);
  if (!isAllowedOrigin(request, process.env.APP_ORIGIN)) {
    throw new HttpError(403, "다른 사이트에서 시작된 요청은 허용하지 않습니다.");
  }
  const jar = await cookies();
  let token = jar.get(GUEST_COOKIE)?.value;
  if (!validGuestToken(token)) {
    const cookie = newGuestCookie(request.url);
    token = cookie.value;
    jar.set(cookie);
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

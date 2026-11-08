import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, newGuestCookie, validGuestToken } from "@/lib/server/guest-cookie";

/**
 * Pages that need a signed-in account. The shared shell streams before a page renders, so a
 * page-level redirect would arrive as a client-side refresh; answering here keeps it a real 307.
 * A present but invalid session cookie still falls through to the page's own redirect.
 */
const memberOnly = ["/profile"];

/** Issue the guest cookie with the first page, so parallel first API calls share one owner. */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (
    memberOnly.some((path) => pathname === path || pathname.startsWith(`${path}/`)) &&
    !getSessionCookie(request, { cookiePrefix: "codefit" })
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(login, 307);
  }
  if (validGuestToken(request.cookies.get(GUEST_COOKIE)?.value)) return NextResponse.next();
  const cookie = newGuestCookie(request.url);
  // Server rendering of this same request sees the new owner too.
  request.cookies.set(GUEST_COOKIE, cookie.value);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(cookie);
  return response;
}

export const config = {
  // Pages only: API routes keep their own fallback, and static files need no owner.
  matcher: ["/((?!api/|_next/|.*\\..*).*)"],
};

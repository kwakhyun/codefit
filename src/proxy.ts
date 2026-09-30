import { NextResponse, type NextRequest } from "next/server";
import { GUEST_COOKIE, newGuestCookie, validGuestToken } from "@/lib/server/guest-cookie";

/** Issue the guest cookie with the first page, so parallel first API calls share one owner. */
export function proxy(request: NextRequest) {
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

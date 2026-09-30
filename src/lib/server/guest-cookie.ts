import { randomBytes } from "node:crypto";

/** Anonymous, browser-scoped ownership. Preserve the cookie name and hash for existing records. */
export const GUEST_COOKIE = "recode_session";
export const validGuestToken = (token?: string): token is string =>
  Boolean(token && /^[a-f0-9]{64}$/.test(token));
export function newGuestCookie(url: string) {
  const secure =
    new URL(url).protocol === "https:" || Boolean(process.env.APP_ORIGIN?.startsWith("https://"));
  return {
    name: GUEST_COOKIE,
    value: randomBytes(32).toString("hex"),
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: 365 * 86400,
  };
}

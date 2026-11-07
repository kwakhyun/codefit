import { getAuth } from "./auth";

/**
 * Read-only session lookup for the app shell, which renders on every page load. Server
 * Components cannot set cookies, so this never refreshes the session: a refresh here would
 * extend the database session while the browser cookie keeps its old expiry. Route handlers
 * still refresh sessions as before.
 */
export async function shellAccount(headers: Headers) {
  const auth = await getAuth();
  if (!auth) return null;
  const session = await auth.api.getSession({ headers, query: { disableRefresh: true } });
  return session ? { name: session.user.name } : null;
}

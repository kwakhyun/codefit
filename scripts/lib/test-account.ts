import { resolve, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { serializeSignedCookie } from "better-call";
import { SqliteStore } from "../../src/lib/server/sqlite-store";
import { createAuth } from "../../src/lib/server/auth-config";

export const TEST_AUTH_SECRET = "codefit-isolated-test-secret-never-use-in-production";
/** Test setup writes directly to a disposable local DB; the application has no test-login endpoint. */
export async function testAccount(
  databasePath: string,
  baseURL: string,
  secret = TEST_AUTH_SECRET,
) {
  const within = relative(resolve("artifacts"), resolve(databasePath));
  if (
    !within ||
    within.startsWith("..") ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
  )
    throw new Error("Test accounts require a local server and a DB inside artifacts/.");
  const store = new SqliteStore(databasePath);
  try {
    const auth = createAuth({ database: store.db, baseURL, secret });
    const context = await auth.$context;
    const user = await context.internalAdapter.createUser(
      { name: "테스트 개발자", email: `test-${randomUUID()}@example.com`, emailVerified: true },
      { method: "test" },
    );
    const session = await context.internalAdapter.createSession(user.id);
    if (!session) throw new Error("Test session was not created");
    const cookie = (
      await serializeSignedCookie("codefit.session_token", session.token, secret, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
      })
    ).split(";", 1)[0];
    return { user, cookie, owner: `user:${user.id}`, store };
  } catch (error) {
    store.db.close();
    throw error;
  }
}

import { Pool } from "pg";
import { nextCookies } from "better-auth/next-js";
import { getStore } from "./database";
import { createAuth, configuredProviders } from "./auth-config";
import type { AccountUser } from "../auth-types";

let instance: Promise<ReturnType<typeof createAuth>> | undefined;
export async function getAuth() {
  if (!process.env.BETTER_AUTH_SECRET || !process.env.AUTH_BASE_URL) return null;
  if (!instance)
    instance = (async () => {
      await getStore(); // Run schema migrations under the existing database lock.
      const database = process.env.DATABASE_URL
        ? new Pool({ connectionString: process.env.DATABASE_URL, max: 2, idleTimeoutMillis: 20000 })
        : (await import("./sqlite-store")).getSqliteStore().db;
      const providers = configuredProviders();
      return createAuth({
        database,
        baseURL: process.env.AUTH_BASE_URL,
        secret: process.env.BETTER_AUTH_SECRET,
        socialProviders: {
          ...(providers.includes("google") && {
            google: {
              clientId: process.env.GOOGLE_CLIENT_ID!,
              clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
            },
          }),
          ...(providers.includes("github") && {
            github: {
              clientId: process.env.GITHUB_CLIENT_ID!,
              clientSecret: process.env.GITHUB_CLIENT_SECRET!,
              scope: ["read:user", "user:email"],
            },
          }),
        },
        plugins: [nextCookies()],
      });
    })().catch((error) => {
      instance = undefined;
      throw error;
    });
  return instance;
}

export async function accountUser(headers: Headers): Promise<AccountUser | null> {
  const auth = await getAuth();
  if (!auth) return null;
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  return {
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    bio: session.user.bio || "",
    createdAt: session.user.createdAt.toISOString(),
  };
}

import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError } from "better-auth/api";
import { z } from "zod";
import type { OAuthProvider } from "../auth-types";

export const profileSchema = z.object({
  name: z.string().trim().min(2, "이름을 2자 이상 입력해 주세요.").max(40),
  bio: z.string().trim().max(300),
});

export function configuredProviders(env: NodeJS.ProcessEnv = process.env): OAuthProvider[] {
  if (!env.BETTER_AUTH_SECRET || !env.AUTH_BASE_URL) return [];
  return (["google", "github"] as const).filter((provider) => {
    const prefix = provider.toUpperCase();
    return Boolean(env[`${prefix}_CLIENT_ID`] && env[`${prefix}_CLIENT_SECRET`]);
  });
}

/** OAuth state, PKCE, signed cookies, session revocation and linking belong to Better Auth. */
export function createAuth(
  options: Pick<
    BetterAuthOptions,
    "database" | "baseURL" | "secret" | "socialProviders" | "plugins"
  >,
) {
  return betterAuth({
    ...options,
    appName: "CODE:FIT",
    basePath: "/api/auth",
    user: {
      modelName: "auth_user",
      additionalFields: { bio: { type: "string", required: false, defaultValue: "" } },
    },
    session: { modelName: "auth_session", expiresIn: 30 * 86400, updateAge: 86400 },
    account: {
      modelName: "auth_account",
      encryptOAuthTokens: true,
      accountLinking: { enabled: true, disableImplicitLinking: true, allowUnlinkingAll: false },
    },
    verification: { modelName: "auth_verification" },
    rateLimit: {
      enabled: true,
      storage: "database",
      modelName: "auth_rate_limit",
      window: 60,
      max: 30,
    },
    advanced: { cookiePrefix: "codefit", disableOriginCheck: false, disableCSRFCheck: false },
    onAPIError: { errorURL: "/login" },
    logger: {
      level: "error",
      log: (level) => console.error("Authentication request failed", { level }),
    },
    databaseHooks: {
      user: {
        update: {
          before: async (user) => {
            const parsed = profileSchema.partial().safeParse(user);
            if (!parsed.success)
              throw new APIError("BAD_REQUEST", {
                message: "이름은 2–40자, 소개는 300자 이내로 작성해 주세요.",
              });
            return { data: { ...user, ...parsed.data } };
          },
        },
      },
    },
  });
}

import { afterEach, describe, expect, it, vi } from "vitest";
import { SqliteStore } from "./sqlite-store";
import { createAuth } from "./auth-config";
import { getMigrations } from "better-auth/db/migration";
import { safeReturnTo } from "../auth-types";
import { aiModel } from "./ai-models";
import { estimateCost } from "../ai-telemetry";
const baseURL = "http://localhost:3010";
const stores: SqliteStore[] = [];
function fixture() {
  const store = new SqliteStore(":memory:");
  stores.push(store);
  const auth = createAuth({
    database: store.db,
    baseURL,
    secret: "codefit-test-secret-with-at-least-32-characters",
    socialProviders: {
      github: { clientId: "test-client", clientSecret: "test-secret" },
      google: { clientId: "test-google", clientSecret: "test-secret" },
    },
  });
  return { auth, store };
}
function request(path: string, body?: unknown, cookie = "", origin = baseURL) {
  return new Request(`${baseURL}/api/auth/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      origin,
      cookie,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((v) => v.split(";", 1)[0])
    .join("; ");
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  for (const store of stores.splice(0)) store.db.close();
});
describe("OAuth and database sessions", () => {
  it("matches the installed authentication library schema", async () => {
    const { auth } = fixture();
    const migrations = await getMigrations(auth.options);
    expect(migrations.toBeCreated).toEqual([]);
    expect(migrations.toBeAdded).toEqual([]);
    expect(migrations.toBeAddedIndexes).toEqual([]);
  });
  it("completes GitHub OAuth, encrypts tokens, validates profiles and revokes sessions", async () => {
    const { auth, store } = fixture();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string | Request) => {
        const value = url instanceof Request ? url.url : String(url);
        if (value.includes("github.com/login/oauth/access_token"))
          return Response.json({
            access_token: "private-test-oauth-token",
            token_type: "bearer",
            scope: "read:user,user:email",
          });
        if (value === "https://api.github.com/user/emails")
          return Response.json([{ email: "developer@example.com", primary: true, verified: true }]);
        if (value === "https://api.github.com/user")
          return Response.json({
            id: 123456,
            login: "developer",
            name: "Developer",
            email: "developer@example.com",
            avatar_url: null,
          });
        throw new Error("Unexpected provider endpoint");
      }),
    );
    const begin = await auth.handler(
      request("sign-in/social", { provider: "github", callbackURL: "/profile" }),
    );
    expect(begin.status).toBe(200);
    const authorization = new URL((await begin.json()).url);
    expect(authorization.hostname).toBe("github.com");
    expect(authorization.searchParams.get("state")).toBeTruthy();
    const complete = await auth.handler(
      request(
        `callback/github?code=test-code&state=${authorization.searchParams.get("state")}`,
        undefined,
        cookies(begin),
      ),
    );
    expect(complete.status).toBe(302);
    expect(complete.headers.get("location")).toBe("/profile");
    const cookie = cookies(complete);
    const signedIn = await (await auth.handler(request("get-session", undefined, cookie))).json();
    expect(signedIn.user.email).toBe("developer@example.com");
    expect(
      store.db.prepare('SELECT "accessToken" FROM auth_account').get()?.accessToken,
    ).not.toContain("private-test-oauth-token");
    expect(
      (await auth.handler(request("update-user", { name: "x", bio: "x".repeat(301) }, cookie)))
        .status,
    ).toBe(400);
    expect(
      (
        await auth.handler(
          request("update-user", { name: "코딩하는 개발자", bio: "매일 20분" }, cookie),
        )
      ).status,
    ).toBe(200);
    expect(
      (await (await auth.handler(request("get-session", undefined, cookie))).json()).user.bio,
    ).toBe("매일 20분");
    expect((await auth.handler(request("sign-out", {}, cookie))).status).toBe(200);
    expect(await (await auth.handler(request("get-session", undefined, cookie))).json()).toBeNull();
  });
  it("rejects forged sessions, cross-site sign-in and callback state tampering", async () => {
    const { auth } = fixture();
    expect(
      await (
        await auth.handler(request("get-session", undefined, "codefit.session_token=forged"))
      ).json(),
    ).toBeNull();
    expect(
      (
        await auth.handler(
          request(
            "sign-in/social",
            { provider: "github", callbackURL: "/" },
            "codefit.session_token=forged",
            "https://evil.example",
          ),
        )
      ).status,
    ).toBe(403);
    for (const provider of ["google", "github"]) {
      const callback = await auth.handler(request(`callback/${provider}?code=forged&state=wrong`));
      expect(callback.status).toBe(302);
      expect(callback.headers.get("location")).toContain("error=");
    }
    expect(
      (
        await auth.handler(
          request("sign-in/social", { provider: "github", callbackURL: "https://evil.example" }),
        )
      ).status,
    ).toBe(403);
  });
});
it("uses Sol generation and preserves the evaluated review model", () => {
  vi.stubEnv("OPENAI_GENERATION_MODEL", "");
  vi.stubEnv("OPENAI_REVIEW_MODEL", "");
  vi.stubEnv("OPENAI_MODEL", "");
  expect(aiModel("generate")).toBe("gpt-5.6-sol");
  expect(aiModel("review")).toBe("gpt-5.4-mini");
  expect(estimateCost("gpt-5.6-sol", 1000000, 0, 1000000)).toBe(24);
});
it("preserves only safe local return paths", () => {
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/api/auth/sign-out",
  ])
    expect(safeReturnTo(path)).toBe("/");
  expect(safeReturnTo("/?domain=backend&generate=1")).toBe("/?domain=backend&generate=1");
});

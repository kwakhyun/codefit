import { E2E_BASE_URL } from "../scripts/lib/e2e-environment";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { testAccount } from "../scripts/lib/test-account";
import { resolve } from "node:path";
import { editor, setCode } from "./editor-helpers";
const base = E2E_BASE_URL;
test("guests can practice, see login guidance, and can generate but cannot read member profiles", async ({
  page,
  request,
}) => {
  expect((await request.post("/api/generate", { data: {} })).status()).toBe(400);
  expect((await request.get("/api/profile")).status()).toBe(401);
  expect(
    (
      await request.post("/api/problems/be-pagination/review", {
        data: { requestId: crypto.randomUUID(), code: "" },
      })
    ).status(),
  ).toBe(400);
  await page.goto("/?generate=1");
  await expect(page.getByRole("heading", { name: /지금 필요한 문제를 만드세요/ })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("link", { name: "로그인하고 하루 6회 이용하기" })
    .click();
  await expect(page.getByRole("heading", { name: /연습 기록을 이어가세요/ })).toBeVisible();
  await expect(
    page.getByText("로컬 미리보기에는 로그인 설정이 없습니다.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "운영 사이트에서 로그인하기 ↗" })).toHaveAttribute(
    "href",
    "https://codefit-five.vercel.app/login",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByRole("link", { name: "로그인 없이 연습하기" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: /작동 원리를 직접 확인해 보세요/ }),
  ).toBeVisible();
});
test("profile, account ownership, generation quota and logout work together", async ({
  page,
  context,
}) => {
  const fixture = await testAccount(resolve("artifacts/e2e.sqlite"), base);
  try {
    const [name, ...parts] = fixture.cookie.split("=");
    await context.addCookies([
      { name, value: parts.join("="), url: base, httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: "내 프로필과 학습 현황" })).toBeVisible();
    await page.getByLabel("이름", { exact: true }).fill("계정 연습자");
    await page.getByLabel("한 줄 소개", { exact: true }).fill("백엔드 기본기 단련 중");
    await page.getByRole("button", { name: "프로필 저장" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "프로필을 저장했습니다." }),
    ).toBeVisible();
    await page.reload();
    await expect(page.getByLabel("한 줄 소개", { exact: true })).toHaveValue(
      "백엔드 기본기 단련 중",
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: "artifacts/oauth-profile-mobile.png", fullPage: true });
    await page.setViewportSize({ width: 1280, height: 900 });
    const prior = await context.request.get("/api/workspace");
    expect((await prior.json()).scope).toBe(fixture.owner);
    for (let i = 0; i < 6; i++) {
      const job = fixture.store.startJob(fixture.owner, crypto.randomUUID(), "generate", "fixture");
      if (job.state === "new") fixture.store.reserveGeneration(job.lease);
    }
    const generation = await context.request.post("/api/generate", {
      data: {
        requestId: crypto.randomUUID(),
        domain: "backend",
        language: "python",
        difficulty: "하",
        kind: "implementation",
        topic: "페이지 분할 구현",
      },
    });
    expect(generation.status()).toBe(429);
    expect(generation.headers()["retry-after"]).toBeTruthy();
    await page.goto("/?generate=1");
    await expect(page.getByText("오늘 0 / 6회 남음")).toBeVisible();
    await expect(page.getByText(/오늘의 문제 생성 횟수를 모두 사용했습니다/)).toBeVisible();
    await page.goto("/profile");
    await page.getByRole("button", { name: "로그아웃", exact: true }).click();
    await expect(page).toHaveURL(base + "/");
    expect((await context.request.get("/api/profile")).status()).toBe(401);
    const staleSave = await context.request.put("/api/progress/be-pagination", {
      headers: { "X-Codefit-Workspace": fixture.owner },
      data: { code: "private former account draft", baseRevision: 0 },
    });
    expect(staleSave.status()).toBe(409);
    expect((await context.request.post("/api/generate", { data: {} })).status()).toBe(400);
  } finally {
    fixture.store.db.close();
  }
});

test("queued drafts and stale profiles cannot cross an account switch", async ({
  page,
  context,
}) => {
  const first = await testAccount(resolve("artifacts/e2e.sqlite"), base);
  const second = await testAccount(resolve("artifacts/e2e.sqlite"), base);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const login = async (cookie: string) => {
    const [name, ...parts] = cookie.split("=");
    await context.addCookies([
      { name, value: parts.join("="), url: base, httpOnly: true, sameSite: "Lax" },
    ]);
  };
  try {
    await login(first.cookie);
    await editor(page);
    const scopes: string[] = [];
    await page.route("**/api/progress/be-pagination", async (route) => {
      scopes.push(route.request().headers()["x-codefit-workspace"]);
      if (scopes.length === 1) await gate;
      await route.continue();
    });
    await setCode(page, "print('first pending account draft')");
    await expect.poll(() => scopes.length).toBe(1);
    await setCode(page, "print('second queued account draft')");
    await page.getByRole("button", { name: "지금 저장", exact: true }).first().click();
    await login(second.cookie);
    await page.locator(".workspace-breadcrumb").getByRole("link", { name: "문제 보관함" }).click();
    await expect(
      page.getByRole("button", { name: "문제와 기록 새로고침", exact: true }),
    ).toBeEnabled();
    await expect
      .poll(async () => (await (await context.request.get("/api/workspace")).json()).scope)
      .toBe(second.owner);
    const rejected = page.waitForResponse(
      (r) => r.url().endsWith("/api/progress/be-pagination") && r.status() === 409,
    );
    release();
    await rejected;
    expect(scopes).toHaveLength(1);
    expect(
      await page.evaluate(
        (owner) =>
          Object.keys(localStorage)
            .filter((key) => key.startsWith(`codefit-draft:${owner}:`))
            .map((key) => localStorage.getItem(key))
            .join(""),
        first.owner,
      ),
    ).toContain("second queued account draft");
    expect(scopes.every((scope) => scope === first.owner)).toBe(true);
    expect(second.store.progressFor(second.owner, "be-pagination")).toBeNull();
    await page.goto("/profile");
    await page.getByLabel("이름", { exact: true }).fill("이전 화면의 이름");
    await login(first.cookie);
    await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "로그인 계정이 변경되었습니다" }),
    ).toBeVisible();
    expect((await (await context.request.get("/api/profile")).json()).user.name).toBe(
      first.user.name,
    );
  } finally {
    release();
    first.store.db.close();
    second.store.db.close();
  }
});

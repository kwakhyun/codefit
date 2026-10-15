import { expect, test, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { E2E_BASE_URL } from "../scripts/lib/e2e-environment";
import { testAccount } from "../scripts/lib/test-account";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { restoredProjectId } from "../src/lib/server/workspace-backup";

// Normal PRs exercise the production build without any external AI requests.
// The full cross-browser suite remains available through workflow_dispatch.
const databasePath = resolve("artifacts/e2e.sqlite");
async function login(context: BrowserContext, cookie: string) {
  const [name, ...value] = cookie.split("=");
  await context.clearCookies();
  await context.addCookies([
    { name, value: value.join("="), url: E2E_BASE_URL, httpOnly: true, sameSite: "Lax" },
  ]);
}
async function seedCheck(account: Awaited<ReturnType<typeof testAccount>>) {
  const id = randomUUID();
  const claim = account.store.startJob(account.owner, id, "project-analysis", "ci-fixture");
  if (claim.state !== "new") throw new Error("CI project fixture was not created");
  await account.store.queries.projectChecks.complete(claim.lease, { ...fixtureCheck, id });
  return id;
}

test("project entry works from navigation and keeps an unfinished input after reload", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "작업 공간 메뉴" })
    .locator('a[href="/project-check"]')
    .click();
  await expect(page).toHaveURL(/\/project-check$/);
  await expect(page.getByRole("heading", { name: "어떤 프로젝트를 살펴볼까요?" })).toBeVisible();
  const input = page.getByLabel("서비스 또는 공개 저장소 링크", { exact: true });
  await input.fill("https://github.com/example/project");
  await page.reload();
  await expect(input).toHaveValue("https://github.com/example/project");
  // The isolated server has no AI key. A missing configuration must not be
  // presented as a working generation button or trigger a paid request.
  await expect(page.getByRole("button", { name: "내 프로젝트 질문 받기" })).toBeDisabled();
});

test("mock analysis survives navigation and reload without a duplicate generation", async ({
  page,
}) => {
  let id = fixtureCheck.id;
  let status = "pending";
  let posts = 0;
  await page.route("**/api/project-check", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      id = route.request().postDataJSON().requestId;
      expect(route.request().headers().prefer).toBe("respond-async");
      return route.fulfill({ status: 202, json: { id, status: "pending" } });
    }
    return route.fulfill({
      json: {
        scope: "guest:ci-analysis",
        signedIn: false,
        aiReady: true,
        checks: [],
        usage: {
          analysis: { limit: 3, remaining: 3 },
          review: { limit: 2, remaining: 2 },
        },
      },
    });
  });
  await page.route("**/api/project-check/*/status", (route) => route.fulfill({ json: { status } }));
  await page.route("**/api/project-check/*", (route) =>
    route.request().url().endsWith("/status")
      ? route.fallback()
      : route.fulfill({ json: { ...fixtureCheck, id } }),
  );
  await page.goto("/project-check");
  await page
    .getByLabel("서비스 또는 공개 저장소 링크", { exact: true })
    .fill("https://example.com/");
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  const activity = page.getByRole("complementary", { name: "프로젝트 분석 상태" });
  await expect(activity.getByText("프로젝트 분석 중", { exact: true })).toBeVisible();
  await page.goto("/learn");
  await page.reload();
  await expect(activity.getByText("프로젝트 분석 중", { exact: true })).toBeVisible();
  expect(posts).toBe(1);
  status = "done";
  await expect(activity.getByText("프로젝트 분석이 완료됐어요", { exact: true })).toBeVisible();
  await activity.getByRole("link", { name: "분석 결과 보기 →" }).click();
  await expect(page).toHaveURL(new RegExp(`check=${id}`));
  await expect(
    page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("real project records and stale writes remain isolated after switching accounts", async ({
  page,
  context,
}) => {
  const source = await testAccount(databasePath, E2E_BASE_URL);
  const other = await testAccount(databasePath, E2E_BASE_URL);
  try {
    const id = await seedCheck(source);
    await login(context, source.cookie);
    await page.goto(`/project-check?check=${id}`);
    await expect(
      page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
    ).toBeVisible();
    expect(
      (
        await context.request.get(`/api/project-check/${id}`, {
          headers: { "X-Codefit-Workspace": source.owner },
        })
      ).status(),
    ).toBe(200);
    await login(context, other.cookie);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
    ).toHaveCount(0);
    expect(
      (
        await context.request.get(`/api/project-check/${id}`, {
          headers: { "X-Codefit-Workspace": other.owner },
        })
      ).status(),
    ).toBe(404);
    expect((await (await context.request.get("/api/project-check")).json()).checks).toEqual([]);
    const stale = await context.request.patch("/api/project-check", {
      headers: { "X-Codefit-Workspace": source.owner },
      data: { id, answers: Array(5).fill("이전 계정의 응답") },
    });
    expect(stale.status()).toBe(409);
    expect(await source.store.queries.projectChecks.get(source.owner, id)).not.toBeNull();
  } finally {
    source.store.db.close();
    other.store.db.close();
  }
});

test("a downloaded backup restores code and project records through account settings", async ({
  page,
  context,
}) => {
  const source = await testAccount(databasePath, E2E_BASE_URL);
  const target = await testAccount(databasePath, E2E_BASE_URL);
  try {
    source.store.db.prepare("DELETE FROM limits WHERE key LIKE 'import:%'").run();
    source.store.saveProgress(source.owner, "be-pagination", {
      code: "print('saved before backup')",
      baseRevision: 0,
    });
    const id = await seedCheck(source);
    await login(context, source.cookie);
    await page.goto("/");
    await page.getByRole("button", { name: "환경 설정" }).click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "내 학습 기록 내보내기", exact: true }).click();
    const path = await (await downloaded).path();
    const file = await readFile(path!);
    const backup = JSON.parse(file.toString());
    expect(backup.version).toBe(3);
    expect(backup.projects).toHaveLength(1);
    await login(context, target.cookie);
    await page.goto("/");
    await page.getByRole("button", { name: "환경 설정" }).click();
    await page
      .getByLabel("학습 기록 백업 파일")
      .setInputFiles({ name: "ci-backup.json", mimeType: "application/json", buffer: file });
    await expect(
      page.getByRole("dialog").getByRole("status").filter({ hasText: "백업을 가져왔습니다" }),
    ).toContainText("프로젝트 1개");
    expect(target.store.progressFor(target.owner, "be-pagination")?.code).toBe(
      "print('saved before backup')",
    );
    await page.goto(`/project-check?check=${restoredProjectId(target.owner, id)}`);
    await expect(
      page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
    ).toBeVisible();
    expect(await target.store.queries.projectChecks.get(target.owner, id)).toBeNull();
  } finally {
    source.store.db.close();
    target.store.db.close();
  }
});

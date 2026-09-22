import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureCheck } from "../src/lib/project-check/fixtures";

for (const width of [1440, 390]) {
  test(`analysis survives navigation and reload, then offers a result link at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    let id = fixtureCheck.id;
    let state = "pending";
    let posts = 0;
    let scope = "guest:background";
    const overview = () => ({
      scope,
      signedIn: false,
      aiReady: true,
      checks: [],
      usage: { analysis: { limit: 5, remaining: 5 }, review: { limit: 5, remaining: 5 } },
    });
    await page.route("**/api/project-check", async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        id = route.request().postDataJSON().requestId;
        expect(route.request().headers().prefer).toBe("respond-async");
        return route.fulfill({ status: 202, json: { id, status: "pending" } });
      }
      return route.fulfill({ json: overview() });
    });
    await page.route("**/api/project-check/*/status", (route) =>
      route.fulfill({ json: { status: state } }),
    );
    await page.route("**/api/project-check/*", (route) => {
      if (route.request().url().endsWith("/status")) return route.fallback();
      return route.fulfill({ json: { ...fixtureCheck, id } });
    });
    await page.goto("/project-check");
    await page
      .getByLabel("서비스 또는 공개 저장소 링크", { exact: true })
      .fill("https://example.com/");
    await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
    const activity = page.getByRole("complementary", { name: "프로젝트 분석 상태" });
    await expect(activity.getByText("프로젝트 분석 중", { exact: true })).toBeVisible();
    // A full document navigation is stricter than a client-side route change.
    await page.goto("/learn");
    await expect(activity).toBeVisible();
    await page.reload();
    await expect(activity.getByText("프로젝트 분석 중", { exact: true })).toBeVisible();
    expect(posts).toBe(1);
    state = "done";
    await expect(activity.getByText("프로젝트 분석이 완료됐어요", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/learn$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".analysis-activity")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await activity.screenshot({ path: `artifacts/background-analysis-${width}.png` });
    await activity.getByRole("link", { name: "분석 결과 보기 →" }).click();
    await expect(page).toHaveURL(new RegExp(`check=${id}`));
    await expect(activity).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "프로젝트 점검 순서" })).toBeVisible();

    // Restored tasks from another account must not expose their label or status.
    await page.evaluate(() =>
      sessionStorage.setItem(
        "codefit-analysis-tasks-v1",
        JSON.stringify([
          {
            id: "22222222-2222-4222-8222-222222222222",
            scope: "guest:background",
            label: "private-old-project",
            href: "/project-check?check=22222222-2222-4222-8222-222222222222",
            startedAt: Date.now(),
            status: "done",
          },
        ]),
      ),
    );
    scope = "user:different";
    await page.reload();
    await expect(activity).toHaveCount(0);
    expect(posts).toBe(1);
  });
}

test("failed analysis remains visible, status retry does not start another paid request", async ({
  page,
}) => {
  await page.route("**/api/project-check", (route) => {
    expect(route.request().method()).toBe("GET");
    return route.fulfill({
      json: {
        scope: "guest:failed",
        checks: [],
        aiReady: true,
        usage: { analysis: { remaining: 1 }, review: { remaining: 1 } },
      },
    });
  });
  await page.route("**/api/project-check/*/status", (route) =>
    route.fulfill({ json: { status: "failed" } }),
  );
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "codefit-analysis-tasks-v1",
      JSON.stringify([
        {
          id: "11111111-1111-4111-8111-111111111111",
          scope: "guest:failed",
          label: "example.com",
          href: "/project-check?check=11111111-1111-4111-8111-111111111111",
          startedAt: Date.now(),
          status: "pending",
        },
      ]),
    ),
  );
  await page.goto("/learn");
  const activity = page.getByRole("complementary", { name: "프로젝트 분석 상태" });
  await expect(activity.getByText("분석 상태 확인이 필요해요", { exact: true })).toBeVisible();
  await activity.getByRole("button", { name: "상태 확인", exact: true }).click();
  await expect(activity.getByText("분석 상태 확인이 필요해요", { exact: true })).toBeVisible();
  await activity.getByRole("button", { name: "example.com 분석 알림 닫기" }).click();
  await expect(activity).toHaveCount(0);
});

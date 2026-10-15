import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";

for (const width of [832, 390]) {
  test(`new project opens the registration form instead of a previous record at ${width}px`, async ({
    page,
  }) => {
    const scope = "visitor:registration-flow";
    const check = publicCheck(fixtureCheck);
    await page.setViewportSize({ width, height: 744 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(
      ({ scope, id }) => sessionStorage.setItem(`codefit-project-selection:${scope}`, id),
      { scope, id: check.id },
    );
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope,
          signedIn: false,
          aiReady: true,
          checks: [check],
          nextCursor: null,
          usage: {
            analysis: { limit: 3, remaining: 2, resetsAt: null },
            review: { limit: 2, remaining: 2, resetsAt: null },
          },
        },
      }),
    );
    await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
    await page.route(`**/api/project-check/${check.id}/thumbnail`, (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.goto("/projects");
    await page.getByRole("link", { name: "새 프로젝트 분석" }).click();
    await expect(page).toHaveURL(/project-check\?new=1#project-register$/);
    const heading = page.getByRole("heading", { name: "어떤 프로젝트를 살펴볼까요?" });
    const input = page.getByLabel("서비스 또는 공개 저장소 링크", { exact: true });
    const records = page.locator(".project-history-list");
    await expect(heading).toBeFocused();
    await expect(heading).toBeInViewport();
    await expect(input).toBeInViewport();
    await expect(records).not.toHaveAttribute("open");
    await expect(
      page.getByRole("heading", { name: check.analysis.title, exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("어떤 주소인가요?", { exact: true })).toBeFocused();
    await input.fill("https://github.com/example/new-project");

    // Collapsing old records must keep them reachable without erasing the new draft.
    await records.locator("summary").click();
    await records.getByRole("button", { name: new RegExp(check.analysis.title) }).click();
    await expect(
      page.getByRole("heading", { name: check.analysis.title, exact: true }),
    ).toBeFocused();
    await expect(page).toHaveURL(new RegExp(`check=${check.id}$`));
    await page.goto("/project-check");
    await expect(page).toHaveURL(new RegExp(`check=${check.id}$`));
    await expect(
      page.getByRole("heading", { name: check.analysis.title, exact: true }),
    ).toBeFocused();
    await page.getByRole("button", { name: "+ 새 프로젝트 점검", exact: true }).click();
    await expect(heading).toBeFocused();
    await expect(input).toBeInViewport();
    await expect(input).toHaveValue("https://github.com/example/new-project");
    await expect(records).not.toHaveAttribute("open");
    await page.reload();
    await expect(heading).toBeFocused();
    await expect(input).toHaveValue("https://github.com/example/new-project");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("the first-project link also opens the registration form", async ({ page }) => {
  await page.route("**/api/project-check", (route) =>
    route.fulfill({
      json: {
        scope: "visitor:first-project",
        signedIn: false,
        aiReady: true,
        checks: [],
        nextCursor: null,
        usage: {
          analysis: { limit: 3, remaining: 3, resetsAt: null },
          review: { limit: 2, remaining: 2, resetsAt: null },
        },
      },
    }),
  );
  await page.goto("/projects");
  await page.getByRole("link", { name: "첫 프로젝트 연결하기" }).click();
  await expect(page.getByRole("heading", { name: "어떤 프로젝트를 살펴볼까요?" })).toBeFocused();
  await expect(page.getByLabel("서비스 또는 공개 저장소 링크", { exact: true })).toBeInViewport();
});

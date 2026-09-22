import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";

for (const width of [1440, 390]) {
  test(`class loading, cancellation and deletion at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const scope = "user:class-actions";
    const pendingId = "22222222-2222-4222-8222-222222222222";
    let status = "pending";
    let removed = false;
    let failDelete = true;
    await page.addInitScript(
      ({ scope, pendingId }) => {
        sessionStorage.setItem(
          "codefit-analysis-tasks-v1",
          JSON.stringify([
            {
              id: pendingId,
              scope,
              label: "example.com/analysing",
              href: `/projects?class=${pendingId}`,
              startedAt: Date.now(),
              status: "pending",
            },
          ]),
        );
      },
      { scope, pendingId },
    );
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope,
          signedIn: true,
          aiReady: true,
          checks: removed ? [] : [fixtureCheck],
          usage: { analysis: { remaining: 4, limit: 5 }, review: { remaining: 5, limit: 5 } },
        },
      }),
    );
    await page.route(`**/api/project-check/${pendingId}/status`, (route) => {
      if (route.request().method() === "DELETE") status = "cancelled";
      return route.fulfill({ json: { status } });
    });
    await page.route(`**/api/projects/${fixtureCheck.id}`, (route) => {
      expect(route.request().method()).toBe("DELETE");
      if (failDelete)
        return route.fulfill({ status: 500, json: { error: "잠시 후 다시 시도해 주세요." } });
      removed = true;
      return route.fulfill({ json: { removed: true } });
    });
    await page.goto("/projects");
    const loading = page.locator(".class-loading-card");
    await expect(loading).toBeVisible();
    await expect(loading.getByText("분석 중", { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/class-actions-${width}.png`, fullPage: true });
    await loading.getByRole("button", { name: "분석 중단", exact: true }).click();
    const cancel = page.getByRole("dialog", { name: "분석을 중단할까요?" });
    const layout = await cancel.evaluate((dialog) => {
      const body = dialog.querySelector(".class-edit")!;
      const close = dialog.querySelector(".icon-button")!;
      const icon = close.querySelector("svg")!;
      const b = close.getBoundingClientRect(),
        i = icon.getBoundingClientRect();
      return {
        padding: parseFloat(getComputedStyle(body).paddingLeft),
        width: b.width,
        height: b.height,
        inset: Math.min(i.left - b.left, b.right - i.right, i.top - b.top, b.bottom - i.bottom),
      };
    });
    expect(layout.padding).toBeGreaterThanOrEqual(20);
    expect(Math.abs(layout.width - layout.height)).toBeLessThanOrEqual(1);
    expect(layout.inset).toBeGreaterThanOrEqual(8);
    await cancel.screenshot({
      animations: "disabled",
      path: `artifacts/modal-spacing-${width}.png`,
    });
    await cancel.getByRole("button", { name: "계속 분석" }).click();
    expect(status).toBe("pending");
    await loading.getByRole("button", { name: "분석 중단", exact: true }).click();
    await cancel.getByRole("button", { name: "분석 중단하기" }).click();
    await expect(loading).toHaveCount(0);
    await expect(page.getByText("분석을 중단했어요", { exact: true })).toBeVisible();
    const card = page.locator("article.class-list-card");
    await card.getByRole("button", { name: /클래스 삭제/ }).click();
    const dialog = page.getByRole("dialog", { name: "프로젝트 클래스를 삭제할까요?" });
    await dialog.getByRole("button", { name: "취소", exact: true }).click();
    expect(removed).toBe(false);
    await card.getByRole("button", { name: /클래스 삭제/ }).click();
    await dialog.getByRole("button", { name: "클래스 삭제하기" }).click();
    await expect(dialog.getByRole("alert")).toBeVisible();
    expect(removed).toBe(false);
    failDelete = false;
    await dialog.getByRole("button", { name: "클래스 삭제하기" }).click();
    await expect(card).toHaveCount(0);
    await expect(page.getByText("내 프로젝트가 나만의 수업이 됩니다")).toBeVisible();
  });
}

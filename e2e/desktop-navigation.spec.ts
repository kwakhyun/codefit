import { test, expect } from "@playwright/test";

for (const width of [1024, 1440]) {
  test(`desktop navigation stays consistent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "작업 공간 메뉴", exact: true });
    for (const name of [
      "내 프로젝트",
      "내 프로젝트 점검",
      "서비스 보안 점검",
      "AI 실무 배우기",
      "AI 코드 이해 훈련",
      "서비스 원리 배우기",
      "홈",
    ]) {
      const link = nav.getByRole("link", { name, exact: true });
      const href = await link.getAttribute("href");
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href === "/" ? "/" : href}$`));
      await expect(nav).toBeVisible();
      await expect(nav.locator('[aria-current="page"]')).toHaveText(name);
      expect(
        await page.locator("main").evaluate((element) => element.getBoundingClientRect().left),
      ).toBe(240);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
  });
}

test("mobile uses its menu without a duplicate desktop sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects");
  await expect(page.locator(".desktop-sidebar")).toBeHidden();
  await page.getByRole("button", { name: "메뉴", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("link", { name: "내 프로젝트 점검", exact: true }).click();
  await expect(page).toHaveURL(/\/project-check$/);
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

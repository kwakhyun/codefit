import { expect, test } from "@playwright/test";

test("problem list shortcuts survive repeated clicks, refresh and return from bookmarks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=browse");
  const library = page.locator("#problem-library");
  await expect(library).toBeVisible();
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByRole("link", { name: /전체 문제 탐색/ }).click();
    await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/\/\?view=browse$/);
    await expect(library).toBeVisible();
  }
  await page.reload();
  await expect(library).toBeVisible();
  await page.goto("/?view=bookmarks");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("link", { name: /전체 문제 탐색/ }).press("Enter");
  await expect(page).toHaveURL(/\/\?view=browse$/);
  await expect(library).toBeVisible();
});

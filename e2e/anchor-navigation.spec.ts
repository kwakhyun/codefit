import { expect, test } from "@playwright/test";

test("problem list shortcuts survive repeated clicks, refresh and return from bookmarks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/#problem-library");
  const library = page.locator("#problem-library");
  await expect(library).toBeInViewport();
  for (let repeat = 0; repeat < 2; repeat++) {
    await page.getByRole("button", { name: "메뉴 열기" }).click();
    await page.getByRole("link", { name: /문제 보관함 24/ }).click();
    await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
    await expect(page).toHaveURL(/\/#problem-library$/);
    await expect(library).toBeInViewport();
  }
  await page.reload();
  await expect(library).toBeInViewport();
  await page.goto("/?view=bookmarks");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("link", { name: /문제 보관함 24/ }).press("Enter");
  await expect(page).toHaveURL(/\/#problem-library$/);
  await expect(library).toBeInViewport();
});

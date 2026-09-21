import { test, expect } from "@playwright/test";

test("image skeleton covers initial and theme loading, then stops on success or error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", {
      value: { saveData: true },
      configurable: true,
    });
  });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/images/light/experience/project.webp", async (route) => {
    await pending;
    await route.continue();
  });
  await page.goto("/project-check", { waitUntil: "domcontentloaded" });
  const picture = page.locator(".section-artwork .theme-picture").first();
  await expect(picture).toHaveAttribute("data-image-state", "loading");
  await expect(picture.locator("img")).toHaveCSS("opacity", "0");
  const before = await picture.boundingBox();
  expect(before!.height).toBeGreaterThan(0);
  expect(await picture.evaluate((el) => getComputedStyle(el, "::after").animationName)).toBe(
    "none",
  );
  release();
  await expect(picture).toHaveAttribute("data-image-state", "loaded");
  const after = await picture.boundingBox();
  expect(after!.height).toBeCloseTo(before!.height, 0);
  await expect(picture.locator("img")).toHaveCSS("opacity", "1");
  let fail!: () => void;
  const blocked = new Promise<void>((resolve) => {
    fail = resolve;
  });
  await page.route("**/images/experience/project.webp", async (route) => {
    await blocked;
    await route.abort();
  });
  await page.getByRole("button", { name: "다크 모드", exact: true }).click();
  await expect(picture).toHaveAttribute("data-image-state", "loading");
  fail();
  await expect(picture).toHaveAttribute("data-image-state", "error");
  await page.getByRole("button", { name: "다크 모드", exact: true }).click();
  await expect(picture).toHaveAttribute("data-image-state", "loaded");
});

test("visible artwork prepares the alternate theme before a toggle", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "light" });
  const alternate = page.waitForRequest("**/images/experience/project.webp");
  await page.goto("/project-check");
  const picture = page.locator(".section-artwork .theme-picture").first();
  await picture.scrollIntoViewIfNeeded();
  await alternate;
  await page.getByRole("button", { name: "다크 모드", exact: true }).click();
  await expect(picture).toHaveAttribute("data-image-state", "loaded");
  await page.getByRole("button", { name: "다크 모드", exact: true }).click();
  await expect(picture).toHaveAttribute("data-image-state", "loaded");
});

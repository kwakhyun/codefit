import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
import { waitForUiTransitions } from "./ui-helpers";

for (const route of ["/", "/project-check", "/learn", "/handoff", "/login"]) {
  test(`compact header and themed artwork: ${route}`, async ({ page }, info) => {
    await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(route);
    const toggle = page.getByRole("button", { name: "다크 모드", exact: true });
    await expect(toggle).toHaveCount(1);
    await expect(page.locator("header .theme-select, .sidebar .theme-select")).toHaveCount(0);
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 950 });
      await expect(toggle).toBeInViewport();
      const box = await toggle.boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
      const header = await toggle.evaluate((button) => {
        const rect = button.closest("header")!.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom };
      });
      expect(box!.y).toBeGreaterThanOrEqual(header.top);
      expect(box!.y + box!.height).toBeLessThanOrEqual(header.bottom);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
    await page.setViewportSize({ width: 1440, height: 950 });
    const art = page.locator(".theme-picture img").filter({ visible: true }).first();
    await art.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        art.evaluate(
          (img: HTMLImageElement) =>
            img.complete &&
            img.naturalWidth > 0 &&
            decodeURIComponent(img.currentSrc).includes("/images/light/"),
        ),
      )
      .toBe(true);
    await page.screenshot({ path: info.outputPath("light.png") });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        art.evaluate(
          (img: HTMLImageElement) =>
            img.complete &&
            img.naturalWidth > 0 &&
            !decodeURIComponent(img.currentSrc).includes("/images/light/"),
        ),
      )
      .toBe(true);
    await toggle.focus();
    await page.keyboard.press("Space");
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await waitForUiTransitions(page);
    expect(
      (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations,
    ).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("all ten generated assets load and home artwork uses its matching light source", async ({
  page,
  request,
}) => {
  const manifest = JSON.parse(await readFile("docs/light-artwork-prompts.json", "utf8"));
  expect(manifest.assets).toHaveLength(10);
  for (const asset of manifest.assets) {
    const response = await request.get(asset.file.replace(/^public/, ""));
    expect(response.ok(), asset.file).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/webp");
  }
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.goto("/");
  // The first-visit workspace cards are the home artwork since the feature carousel was removed.
  const cards = page
    .getByRole("region", { name: "나에게 맞는 시작점" })
    .locator(".persona-art img");
  await expect(cards).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const img = cards.nth(i);
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        img.evaluate((image: HTMLImageElement) => {
          // Optimized images carry the file path in the url parameter of /_next/image.
          const file = (value: string) => {
            const url = new URL(value, location.href);
            return url.searchParams.get("url") ?? url.pathname;
          };
          return (
            image.complete &&
            image.naturalWidth > 0 &&
            file(image.currentSrc) ===
              file(image.getAttribute("src")!).replace("/images/", "/images/light/")
          );
        }),
      )
      .toBe(true);
  }
});

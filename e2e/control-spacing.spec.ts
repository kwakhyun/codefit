import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
for (const width of [1440, 390]) {
  test(`history toggles retain text gutters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "user:spacing",
          signedIn: true,
          aiReady: false,
          checks: [fixtureCheck],
          usage: { analysis: { limit: 5, remaining: 5 }, review: { limit: 5, remaining: 5 } },
        },
      }),
    );
    await page.goto("/project-check");
    const toggle = page.locator(".project-history-items .ui-toggle").first();
    await expect(toggle).toBeVisible();
    const spacing = await toggle.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(
        parseFloat,
      );
    });
    expect(spacing.every((value) => value >= 10)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/control-spacing-${width}.png`, fullPage: true });
  });
}

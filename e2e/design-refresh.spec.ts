import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const screens = [
  ["home", "/"],
  ["project", "/project-check"],
  ["security", "/security-check"],
  ["learn", "/learn"],
  ["mission", "/learn/private-board"],
  ["handoff", "/handoff"],
  ["code", "/problems/handoff-cart"],
  ["login", "/login"],
  ["profile", "/profile"],
  ["privacy", "/privacy"],
  ["quality", "/quality"],
  ["browse", "/?view=browse"],
] as const;
for (const [name, path] of screens) {
  test(`${name}: readable surfaces fit desktop and mobile`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      await page.evaluate(() => document.fonts.ready);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const violations = (
        await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze()
      ).violations;
      expect(
        violations.map((v) => ({
          id: v.id,
          nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
        })),
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/design-refresh/${name}-${width}.png`,
        fullPage: false,
      });
    }
  });
}

test("dialogs retain readable controls and keyboard dismissal", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page.getByRole("button", { name: "사용 안내", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze()).violations,
    ).toEqual([]);
    const box = await dialog.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `artifacts/design-refresh/dialog-${width}.png` });
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("mobile task navigation closes, restores focus and follows links", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/project-check");
  const trigger = page.getByRole("button", { name: "메뉴", exact: true });
  await expect(page.getByRole("navigation", { name: "서비스 메뉴", exact: true })).toBeHidden();
  await trigger.click();
  const menu = page.getByRole("dialog", { name: "어디로 이동할까요?" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("link", { name: "내 프로젝트 점검", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await menu.getByRole("link", { name: "서비스 보안 점검", exact: true }).click();
  await expect(page).toHaveURL(/\/security-check$/);
  await expect(menu).toBeHidden();
});

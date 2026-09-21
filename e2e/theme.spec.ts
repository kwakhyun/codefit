import { E2E_BASE_URL } from "../scripts/lib/e2e-environment";
import { expect, test } from "@playwright/test";
import { readCode } from "./editor-helpers";
import { waitForUiTransitions } from "./ui-helpers";
import AxeBuilder from "@axe-core/playwright";

const routes = [
  "/",
  "/?view=browse",
  "/?view=history",
  "/project-check",
  "/project-practice",
  "/security-check",
  "/learn",
  "/learn/private-board",
  "/learn/ai",
  "/learn/ai/project",
  "/learn/ai/langchain",
  "/problems/be-pagination",
  "/handoff",
  "/problems/handoff-cart",
  "/login",
  "/profile",
  "/privacy",
  "/quality",
];
for (const theme of ["light", "dark"] as const) {
  for (const path of routes) {
    test(`${theme} contrast and layout: ${path}`, async ({ page }, info) => {
      test.setTimeout(90000);
      await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
      await page.goto(path);
      await expect(page.locator("main").first()).toBeVisible();
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      await page.evaluate(() => document.fonts.ready);
      for (const width of [1440, 390]) {
        await page.setViewportSize({ width, height: 950 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        ).toBe(true);
        await waitForUiTransitions(page);
        const scan = await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze();
        expect
          .soft(
            scan.violations.map((v) => ({
              id: v.id,
              nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
            })),
          )
          .toEqual([]);
        await page.screenshot({ path: info.outputPath(`${theme}-${width}.png`) });
      }
    });
  }
}

test("preference persists, follows system changes, and syncs between tabs", async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/project-check");
  const select = page.getByRole("combobox", { name: "화면 테마" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await select.selectOption("dark");
  await page.reload();
  await expect(select).toHaveValue("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const other = await context.newPage();
  await other.goto("/project-check");
  await select.selectOption("light");
  await expect(other.locator("html")).toHaveAttribute("data-theme", "light");
  await select.selectOption("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await other.evaluate(() => localStorage.clear());
  await expect(select).toHaveValue("system");
});

test("storage failure still permits changing theme", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("Storage unavailable");
    };
    Storage.prototype.setItem = () => {
      throw new Error("Storage unavailable");
    };
  });
  await page.goto("/project-check");
  await page.getByRole("combobox", { name: "화면 테마" }).selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("editor follows theme without replacing the code", async ({ page }) => {
  await page.goto("/problems/be-pagination");
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible();
  const text = await readCode(page);
  await page.getByRole("combobox", { name: "화면 테마" }).first().selectOption("dark");
  await expect(editor).toHaveClass(/vs-dark/);
  await page.getByRole("combobox", { name: "화면 테마" }).first().selectOption("light");
  await expect(editor).not.toHaveClass(/vs-dark/);
  expect(await readCode(page)).toBe(text);
});

for (const theme of ["light", "dark"] as const) {
  test(`${theme} dialogs, keyboard focus, and mobile theme controls`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        "codefit-learning-preference-v2",
        JSON.stringify({ version: 3, type: "code" }),
      );
    });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "환경 설정", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "환경 설정" });
    await expect(dialog.getByRole("combobox", { name: "화면 테마" })).toHaveValue("system");
    await waitForUiTransitions(page);
    expect(
      (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations,
    ).toEqual([]);
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
    const select = page.getByRole("combobox", { name: "화면 테마" });
    await expect(select).toBeVisible();
    await select.selectOption(theme === "light" ? "dark" : "light");
    await waitForUiTransitions(page);
    expect(
      (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "환경 설정", exact: true }).focus();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("link", { name: "CODE:FIT_ 배우고, 이해하고, 검증하기" }),
    ).toBeFocused();
    await page.goto("/project-check");
    await page.getByRole("button", { name: "메뉴", exact: true }).click();
    await waitForUiTransitions(page);
    expect(
      (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations,
    ).toEqual([]);
  });

  test(`${theme} learning feedback and selected answers`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/learn/ai/langchain");
    await page.getByRole("button", { name: "선택하며 실습하기", exact: true }).click();
    await page.getByRole("radio").first().check();
    await expect(page.locator(".ai-feedback")).toBeVisible();
    await waitForUiTransitions(page);
    expect(
      (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations,
    ).toEqual([]);
    await page.getByRole("button", { name: "확인 문제 풀기" }).click();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "답 확인하기" }).click();
    await waitForUiTransitions(page);
    expect(
      (await new AxeBuilder({ page }).withRules(["color-contrast"]).analyze()).violations,
    ).toEqual([]);
  });

  test(`${theme} works before hydration and without JavaScript`, async ({ browser }) => {
    const context = await browser.newContext({
      baseURL: E2E_BASE_URL,
      javaScriptEnabled: false,
      colorScheme: theme,
    });
    const page = await context.newPage();
    await page.goto("/privacy");
    await expect(page.locator("body")).toHaveCSS(
      "color",
      theme === "light" ? "rgb(24, 35, 52)" : "rgb(240, 243, 248)",
    );
    await context.close();
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`${theme} banner actions retain contrast on hover and focus`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    const banner = page.getByRole("region", { name: "코드핏 핵심 기능" });
    await expect(banner).toBeVisible();
    const tabs = banner.locator(".feature-topic-rail button");
    for (let index = 0; index < (await tabs.count()); index++) {
      await tabs.nth(index).click();
      const action = banner.locator(".feature-slide.is-active .primary-button");
      await expect(banner.locator(".feature-slide.is-active .feature-art img")).toHaveCSS(
        "mix-blend-mode",
        theme === "light" ? "normal" : "lighten",
      );
      await action.hover();
      await action.focus();
      await waitForUiTransitions(page);
      expect(
        (
          await new AxeBuilder({ page })
            .include(".feature-slide.is-active")
            .withRules(["color-contrast"])
            .analyze()
        ).violations,
      ).toEqual([]);
    }
  });
}

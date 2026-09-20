import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { testAccount } from "../scripts/lib/test-account";

test("custom category select supports keyboard, dismissal and mobile; guest login uses official icons", async ({
  page,
}, info) => {
  await page.goto("/learn");
  const combo = page.getByRole("combobox", { name: "기술 개념", exact: true });
  await combo.focus();
  await page.keyboard.press("Enter");
  await expect(combo).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(combo).toBeFocused();
  await expect(combo).not.toHaveText("모든 개념");
  const selected = await combo.innerText();
  await combo.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(combo).toHaveText(selected);
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  await combo.click();
  await page.keyboard.press("Tab");
  await expect(combo).toHaveAttribute("aria-expanded", "false");
  await page.setViewportSize({ width: 320, height: 740 });
  await combo.click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  const box = (await list.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(
    (await new AxeBuilder({ page }).include(".learn-filter-row").analyze()).violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "docs/images/custom-select-mobile.png" });
  await page.getByRole("option", { name: "모든 개념", exact: true }).click();
  await page.getByRole("link", { name: "간편 로그인하고 AI 기능 사용하기" }).click();
  await expect(page).toHaveURL(/login\?returnTo=%2Flearn/);
  for (const provider of ["google", "github"]) {
    const icon = page.locator(`.oauth-button .provider-${provider}`);
    await expect(icon).toBeVisible();
    expect(
      await icon.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0),
    ).toBe(true);
  }
});

test("member generator selects work inside a modal and guest CTA stays hidden", async ({
  page,
  context,
  baseURL,
}) => {
  const fixture = await testAccount(
    resolve(process.env.CODEFIT_PROJECT_TEST_DB || "artifacts/e2e.sqlite"),
    baseURL!,
  );
  try {
    const [name, ...parts] = fixture.cookie.split("=");
    await context.addCookies([
      { name, value: parts.join("="), url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/?generate=1");
    const modal = page.getByRole("dialog");
    const domain = modal.getByRole("combobox", { name: "분야", exact: true });
    await domain.click();
    await modal.getByRole("option", { name: "백엔드", exact: true }).click();
    await expect(domain).toHaveText("백엔드");
    const language = modal.getByRole("combobox", { name: "언어 / 기술", exact: true });
    await language.click();
    await expect(modal.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(modal).toBeVisible();
    await expect(language).toBeFocused();
    await expect(page.locator(".guest-login")).toHaveCount(0);
    await modal.getByRole("button", { name: "닫기", exact: true }).click();
    await page.goto("/learn");
    await expect(
      page.getByText(
        "학습 기록은 계정에 저장됩니다. 같은 계정으로 로그인하면 다른 기기에서도 이어서 볼 수 있습니다.",
      ),
    ).toBeVisible();
    await expect(page.locator(".guest-login")).toHaveCount(0);
  } finally {
    fixture.store.db.close();
  }
});

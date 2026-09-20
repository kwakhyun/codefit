import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MISSIONS, actionLabel } from "../src/lib/learn/catalog";
import { SERVICE_DOMAINS, domainFor } from "../src/lib/learn/services/domains";

test("domain and concept filters work together, restore all cards, and keep keyboard focus", async ({
  page,
}) => {
  await page.goto("/learn");
  const filters = page.getByRole("group", { name: "서비스 분야" });
  await expect(page.locator(".learn-card:visible")).toHaveCount(MISSIONS.length);
  for (const domain of SERVICE_DOMAINS) {
    const button = filters.getByRole("button", {
      name: new RegExp(domain.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    });
    await button.focus();
    await page.keyboard.press("Enter");
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".learn-card:visible")).toHaveCount(
      MISSIONS.filter((m) => domainFor(m) === domain.id).length,
    );
    const concept = MISSIONS.find((m) => m.service?.domain === domain.id)!.concept;
    await page.getByRole("combobox", { name: "기술 개념", exact: true }).click();
    await page.getByRole("option", { name: concept, exact: true }).click();
    await expect(page.locator(".learn-card:visible")).toHaveCount(
      MISSIONS.filter((m) => domainFor(m) === domain.id && m.concept === concept).length,
    );
  }
  await page.getByRole("link", { name: /서비스 오류 해결 3개/ }).click();
  await expect(page.locator("#labs")).toBeVisible();
  await expect(page.locator(".learn-card:visible")).toHaveCount(MISSIONS.length);
});

test("five service layouts support keyboard actions, history, 320px screens, and accessible names", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  for (const domain of SERVICE_DOMAINS) {
    const m = MISSIONS.find((m) => m.service?.domain === domain.id)!;
    await page.goto(`/learn/${m.id}`);
    await expect(page.getByRole("region", { name: "실습 상황과 기준" })).toContainText(
      m.service!.policy,
    );
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
    await page.keyboard.press("Escape");
    const service = page.getByRole("region", { name: "실습 서비스", exact: true });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await expect(service.locator(".sample-app")).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 390) {
        expect(
          (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
            .violations,
        ).toEqual([]);
      }
      if (info.project.name === "chromium" && width !== 320) {
        const intro = page.getByRole("button", { name: "첫 방문 안내 숨기기" });
        if (await intro.isVisible()) await intro.click();
        await service.screenshot({
          path: `artifacts/service-${domain.id}-${width}.png`,
          style: ".learn-steps, .guide-launcher { visibility: hidden !important; }",
        });
      }
    }
    const input = service.getByRole("button", { name: actionLabel(m, "case-edge"), exact: true });
    await input.focus();
    await page.keyboard.press("Enter");
    await expect(input).toHaveAttribute("aria-pressed", "true");
    await expect(input).toBeFocused();
    const submit = service.getByRole("button", {
      name: actionLabel(m, "case-submit"),
      exact: true,
    });
    await submit.focus();
    await page.keyboard.press("Enter");
    await expect(service.locator(".service-result")).toBeVisible();
    await service.getByRole("button", { name: "처리 이력 1", exact: true }).click();
    await expect(service.locator(".service-history li")).toHaveCount(1);
    await service.getByRole("button", { name: "상세 정보로 돌아가기" }).click();
    await service
      .getByRole("button", { name: actionLabel(m, "case-standard"), exact: true })
      .click();
    await expect(service.locator(".service-result")).toHaveCount(0);
    await expect(service.getByRole("button", { name: "처리 이력 1", exact: true })).toBeVisible();
  }
});

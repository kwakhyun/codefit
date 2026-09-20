import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MISSIONS } from "../src/lib/learn/catalog";
import { experimentSteps } from "../src/lib/learn/simulation-guide";
import { verification } from "../src/lib/learn/simulation";

for (const mission of MISSIONS) {
  test(`${mission.id}: real controls drive the spotlight and repaired experiment`, async ({
    page,
  }) => {
    await page.goto(`/learn/${mission.id}`);
    await page.getByRole("radio", { name: mission.choices[0], exact: true }).check();
    await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
    const app = page.getByRole("region", { name: "실습 서비스", exact: true });
    const steps = experimentSteps(mission);
    await expect(page.locator(".experiment-spotlight-ring")).toBeVisible();
    expect(
      await page
        .locator(".experiment-spotlight-ring")
        .evaluate((el) => getComputedStyle(el, "::after").animationName),
    ).toBe("experiment-pulse");
    const requiredSteps = steps.filter((step) => !step.optional);
    for (let i = 0; i < requiredSteps.length; i++) {
      await expect(app.locator(".experiment-guide-bar")).toHaveAttribute(
        "data-guide-step",
        String(i),
      );
      const button = app.locator(`[data-sim-action="${steps[i].action}"]`);
      await expect(button).toHaveAttribute("aria-describedby", /.+/);
      const target = await button.boundingBox();
      const card = await page.locator(".experiment-spotlight-card").boundingBox();
      expect(
        target &&
          card &&
          (target.y + target.height <= card.y ||
            card.y + card.height <= target.y ||
            target.x + target.width <= card.x ||
            card.x + card.width <= target.x),
        `guide should not obscure ${steps[i].action}`,
      ).toBe(true);
      await button.click();
    }
    await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
    await expect(app).toContainText("필수 실험을 마쳤습니다");
    await expect(page.getByRole("region", { name: "실험 결과 요약" })).toContainText(
      mission.lesson,
    );
    await expect(page.getByRole("heading", { name: "이번 실험에서 배운 원리" })).toBeFocused();
    await expect(page.getByText("그림으로 원리 살펴보기", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "3. 수정과 검사로 이동" }).click();
    const good = mission.fixes.find((fix) =>
      verification(mission, fix.id).every((check) => check.passed),
    )!;
    await page.getByRole("radio", { name: `${good.title} ${good.detail}`, exact: true }).check();
    await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
    await page.getByText("수정안이 적용된 서비스 사용해 보기", { exact: true }).click();
    await expect(app.locator(".experiment-guide-bar")).toContainText("수정 후 재실험");
    await expect(page.getByTestId("experiment-spotlight")).toBeVisible();
    await page.getByText("수정안이 적용된 서비스 사용해 보기", { exact: true }).click();
    await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
    await page.getByText("수정안이 적용된 서비스 사용해 보기", { exact: true }).click();
    await expect(page.getByTestId("experiment-spotlight")).toBeVisible();
    for (const step of steps.filter((s) => !s.optional))
      await app.locator(`[data-sim-action="${step.action}"]`).click();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
  });
}

test("mobile spotlight is dismissible, follows history tabs, survives reload and respects reduced motion", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const mission = MISSIONS.find((m) => m.id === "shop-coupon")!;
  await page.goto(`/learn/${mission.id}`);
  await page.getByRole("radio", { name: mission.choices[0], exact: true }).check();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  const app = page.getByRole("region", { name: "실습 서비스", exact: true });
  await expect(page.locator(".experiment-spotlight-ring")).toBeVisible();
  expect(
    await page
      .locator(".experiment-spotlight-ring")
      .evaluate((el) => getComputedStyle(el, "::after").animationName),
  ).toBe("none");
  await page.getByRole("button", { name: "버튼 위치로 이동" }).click();
  await expect(app.locator('[data-sim-action="case-edge"]')).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(app.locator(".experiment-guide-bar")).toHaveAttribute("data-guide-step", "1");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
  await app.getByRole("button", { name: "처리 이력" }).click();
  await app.getByRole("button", { name: "조작 안내 다시 보기" }).click();
  await expect(page.getByRole("complementary", { name: "실습 조작 안내" })).toContainText(
    "상세 정보로 돌아가",
  );
  await app.getByRole("button", { name: "상세 정보", exact: true }).click();
  await expect(app.locator('[data-sim-action="case-submit"]')).toHaveAttribute(
    "aria-describedby",
    /.+/,
  );
  const targetBox = await app.locator('[data-sim-action="case-submit"]').boundingBox();
  expect(targetBox!.y).toBeGreaterThanOrEqual(0);
  expect(targetBox!.y + targetBox!.height).toBeLessThanOrEqual(740);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/experiment-guide-mobile.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "학습 기록 저장", exact: true }).click();
  await expect(page.getByText("학습 기록 저장됨", { exact: true })).toBeVisible();
  await page.reload();
  await expect(app.locator(".experiment-guide-bar")).toHaveAttribute("data-guide-step", "1");
  await app.locator('[data-sim-action="case-standard"]').click();
  await expect(app.locator(".experiment-guide-bar")).toHaveAttribute("data-guide-step", "0");
  await app.locator('[data-sim-action="case-submit"]').click();
  await expect(page.getByRole("button", { name: "3. 수정과 검사로 이동" })).toHaveCount(0);
});

import { expect, test } from "@playwright/test";
import { MISSIONS } from "../src/lib/learn/catalog";
import { experimentSteps } from "../src/lib/learn/simulation-guide";
import { verification } from "../src/lib/learn/simulation";
import { LEARNING_STAGES } from "../src/lib/learn/overview";

test("search typing preserves focus without fading the entire screen", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.id === "main-content") {
        document.documentElement.dataset.fadeCount = String(
          Number(document.documentElement.dataset.fadeCount || 0) + 1,
        );
      }
      return original.call(this, frames, options);
    };
  });
  await page.goto("/?view=browse");
  const search = page.getByRole("textbox", { name: "문제 검색" });
  await expect(search).toBeVisible();
  const before = await page.locator("html").getAttribute("data-fade-count");
  await search.pressSequentially("react", { delay: 100 });
  await expect(page).toHaveURL(/q=react/);
  await expect(search).toBeFocused();
  expect(await page.locator("html").getAttribute("data-fade-count")).toBe(before);
  await page.getByRole("button", { name: "검색어 지우기" }).click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  expect(await page.locator("html").getAttribute("data-fade-count")).toBe(before);
});

test("guide dismissal and optional experiments keep keyboard focus on a real control", async ({
  page,
}) => {
  const mission = MISSIONS.find((item) => item.id === "where-data-lives")!;
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/learn/${mission.id}`);
  await page.getByRole("radio", { name: mission.choices[0], exact: true }).check();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  const app = page.getByRole("region", { name: "실습 서비스", exact: true });
  const steps = experimentSteps(mission);
  const first = app.locator(`[data-sim-action="${steps[0].action}"]`);
  const close = page.getByRole("button", { name: "실습 조작 안내 닫기" });
  await close.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
  await expect(first).toBeFocused();
  await app.getByRole("button", { name: "조작 안내 다시 보기" }).click();
  await close.focus();
  await page.keyboard.press("Escape");
  await expect(first).toBeFocused();
  await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
  for (const step of steps.filter((item) => !item.optional)) {
    await app.locator(`[data-sim-action="${step.action}"]`).click();
  }
  await app.getByRole("button", { name: "선택 실험 이어하기" }).click();
  await expect(
    app.locator(`[data-sim-action="${steps.find((item) => item.optional)!.action}"]`),
  ).toBeFocused();
  await expect(page.getByTestId("experiment-spotlight")).toBeVisible();
  await page.getByRole("button", { name: "기록 내려받고 관찰 다시 시작" }).click();
  for (const step of steps.filter((item) => !item.optional)) {
    await app.locator(`[data-sim-action="${step.action}"]`).click();
  }
  await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "이번 실험에서 배운 원리" })).toBeFocused();
});

test("repair explains every blocked step and enables the next step only after passing checks", async ({
  page,
}) => {
  const mission = MISSIONS.find((item) => item.id === "where-data-lives")!;
  await page.goto(`/learn/${mission.id}`);
  await page.getByRole("radio", { name: mission.choices[0], exact: true }).check();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  const app = page.getByRole("region", { name: "실습 서비스", exact: true });
  for (const step of experimentSteps(mission).filter((item) => !item.optional)) {
    await app.locator(`[data-sim-action="${step.action}"]`).click();
  }
  await page.getByRole("button", { name: "3. 수정과 검사로 이동" }).click();
  const hint = page.locator(".repair-next-step");
  const next = hint.getByRole("button", { name: "다른 상황에 적용하기 →" });
  await expect(next).toBeDisabled();
  await expect(hint).toContainText("먼저 적용할 수정안을 하나 선택하세요.");
  const bad = mission.fixes.find((fix) =>
    verification(mission, fix.id).some((check) => !check.passed),
  )!;
  await page.getByRole("radio", { name: `${bad.title} ${bad.detail}`, exact: true }).check();
  await expect(hint).toContainText("아직 실행하지 않은 검사");
  const failed = verification(mission, bad.id).find((check) => !check.passed)!;
  await page.getByRole("button", { name: `${failed.label} 검사`, exact: true }).click();
  await expect(hint).toContainText("다른 수정안을 선택하고 다시 검사하세요.");
  await expect(next).toBeDisabled();
  const good = mission.fixes.find((fix) =>
    verification(mission, fix.id).every((check) => check.passed),
  )!;
  await page.getByRole("radio", { name: `${good.title} ${good.detail}`, exact: true }).check();
  for (const check of verification(mission, good.id)) {
    await page.getByRole("button", { name: `${check.label} 검사`, exact: true }).click();
  }
  await expect(hint).toContainText("모든 검사를 통과했습니다.");
  await expect(next).toBeEnabled();
  await next.click();
  await expect(
    page.getByRole("heading", { name: `4. ${LEARNING_STAGES[3]}`, exact: true }),
  ).toBeFocused();
});

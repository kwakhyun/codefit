import { expect, test } from "@playwright/test";
import { MISSIONS } from "../src/lib/learn/catalog";
import { handoffProblems } from "../src/data/handoff-problems";
import { setCode } from "./editor-helpers";

for (const id of ["booking-capacity", "shop-coupon"]) {
  test(`${id}: separates requirements from faulty results and reruns the repaired input`, async ({
    page,
  }, info) => {
    const mission = MISSIONS.find((m) => m.id === id)!;
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/learn/${id}`);
    const brief = page.getByRole("region", { name: "실습 상황과 기준" });
    await expect(brief).toContainText(mission.service!.policy);
    await expect(brief).toContainText(mission.service!.samples[1].fields[0][1]);
    await expect(page.locator("[data-sim-action]")).toHaveCount(0);
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
    const app = page.getByRole("region", { name: "실습 서비스", exact: true });
    await app.locator('[data-sim-action="case-edge"]').click();
    await app.locator('[data-sim-action="case-submit"]').click();
    await expect(app.locator(".service-result")).toContainText("이용 조건과 다른 결과");
    await expect(app.locator(".service-result")).toHaveClass(/rejected/);
    const summary = page.getByRole("region", { name: "실험 결과 요약" });
    await expect(summary).toContainText("실제 동작");
    await expect(summary).toContainText("지켜야 할 동작");
    await page.screenshot({ path: `artifacts/clarity-${id}-${info.project.name}.png` });
    await summary.getByRole("button", { name: "3. 수정과 검사로 이동" }).click();
    await page.getByRole("radio", { name: /처리 규칙 수정/ }).check();
    await page.getByText("수정안이 적용된 서비스 사용해 보기", { exact: true }).click();
    await app.locator('[data-sim-action="case-edge"]').click();
    await app.locator('[data-sim-action="case-submit"]').click();
    await page.keyboard.press("Escape");
    await expect(app.locator(".service-result")).toContainText("이 사례는 이용 조건과 일치");
    // A rejected business request is a correct result when the policy forbids it.
    await expect(app.locator(".service-result")).toHaveClass(/accepted/);
    await app.locator('[data-sim-action="case-standard"]').click();
    await expect(app.locator(".service-result")).toHaveCount(0);
    await app.locator('[data-sim-action="case-submit"]').click();
    await expect(app.locator(".service-result")).toContainText("이 사례는 이용 조건과 일치");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("code training leads from observed output to a current test and explanation without optional tools", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/problems/handoff-cart");
  await expect(page.locator(".lab-purpose")).toContainText("이전 장바구니");
  await expect(page.locator(".lab-source details")).toHaveAttribute("open", "");
  await page.getByRole("radio", { name: "원본 2, 반환값 3" }).check();
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.getByLabel("원본 실행 반환값")).toHaveText("[3,3]");
  await expect(page.locator(".lab-optional-tools")).not.toHaveAttribute("open", "");
  await expect(page.getByRole("button", { name: "내 예상에 맞는 AI 질문 받기" })).not.toBeVisible();
  await page.screenshot({
    path: `artifacts/clarity-code-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "내 코드 수정하고 테스트하기" }).click();
  await expect(page.getByRole("region", { name: "수정할 목표" })).toContainText(
    "입력 배열과 객체는 변경하지 않는다",
  );
  const next = page.getByRole("button", { name: "실행 결과를 바탕으로 설명 정리하기" });
  await expect(next).toBeDisabled();
  await setCode(page, handoffProblems.find((p) => p.id === "handoff-cart")!.solution);
  await page.getByRole("button", { name: "내 코드 테스트", exact: true }).click();
  await expect(page.locator(".lab-test-next")).toContainText("제공된 사례를 모두 통과");
  await expect(next).toBeEnabled();
  await next.click();
  await expect(page.getByRole("heading", { name: "4. 설명하기", exact: true })).toBeFocused();
  await expect(page.locator("#handoff-understanding")).toBeVisible();
});

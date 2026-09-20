import { expect, test } from "@playwright/test";
import { MISSIONS } from "../src/lib/learn/catalog";
import { experimentSteps } from "../src/lib/learn/simulation-guide";

for (const id of ["where-data-lives", "broken-memo", "shop-coupon"]) {
  test(`${id}: completing the required experiment reveals the lesson and next action on mobile`, async ({
    page,
  }, info) => {
    const mission = MISSIONS.find((item) => item.id === id)!;
    expect(mission).toBeTruthy();
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto(`/learn/${id}`);
    await expect(page.getByText("그림으로 원리 살펴보기", { exact: true })).toHaveCount(0);
    await page.getByRole("radio", { name: mission.choices[0], exact: true }).check();
    await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
    const app = page.getByRole("region", { name: "실습 서비스", exact: true });
    for (const step of experimentSteps(mission).filter((s) => !s.optional)) {
      await app.locator(`[data-sim-action="${step.action}"]`).click();
    }
    const summary = page.getByRole("region", { name: "실험 결과 요약" });
    await expect(summary).toContainText(mission.lesson);
    await expect(page.getByRole("heading", { name: "이번 실험에서 배운 원리" })).toBeFocused();
    await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
    const next = summary.getByRole("button", { name: "3. 수정과 검사로 이동" });
    const headingBox = (await page
      .getByRole("heading", { name: "이번 실험에서 배운 원리" })
      .boundingBox())!;
    const navBox = (await page.getByRole("navigation", { name: "입문 미션 단계" }).boundingBox())!;
    expect(headingBox.y).toBeGreaterThanOrEqual(navBox.y + navBox.height);
    const box = (await next.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(740);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (mission.app === "request") await expect(summary).toContainText("오프라인 상태");
    if (info.project.name === "chromium")
      await page.screenshot({ path: `artifacts/observation-outcome-${id}.png` });
    await next.click();
    await expect(page.getByRole("heading", { name: "3. 수정과 검사", exact: true })).toBeFocused();
    await page
      .getByRole("navigation", { name: "입문 미션 단계" })
      .getByRole("button", { name: "2 직접 확인" })
      .click();
    await expect(summary).toContainText(mission.lesson);
    // Returning to this step does not restart the spotlight or discard the observation.
    await expect(page.getByTestId("experiment-spotlight")).toHaveCount(0);
  });
}

import { test, expect } from "@playwright/test";
for (const type of ["starter", "coder", "maker", "builder"]) {
  test(`${type}: project checks precede supplementary learning`, async ({ page }) => {
    await page.addInitScript((type) => {
      localStorage.setItem("codefit-learning-preference-v2", JSON.stringify({ version: 2, type }));
    }, type);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const project = page.getByRole("region", { name: "코드핏 핵심 기능" });
    await expect(project).toBeVisible();
    await expect(page.getByRole("region", { name: "내 프로젝트 점검 이어하기" })).toHaveCount(0);
    await expect(page.locator(".feature-banner")).toContainText("내가 만든 서비스로");
    await expect(page.getByRole("region", { name: "추천 첫 학습" })).toHaveCount(0);
    const p = await project.boundingBox();
    const secondary = await page.locator(".persona-next-steps").boundingBox();
    expect(p!.y).toBeLessThan(secondary!.y);
    await page.goto("/learn");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "내 서비스 점검을 돕는 보조 실습",
    );
    const labs = await page.locator("#labs").boundingBox();
    const basics = await page.locator("#basics").boundingBox();
    expect(labs!.y).toBeLessThan(basics!.y);
  });
}

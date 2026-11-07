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
      "서비스가 동작하는 이유를 확인해 보세요",
    );
    // A first visit opens project practice; samples stay one click away.
    await expect(page.getByRole("button", { name: "내 프로젝트로 연습" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "샘플로 체험" }).click();
    // Sections follow the recommended order: the first recommended mission is a basics mission.
    const basics = await page.locator("#basics").boundingBox();
    const labs = await page.locator("#labs").boundingBox();
    expect(basics!.y).toBeLessThan(labs!.y);
  });
}

test("practice tab follows ?source, stays in the URL and is remembered", async ({ page }) => {
  const sample = page.getByRole("button", { name: "샘플로 체험" });
  const project = page.getByRole("button", { name: "내 프로젝트로 연습" });
  await page.goto("/learn");
  await sample.click();
  await expect(page).toHaveURL(/\/learn\?source=sample$/);
  await page.goto("/learn");
  await expect(sample).toHaveAttribute("aria-pressed", "true");
  await page.goto("/learn?source=project");
  await expect(project).toHaveAttribute("aria-pressed", "true");
  await project.click();
  await page.goto("/learn#labs");
  // Links into a sample section open the sample tab.
  await expect(sample).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#labs")).toBeVisible();
  await page.goto("/handoff");
  await expect(page.getByRole("button", { name: "내 프로젝트로 연습" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

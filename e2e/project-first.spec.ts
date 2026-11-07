import { test, expect } from "@playwright/test";
const migrated = { starter: "ai", coder: "code", maker: "service", builder: "service" } as const;
for (const [type, workspace] of Object.entries(migrated)) {
  test(`${type}: a saved legacy choice opens its workspace home, project check first`, async ({
    page,
  }) => {
    await page.addInitScript((type) => {
      localStorage.setItem("codefit-learning-preference-v2", JSON.stringify({ version: 2, type }));
    }, type);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await expect(page.locator(".workspace-home")).toHaveAttribute("data-learner-type", workspace);
    // A returning visitor no longer sees the first-visit overview.
    await expect(page.getByRole("region", { name: "이런 기능도 있어요" })).toHaveCount(0);
    if (workspace !== "service") return;
    const project = await page.getByRole("region", { name: "서비스 점검 시작" }).boundingBox();
    const secondary = await page.locator(".workspace-secondary").boundingBox();
    expect(project!.y).toBeLessThan(secondary!.y);
  });
}

test("a first visit to 서비스 원리 배우기 opens project practice; samples follow the recommended order", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
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

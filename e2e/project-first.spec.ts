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

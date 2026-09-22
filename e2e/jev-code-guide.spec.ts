import { test, expect } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";

for (const width of [390, 1280]) {
  test(`reading guide opens original code and survives reopening at ${width}px`, async ({
    page,
  }) => {
    const evidence = "src/save.ts:L1 await store.save(order);";
    const check = {
      ...fixtureCheck,
      analysis: {
        ...fixtureCheck.analysis,
        codeGuide: [{ title: "데이터를 저장하거나 불러오는 곳", evidence }],
      },
      page: {
        ...fixtureCheck.page,
        source: "repository",
        repository: {
          name: "example/orders",
          commit: "a".repeat(40),
          totalFiles: 1,
          eligibleFiles: 1,
          omittedFiles: 0,
          truncatedTree: false,
          links: [],
          files: [
            {
              path: "src/save.ts",
              lines: [{ number: 1, text: "await store.save(order);" }],
              totalLines: 1,
              partial: false,
            },
          ],
        },
      },
    };
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "guest:guide-test",
          signedIn: false,
          aiReady: true,
          checks: [],
          nextCursor: null,
          usage: { analysis: { remaining: 2, limit: 2 }, review: { remaining: 2, limit: 2 } },
        },
      }),
    );
    await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`/project-check?check=${check.id}`);
    const guide = page.getByRole("region", { name: "먼저 살펴볼 코드" });
    await page.getByText("분석 자료와 코드 지도 자세히 보기", { exact: true }).click();
    await expect(guide).toBeVisible();
    await guide.locator("summary").click();
    await expect(guide.locator("pre")).toContainText("await store.save(order);");
    await expect(guide.getByRole("link")).toHaveAttribute("href", /src\/save.ts/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/jev-live/guide-${width}.png`, fullPage: true });
    await page.reload();
    await page.getByText("분석 자료와 코드 지도 자세히 보기", { exact: true }).click();
    await expect(guide).toBeVisible();
  });
}

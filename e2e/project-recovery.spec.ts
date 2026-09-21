import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
for (const kind of ["practice", "workshop"] as const) {
  test(`${kind} offers saved-result recovery with no allowance and AI offline`, async ({
    page,
  }) => {
    const id = fixtureCheck.id;
    const check = {
      ...fixtureCheck,
      page: {
        ...fixtureCheck.page,
        source: "repository",
        repository: {
          name: "owner/repo",
          commit: "a".repeat(40),
          files: [],
          links: [],
          totalFiles: 0,
          eligibleFiles: 0,
          omittedFiles: 0,
          truncatedTree: false,
        },
      },
    };
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "visitor:recovery",
          signedIn: false,
          aiReady: false,
          checks: [],
          nextCursor: null,
          usage: {
            analysis: { limit: 3, remaining: 0, resetsAt: null },
            review: { limit: 2, remaining: 2, resetsAt: null },
          },
        },
      }),
    );
    await page.route(`**/api/project-check/${id}`, (route) => route.fulfill({ json: check }));
    let calls = 0;
    await page.route(`**/api/project-check/${id}/${kind}**`, (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: { result: null, completed: 2, canRecover: true } });
      calls++;
      return route.fulfill({ status: 503, json: { error: "복구 요청 확인" } });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(
      kind === "practice"
        ? `/project-practice?mode=code&check=${id}`
        : `/learn/ai/project?check=${id}`,
    );
    await expect(page.getByRole("button", { name: "저장된 결과 복구" })).toBeEnabled();
    await page.getByRole("button", { name: "저장된 결과 복구" }).click();
    await expect(page.getByText("복구 요청 확인", { exact: true })).toBeVisible();
    expect(calls).toBe(1);
  });
}

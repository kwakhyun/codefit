import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
const id = fixtureCheck.id;
const check = {
  ...fixtureCheck,
  page: {
    ...fixtureCheck.page,
    source: "repository",
    repository: {
      name: "owner/repo",
      commit: "a".repeat(40),
      totalFiles: 1,
      eligibleFiles: 1,
      omittedFiles: 0,
      truncatedTree: false,
      links: [],
      files: [
        {
          path: "main.ts",
          totalLines: 1,
          partial: false,
          lines: [{ number: 1, text: "return previous;" }],
        },
      ],
    },
  },
};
for (const kind of ["practice", "workshop"]) {
  test(`${kind} generation continues after client navigation with completion notice`, async ({
    page,
  }) => {
    let posts = 0;
    let done = false;
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const task = {
      title: "기존 결과 확인",
      purpose: "반환 흐름 이해",
      situation: "기존 결과가 있습니다.",
      assumptions: "previous에 값이 있습니다.",
      evidence: ["main.ts:L1 return previous;"],
      question: "어떤 값을 반환하나요?",
      choices: ["기존 결과", "새 결과"],
      answer: 0,
      walkthrough: [
        { action: "값 확인", result: "기존 값" },
        { action: "반환", result: "기존 결과" },
      ],
      explanation: "기존 결과를 반환합니다.",
      verification: "반환값 확인",
    };
    const result =
      kind === "practice"
        ? {
            exercises: { code: Array(3).fill(task), service: Array(3).fill(task) },
            progress: { code: [], service: [] },
            revision: 0,
            createdAt: fixtureCheck.createdAt,
          }
        : {
            plan: {
              summary: "코드에 맞는 AI 활용 방법",
              limitations: "수집한 코드 범위",
              topics: [],
            },
            responses: [],
            revision: 0,
            createdAt: fixtureCheck.createdAt,
          };
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "user:generation",
          signedIn: true,
          aiReady: true,
          checks: [check],
          usage: { analysis: { limit: 5, remaining: 5 }, review: { limit: 5, remaining: 5 } },
        },
      }),
    );
    await page.route(`**/api/project-check/${id}`, (route) => route.fulfill({ json: check }));
    await page.route(`**/api/project-check/${id}/thumbnail`, (route) =>
      route.fulfill({ status: 204 }),
    );
    await page.route(`**/api/project-check/${id}/${kind}**`, async (route) => {
      if (route.request().method() === "POST") {
        posts++;
        if (posts === 1) {
          await hold;
          return route.fulfill({
            json: { status: "pending", completed: 1, total: 2, label: "첫 단계 저장" },
          });
        }
        done = true;
        return route.fulfill({ json: { status: "done", result } });
      }
      return route.fulfill({
        json: { result: done ? result : null, completed: done ? 2 : 0, canRecover: false },
      });
    });
    await page.goto(
      kind === "practice"
        ? `/project-practice?check=${id}&mode=service`
        : `/learn/ai/project?check=${id}`,
    );
    await page
      .getByRole("button", {
        name: kind === "practice" ? "맞춤 연습 6개 만들기" : "AI 활용 학습 만들기",
        exact: true,
      })
      .click();
    const activity = page.getByRole("region", { name: "생성 작업 상태" });
    await expect(activity).toBeVisible();
    await page
      .getByRole("navigation", { name: "작업 공간 메뉴" })
      .getByRole("link", { name: "내 프로젝트", exact: true })
      .click();
    await expect(page).toHaveURL(/\/projects$/);
    expect(posts).toBe(1);
    await expect(activity).toBeVisible();
    release();
    await expect(activity.getByText("완료됐어요", { exact: true })).toBeVisible();
    expect(posts).toBe(2);
    await page.screenshot({ path: `artifacts/generation-${kind}.png`, fullPage: true });
    const close = activity.getByRole("button", { name: /알림 닫기/ });
    const size = await close.boundingBox();
    expect(size!.width).toBeLessThanOrEqual(40);
    expect(size!.height).toBeLessThanOrEqual(40);
    await activity.getByRole("link", { name: "결과 확인하기 →" }).click();
    await expect(page).toHaveURL(
      kind === "practice" ? /project-practice\?check=/ : /learn\/ai\/project\?check=/,
    );
    await expect(activity).toHaveCount(0);
    expect(posts).toBe(2);
  });
}

for (const theme of ["light", "dark"]) {
  test(`learning card previews load in ${theme} mode`, async ({ page }) => {
    await page.emulateMedia({
      colorScheme: theme === "light" ? "light" : "dark",
      reducedMotion: "reduce",
    });
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "user:previews",
          signedIn: true,
          aiReady: true,
          checks: [check],
          usage: { analysis: { remaining: 5, limit: 5 }, review: { remaining: 5, limit: 5 } },
        },
      }),
    );
    await page.route(`**/api/projects/${id}`, (route) =>
      route.fulfill({ json: { check, practice: null, workshop: null } }),
    );
    await page.route(`**/api/projects/${id}/versions**`, (route) =>
      route.fulfill({ json: { checks: [], nextCursor: null } }),
    );
    await page.goto(`/projects?class=${id}`);
    const cards = page.locator(".class-tracks");
    await expect(cards.locator("img")).toHaveCount(4);
    await cards.scrollIntoViewIfNeeded();
    await expect
      .poll(() =>
        cards
          .locator("img")
          .evaluateAll((images) =>
            images.every((image) => (image as HTMLImageElement).naturalWidth > 0),
          ),
      )
      .toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await cards.screenshot({ path: `artifacts/class-track-previews-${theme}.png` });
  });
}

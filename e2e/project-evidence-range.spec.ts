import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { sourceLine } from "../src/lib/project-check/repository";

for (const width of [1280, 390]) {
  test(`project practice shows the complete cited decision at ${width}px`, async ({ page }) => {
    const lines = Array.from({ length: 20 }, (_, i) => ({
      number: i + 1,
      text: i === 14 ? "if (existing) return existing;" : `// context ${i + 1}`,
    }));
    const file = { path: "src/requests.ts", lines, totalLines: 20, partial: false };
    const evidence = lines
      .slice(0, 16)
      .map((l) => sourceLine(file.path, l.number, l.text))
      .join("\n");
    const check = {
      ...fixtureCheck,
      page: {
        ...fixtureCheck.page,
        source: "repository",
        repository: {
          name: "owner/example",
          commit: "a".repeat(40),
          totalFiles: 1,
          eligibleFiles: 1,
          omittedFiles: 0,
          truncatedTree: false,
          links: [],
          files: [file],
        },
      },
    };
    const task = {
      title: "이미 처리한 요청 다시 확인하기",
      purpose: "중복 저장을 피하는 흐름을 읽습니다.",
      situation: "같은 요청을 다시 보냈습니다.",
      assumptions: "기존 결과가 있습니다.",
      evidence: [evidence],
      question: "어떤 결과를 반환하나요?",
      choices: ["기존 결과", "새 결과"],
      answer: 0,
      walkthrough: [
        { action: "요청 확인", result: "기존 결과 발견" },
        { action: "결과 반환", result: "기존 결과 반환" },
      ],
      explanation: "기존 결과를 반환합니다.",
      verification: "테스트 환경에서 반환 결과를 비교합니다.",
    };
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "guest:test",
          signedIn: false,
          aiReady: true,
          checks: [],
          usage: { analysis: { remaining: 1, limit: 2 }, review: { remaining: 2, limit: 2 } },
        },
      }),
    );
    await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
    await page.route(`**/api/project-check/${check.id}/practice`, (route) =>
      route.fulfill({
        json: {
          exercises: { code: Array(3).fill(task), service: Array(3).fill(task) },
          progress: { code: [], service: [] },
          revision: 0,
          createdAt: check.createdAt,
        },
      }),
    );
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/project-practice?mode=code&check=${check.id}`);
    const code = page.locator(".practice-sources .repository-code");
    await expect(code).toBeVisible();
    await expect(code).toContainText("if (existing) return existing;");
    await expect(page.locator(".practice-sources .practice-origin a")).toHaveAttribute(
      "href",
      /#L1-L16$/,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator(".practice-sources")
      .screenshot({ path: `artifacts/evidence-range-${width}.png` });
  });
}

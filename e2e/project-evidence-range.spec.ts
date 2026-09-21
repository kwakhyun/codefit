import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { sourceLine } from "../src/lib/project-check/repository";

for (const width of [1280, 390]) {
  test(`project practice resumes generation, preserves old learning and shows cited decisions at ${width}px`, async ({
    page,
  }) => {
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
    let newAnalysis = 0;
    const nextId = "22222222-2222-4222-8222-222222222222";
    await page.route(`**/api/project-check/${nextId}`, (route) =>
      route.fulfill({ json: { ...check, id: nextId } }),
    );
    await page.route(`**/api/project-check/${nextId}/practice`, (route) =>
      route.fulfill({ json: null }),
    );
    await page.route("**/api/project-check", (route) => {
      if (route.request().method() === "POST") {
        newAnalysis++;
        return route.fulfill({ json: { ...check, id: nextId } });
      }
      return route.fulfill({
        json: {
          scope: "guest:test",
          signedIn: false,
          aiReady: true,
          checks: [],
          usage: { analysis: { remaining: 1, limit: 2 }, review: { remaining: 2, limit: 2 } },
        },
      });
    });
    await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
    const learning = {
      exercises: { code: Array(3).fill(task), service: Array(3).fill(task) },
      progress: { code: [], service: [] },
      revision: 0,
      createdAt: check.createdAt,
    };
    let completed = false,
      generationRequests = 0;
    await page.route(`**/api/project-check/${check.id}/practice`, (route) => {
      if (route.request().method() === "GET")
        return route.fulfill({ json: completed ? learning : null });
      expect(route.request().postDataJSON()).toEqual({ stepwise: true });
      generationRequests++;
      if (generationRequests === 1)
        return route.fulfill({
          json: { status: "pending", completed: 1, total: 2, label: "코드 이해 실습 저장 완료" },
        });
      if (generationRequests === 2)
        return route.fulfill({ status: 502, json: { error: "두 번째 단계 연결 실패" } });
      completed = true;
      return route.fulfill({ json: { status: "done", result: learning } });
    });
    await page.setViewportSize({ width, height: 844 });
    await page.goto(`/project-practice?mode=code&check=${check.id}`);
    await page.getByRole("button", { name: "맞춤 연습 6개 만들기", exact: true }).click();
    await expect(page.getByText("두 번째 단계 연결 실패", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "저장된 단계부터 이어서 생성" }).click();
    expect(generationRequests).toBe(3);
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
    await page.getByRole("button", { name: "최신 코드로 새로 점검" }).click();
    await expect(page).toHaveURL(new RegExp(nextId));
    expect(newAnalysis).toBe(1);
    await expect(
      page.getByRole("heading", { name: "내 코드로 두 가지 연습 만들기" }),
    ).toBeVisible();
    await page.goto(`/project-practice?mode=code&check=${check.id}`);
    await expect(code).toBeVisible();
    expect(generationRequests).toBe(3);
    await page
      .locator(".practice-sources")
      .screenshot({ path: `artifacts/evidence-range-${width}.png` });
  });
}

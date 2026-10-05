import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { publicCheck } from "../src/lib/server/project-check-store";
import { fixtureAssessment, fixtureCheck } from "../src/lib/project-check/fixtures";
import { checkListItem, practiceSchema, type Check } from "../src/lib/project-check/types";

for (const width of [1440, 390]) {
  test(`evidence and regression records stay honest and persist at ${width}px`, async ({
    page,
  }) => {
    const check: Check = {
      ...publicCheck(fixtureCheck),
      page: {
        ...publicCheck(fixtureCheck).page,
        repository: {
          name: "example/bookings",
          commit: "a".repeat(40),
          totalFiles: 90,
          eligibleFiles: 60,
          truncatedTree: true,
          omittedFiles: 89,
          links: [],
          files: [
            {
              path: "src/book.ts",
              totalLines: 40,
              partial: true,
              lines: [{ number: 10, text: "return save(booking);" }],
            },
          ],
        },
      },
      analysis: {
        ...fixtureCheck.analysis,
        questions: fixtureCheck.analysis.questions.map((question, i) => ({
          ...question,
          evidence: i === 0 ? "src/book.ts:L10 return save(booking);" : "읽지 못한 코드",
          basis: i === 0 ? "page" : "unknown",
        })),
      },
      review: {
        answers: Array(5).fill("예약이 한 번 저장된다고 예상합니다."),
        assessment: fixtureAssessment,
      },
    };
    await page.addInitScript(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as Window & { copiedText?: string }).copiedText = text;
          },
        },
      }),
    );
    await page.route("**/api/project-check", (route) =>
      route.fulfill({
        json: {
          scope: "user:evidence-test",
          signedIn: true,
          aiReady: false,
          checks: [checkListItem(check)],
          nextCursor: null,
          usage: {
            analysis: { limit: 2, remaining: 0, resetsAt: null },
            review: { limit: 2, remaining: 0, resetsAt: null },
          },
        },
      }),
    );
    await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
    await page.route("**/api/project-check/training?*", (route) =>
      route.fulfill({ status: 503, json: { error: "테스트에서 사용하지 않음" } }),
    );
    await page.route(`**/api/project-check/${check.id}/follow-up`, (route) => {
      expect(route.request().method()).toBe("PATCH");
      const input = practiceSchema.parse(route.request().postDataJSON());
      check.review!.practice = { ...input, revision: input.revision + 1 };
      return route.fulfill({ json: check.review!.practice });
    });
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`/project-check?check=${check.id}`);
    const evidence = page.getByRole("region", { name: "점검 근거와 수정 요청" });
    await expect(evidence).toContainText("1 / 5개 질문");
    await expect(evidence).toContainText("파일 목록도 일부만 수집");
    await expect(evidence).toContainText("실행하지 않음");
    const item = evidence.locator(".evidence-review-item").first();
    await item.locator(":scope > summary").click();
    await expect(item.locator("pre")).toContainText("return save(booking)");
    await item.getByText("이 항목의 AI 수정 요청 보기", { exact: true }).click();
    await item.getByRole("button", { name: "수정 요청 복사", exact: true }).click();
    const copied = await page.evaluate(
      () => (window as Window & { copiedText?: string }).copiedText,
    );
    expect(copied).toContain(`/blob/${"a".repeat(40)}/src/book.ts#L10`);
    expect(copied).toContain("테스트 미실행");
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async () => {
            throw Error("denied");
          },
        },
      }),
    );
    await item.getByRole("button", { name: "수정 요청 복사", exact: true }).click();
    await expect(item.getByRole("status")).toContainText("아래 요청 내용을 선택해 복사");
    await expect(item.getByLabel("AI에 전달할 수정 요청")).toHaveValue(copied!);

    const followUp = page.locator("#project-follow-up");
    const record = followUp.locator(".verification-record").first();
    await record.locator(":scope > summary").click();
    await record.getByLabel("수정 후 결과", { exact: true }).selectOption("passed");
    await expect(record.getByRole("status")).toContainText("검증 기록 부족");
    await record.getByLabel("같은 테스트의 실행 방법").fill("npm test -- booking-retry");
    for (const [label, outcome] of [
      ["수정 전", "failed"],
      ["수정 후", "passed"],
      ["수정만 되돌린 사본", "failed"],
    ]) {
      await record.getByLabel(`${label} 결과`, { exact: true }).selectOption(outcome);
      await record
        .getByLabel(`${label} 실행 근거`, { exact: true })
        .fill(`${label}: 예약 개수 비교 결과 ${outcome}`);
    }
    await expect(record.getByRole("status")).toContainText("재현 패턴 기록됨 (자기 기록)");
    await followUp.getByRole("button", { name: "확인 기록 저장", exact: true }).click();
    await expect(followUp).toContainText("확인 기록을 서버에 저장했습니다");
    await page.reload();
    await record.locator(":scope > summary").click();
    await expect(record.getByLabel("수정 전 실행 근거", { exact: true })).toHaveValue(
      "수정 전: 예약 개수 비교 결과 failed",
    );
    await expect(record.getByRole("status")).toContainText("재현 패턴 기록됨 (자기 기록)");
    await followUp.locator(".repair-request").first().locator(":scope > summary").click();
    await expect(followUp.getByLabel("AI에 전달할 수정 요청").first()).toHaveValue(/booking-retry/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include(".evidence-review")
          .include("#project-follow-up")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await followUp.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: `artifacts/project-evidence-review-${width}.png`,
      fullPage: false,
    });
  });
}

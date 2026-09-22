import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { sourceLine } from "../src/lib/project-check/repository";
import type { GeneratedPractice } from "../src/lib/project-check/generated-practice";

for (const width of [1440, 390]) {
  test(`guided project analysis and service practice preserve learning at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const file = {
      path: "src/reservations.ts",
      totalLines: 2,
      partial: false,
      lines: [
        { number: 1, text: "if (existing) return existing;" },
        { number: 2, text: "return createReservation();" },
      ],
    };
    const evidence = sourceLine(file.path, 1, file.lines[0].text);
    const check = {
      ...fixtureCheck,
      page: {
        ...fixtureCheck.page,
        source: "repository" as const,
        repository: {
          name: "owner/reservations",
          commit: "a".repeat(40),
          totalFiles: 1,
          eligibleFiles: 1,
          omittedFiles: 0,
          truncatedTree: false,
          links: [],
          files: [file],
        },
      },
      analysis: {
        ...fixtureCheck.analysis,
        questions: fixtureCheck.analysis.questions.map((q) => ({ ...q, evidence })),
      },
    };
    let reviewed = false;
    const review = {
      answers: Array(5).fill("같은 요청인지 확인하고 기존 결과가 있으면 돌려줍니다."),
      assessment: fixtureAssessment,
    };
    await page.route("**/api/project-check", (route) => {
      if (route.request().method() === "PATCH") {
        reviewed = true;
        return route.fulfill({ json: review });
      }
      return route.fulfill({
        json: {
          scope: "guest:guided",
          signedIn: false,
          aiReady: true,
          checks: [],
          usage: { analysis: { remaining: 2, limit: 2 }, review: { remaining: 4, limit: 4 } },
        },
      });
    });
    await page.route(`**/api/project-check/${check.id}`, (route) =>
      route.fulfill({ json: { ...check, ...(reviewed ? { review } : {}) } }),
    );
    await page.route(`**/api/project-check/${check.id}/dialogue**`, (route) =>
      route.fulfill({ json: null }),
    );
    await page.goto(`/project-check?check=${check.id}`);
    await expect(page.getByRole("navigation", { name: "프로젝트 점검 순서" })).toBeVisible();
    await expect(page.getByText(check.analysis.summary, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "이 순서로 정리해 보세요" })).toBeVisible();
    await page
      .getByLabel("내 설계 설명", { exact: true })
      .fill("기존 결과가 있는지 먼저 확인합니다.");
    await page.reload();
    await expect(page.getByLabel("내 설계 설명", { exact: true })).toHaveValue(
      "기존 결과가 있는지 먼저 확인합니다.",
    );
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .include(".project-questions")
            .include(".analysis-overview")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.locator(".project-questions h2").focus();
      await page
        .locator(".project-questions")
        .screenshot({ path: `artifacts/guided-analysis-${width}-${theme}.png` });
    }
    await page
      .locator(".project-summary")
      .screenshot({ path: `artifacts/guided-overview-${width}.png` });
    await page.getByRole("button", { name: "5. 설계 선택" }).click();
    await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
    await expect(page.getByLabel("영역별 설명 수준")).toBeVisible();
    await expect(page.getByRole("link", { name: "확인 계획 보기 →", exact: true })).toBeVisible();
    await page
      .locator(".project-results")
      .screenshot({ path: `artifacts/guided-feedback-${width}.png` });

    const task = {
      title: "예약 버튼을 두 번 눌렀을 때",
      purpose: "응답을 기다리다 다시 눌러도 예약이 중복되는지 설명해 보세요.",
      guidance: {
        goal: "같은 요청을 구분하는 이유를 설명할 수 있어요.",
        terms: [{ term: "existing", meaning: "같은 요청으로 이미 만든 예약" }],
        readingSteps: [
          "기존 예약을 확인하는 조건을 찾으세요.",
          "그 뒤 새 예약을 만드는지 살펴보세요.",
        ],
        takeaway: "같은 요청의 기존 결과를 돌려주면 새 예약을 중복 생성하지 않아요.",
      },
      serviceScenario: {
        actor: "예약 완료 응답을 기다리는 사용자",
        action: "같은 예약 버튼을 다시 누릅니다.",
        before: "첫 요청의 예약은 저장되었고 응답만 늦습니다.",
        changed: "동일한 요청이 한 번 더 도착합니다.",
        observe: "예약 개수와 반환된 예약을 비교합니다.",
      },
      situation: "응답이 늦어 동일한 요청을 다시 보냈습니다.",
      assumptions: "두 요청은 같은 작업으로 식별되며 existing에 기존 예약이 있습니다.",
      evidence: [evidence],
      question: "두 번째 요청은 어떤 결과를 돌려줄까요?",
      choices: ["기존 예약을 돌려줍니다.", "예약을 하나 더 만듭니다."],
      answer: 0,
      walkthrough: [
        { action: "같은 요청의 기존 예약을 확인합니다.", result: "기존 예약이 있습니다." },
        { action: "기존 예약을 돌려줍니다.", result: "새 예약 생성까지 진행하지 않습니다." },
      ],
      explanation: "기존 예약이 있는 분기에서 반환하므로 새 예약을 만드는 줄은 실행하지 않습니다.",
      verification: "테스트 환경에서 같은 작업을 두 번 요청하고 예약 개수를 비교하세요.",
    };
    const learning: GeneratedPractice = {
      exercises: { code: Array(3).fill(task), service: Array(3).fill(task) },
      progress: { code: [], service: [] },
      revision: 0,
      createdAt: check.createdAt,
    };
    await page.route(`**/api/project-check/${check.id}/practice**`, (route) => {
      if (route.request().method() === "PATCH") {
        learning.progress.service = route.request().postDataJSON().progress;
        learning.revision++;
        return route.fulfill({ json: learning });
      }
      return route.fulfill({ json: { result: learning, completed: 2, canRecover: false } });
    });
    await page.goto(`/project-practice?check=${check.id}&mode=service`);
    await expect(page.getByRole("region", { name: "서비스 실습 조건" })).toBeVisible();
    await expect(page.locator(".practice-sources .repository-code")).not.toBeVisible();
    const sourceSummary = page.locator(".practice-sources summary").first();
    await expect(sourceSummary.locator("svg")).toBeVisible();
    const gutters = await sourceSummary.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft].map(
        parseFloat,
      );
    });
    expect(gutters.every((value) => value >= 12)).toBe(true);
    expect(
      await page
        .locator(".practice-stages > button")
        .first()
        .evaluate((element) => getComputedStyle(element).justifyContent),
    ).toBe("flex-start");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.theme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .include(".practice-exercise")
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page
        .locator(".practice-exercise")
        .screenshot({ path: `artifacts/guided-service-${width}-${theme}.png` });
    }
    await page.getByRole("radio", { name: "예약을 하나 더 만듭니다.", exact: true }).check();
    await page
      .getByRole("textbox", { name: "왜 그렇게 생각했나요?" })
      .fill("버튼을 두 번 눌렀기 때문입니다.");
    await page.getByRole("button", { name: "예상 저장하고 서비스 결과 비교" }).click();
    await expect(page.getByText("근거로 설명한 서비스 결과", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "내 말로 설명하기" }).click();
    await page
      .getByRole("textbox", { name: /내 설명 또는 실제 확인 기록/ })
      .fill("같은 요청의 결과를 다시 돌려줍니다. 테스트는 확인 예정입니다.");
    await page.getByRole("button", { name: "기록 저장", exact: true }).click();
    await expect(page.getByText("연습 기록을 저장했습니다.", { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText("내가 적은 이유: 버튼을 두 번 눌렀기 때문입니다.")).toBeVisible();
    expect(learning.progress.service[0].note).toContain("확인 예정");
  });
}

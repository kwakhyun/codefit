import { test, expect } from "@playwright/test";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import type { CheckOverview } from "../src/lib/project-check/types";

for (const hasHistory of [true, false]) {
  test(`exhausted analysis explains the reset and preserves drafts; history=${hasHistory}`, async ({
    page,
  }, info) => {
    const data: CheckOverview = {
      scope: "user:quota-test",
      signedIn: true,
      aiReady: true,
      usage: {
        analysis: { limit: 2, remaining: 0, resetsAt: "2026-09-21T11:00:00.000Z" },
        review: { limit: 4, remaining: 2, resetsAt: "2026-09-21T12:00:00.000Z" },
      },
      checks: hasHistory ? [publicCheck(fixtureCheck)] : [],
      nextCursor: null,
    };
    let analyses = 0,
      reviews = 0;
    await page.route("**/api/project-check", (route) => {
      const method = route.request().method();
      if (method === "POST") analyses++;
      if (method === "PATCH") {
        reviews++;
        const review = {
          answers: route.request().postDataJSON().answers,
          assessment: fixtureAssessment,
        };
        data.checks[0].review = review;
        return route.fulfill({ json: review });
      }
      return route.fulfill({ json: data });
    });
    await page.goto("/project-check");
    const notice = page.getByRole("region", { name: "새 분석 한도 안내" });
    await expect(notice).toContainText("새 분석 2회를 모두 사용했습니다");
    await expect(notice).toContainText("답변 평가는 2회 남아 있습니다");
    await expect(page.locator("#project-analysis-limit")).toContainText("9월 21일");
    await expect(
      page.getByRole("button", { name: "새 분석 한도를 모두 사용했습니다", exact: true }),
    ).toBeDisabled();
    await page.getByLabel("서비스 링크", { exact: true }).fill("https://example.com/next");
    await page.getByLabel("서비스와 구현 방식 설명").fill("다음 프로젝트를 위한 설명 초안");
    await page.reload();
    await expect(page.getByLabel("서비스와 구현 방식 설명")).toHaveValue(
      "다음 프로젝트를 위한 설명 초안",
    );
    if (hasHistory) {
      await notice.getByRole("button", { name: "최근 점검에서 답변 이어가기" }).click();
      await page
        .getByLabel("내 설계 설명")
        .fill("예약 전 권한을 확인하고 서버에서 같은 작업의 중복 실행을 막습니다.");
      for (let i = 0; i < 4; i++) await page.getByRole("button", { name: "다음 질문 →" }).click();
      await expect(
        page.getByRole("button", { name: "이 답변으로 이해도 확인", exact: true }),
      ).toBeEnabled();
      await page.getByRole("button", { name: "이 답변으로 이해도 확인", exact: true }).click();
      await expect.poll(() => reviews).toBe(1);
      await expect(page.getByText("질문별 AI 피드백 5개 보기", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "+ 다음 프로젝트 초안 작성" }).click();
    } else {
      await notice.getByRole("link", { name: "로그인 없이 서비스 원리 연습하기 →" }).click();
      await expect(page).toHaveURL(/\/learn$/);
      await page.goBack();
    }
    await expect(page.getByLabel("서비스 링크", { exact: true })).toHaveValue(
      "https://example.com/next",
    );
    await expect(page.getByLabel("서비스와 구현 방식 설명")).toHaveValue(
      "다음 프로젝트를 위한 설명 초안",
    );
    expect(analyses).toBe(0);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await notice.screenshot({
      path: `artifacts/project-quota-${hasHistory}-${info.project.name}.png`,
    });
  });
}

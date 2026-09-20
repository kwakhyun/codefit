import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import { validateGroundedAssessment } from "../src/lib/server/project-assessment";
import { validateReferencedAssessment } from "../src/lib/server/project-assessment-references";
import { checkListItem, type Check, type CheckOverview } from "../src/lib/project-check/types";
test("grounded feedback exposes exact evidence with keyboard and mobile layout", async ({
  page,
}, info) => {
  const quote = "서버에 예약을 요청하고 결과를 표시합니다.<script>alert('x')</script>";
  const answers = [quote, "", "", "", ""];
  const assessment = validateGroundedAssessment(
    {
      summary: "이번 답변에서 처리 흐름을 확인했습니다.",
      feedback: Array.from({ length: 5 }, (_, questionIndex) => ({
        questionIndex,
        feedback: "설명을 확인했습니다.",
        nextStep: "저장된 결과를 확인해 보세요.",
        evidence: {
          feature: null,
          flow: questionIndex === 0 ? quote : null,
          reason: null,
          failure: null,
          verification: null,
          tradeoff: null,
        },
      })),
    },
    answers,
  );
  const record: Check = { ...publicCheck(fixtureCheck), review: { answers, assessment } };
  const data: CheckOverview = {
    scope: "user:evidence",
    signedIn: true,
    aiReady: true,
    usage: {
      analysis: { limit: 2, remaining: 1, resetsAt: null },
      review: { limit: 4, remaining: 3, resetsAt: null },
    },
    nextCursor: null,
    checks: [checkListItem(record)],
  };
  await page.route(`**/api/project-check/${record.id}`, (r) => r.fulfill({ json: record }));
  await page.route("**/api/project-check", (r) => r.fulfill({ json: data }));
  await page.route("**/api/project-check/training?*", (r) =>
    r.fulfill({ status: 503, json: { error: "실습은 잠시 후 다시 확인해 주세요." } }),
  );
  await page.goto(`/project-check?check=${fixtureCheck.id}`);
  await expect(page.getByRole("heading", { name: "설계 설명 점수 10 / 100" })).toBeVisible();
  await page.getByText("질문별 AI 피드백 5개 보기", { exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.locator(".project-feedback-item > summary").first().click();
  const toggle = page.getByText("평가에 사용한 내 설명 보기", { exact: true }).first();
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".project-assessment-evidence blockquote")).toHaveText(quote);
  await expect(page.locator(".project-assessment-evidence script")).toHaveCount(0);
  await expect(
    page
      .locator(".project-assessment-evidence")
      .first()
      .getByText("이번 답변에서 확인하지 못함", { exact: true }),
  ).toHaveCount(5);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page
    .locator(".project-feedback")
    .first()
    .screenshot({ path: `artifacts/project-assessment-${info.project.name}.png` });
  // Persisted older assessments must remain readable without fabricated evidence.
  delete record.review!.assessment.rubricVersion;
  for (const f of record.review!.assessment.feedback) delete f.evidence;
  await page.reload();
  await page.getByText("질문별 AI 피드백 5개 보기", { exact: true }).click();
  await expect(page.getByText("평가에 사용한 내 설명 보기", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "설계 설명 점수 10 / 100" })).toBeVisible();
  await expect(page.getByText("먼저 바로잡을 설명", { exact: true })).toHaveCount(0);
  record.review = {
    answers,
    assessment: validateReferencedAssessment(
      {
        summary: "핵심 설명에서 바로잡을 부분을 확인했습니다.",
        feedback: Array.from({ length: 5 }, (_, questionIndex) => ({
          questionIndex,
          feedback: "보장 조건을 다시 확인해 주세요.",
          nextStep: "실패 응답과 실제 저장 결과를 비교해 보세요.",
          blockingIssue:
            questionIndex === 0
              ? {
                  evidence: ["q0s0"],
                  explanation: "이 문장에 관한 AI의 오류 판단입니다.",
                }
              : null,
          evidence: {
            feature: null,
            flow: questionIndex === 0 ? "q0s0" : null,
            reason: null,
            failure: null,
            verification: null,
            tradeoff: null,
          },
        })),
      },
      answers,
    ),
  };
  await page.reload();
  await expect(page.getByRole("heading", { name: "설계 설명 점수 5 / 100" })).toBeVisible();
  await page.getByText("질문별 AI 피드백 5개 보기", { exact: true }).click();
  await page.locator(".project-feedback-item > summary").first().click();
  const issue = page.locator(".project-assessment-issue");
  await expect(issue.getByText("먼저 바로잡을 설명", { exact: true })).toBeVisible();
  await expect(issue.locator("blockquote")).toHaveText(quote);
  await expect(issue.locator("script")).toHaveCount(0);
  await expect(issue).toContainText("최대 1단계");
  await expect(issue).toContainText("실제 구현을 검사한 결과는 아니며");
  await page.getByText("점수는 어떻게 정하나요?", { exact: true }).click();
  await expect(page.getByText(/답변 안에서 바로잡은 과거의 오해/)).toBeVisible();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page
    .locator(".project-feedback")
    .first()
    .screenshot({ path: `artifacts/project-assessment-issue-${info.project.name}.png` });
});

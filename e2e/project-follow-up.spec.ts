import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import type { Check, CheckOverview, ProjectPractice } from "../src/lib/project-check/types";

test("project tasks persist, original answers survive revision, and screenshots are account-scoped", async ({
  page,
}, info) => {
  const original: Check = {
    ...publicCheck({
      ...fixtureCheck,
      page: {
        ...fixtureCheck.page,
        source: "rendered",
        captures: [
          {
            url: "https://example.com/",
            title: "분석 화면",
            text: "공개 본문",
            screenshot: "YWJj",
          },
        ],
      },
    }),
    review: { answers: Array(5).fill("처음 작성한 설명입니다."), assessment: fixtureAssessment },
  };
  const data: CheckOverview = {
    scope: "user:follow-up",
    signedIn: true,
    aiReady: true,
    nextCursor: null,
    usage: {
      analysis: { limit: 2, remaining: 1, resetsAt: null },
      review: { limit: 4, remaining: 3, resetsAt: null },
    },
    checks: [original],
  };
  let revised: Check | undefined;
  let practice: ProjectPractice | undefined;
  await page.route("**/api/project-check", (r) => {
    if (r.request().method() === "PATCH") {
      const review = { answers: r.request().postDataJSON().answers, assessment: fixtureAssessment };
      revised!.review = review;
      return r.fulfill({ json: review });
    }
    return r.fulfill({ json: data });
  });
  await page.route("**/api/project-check/training?*", (r) =>
    r.fulfill({ status: 503, json: { error: "기초 예제 미사용" } }),
  );
  await page.route("**/api/project-check/*/capture?*", (r) => {
    expect(r.request().headers()["x-codefit-workspace"]).toBe(data.scope);
    return r.fulfill({
      status: 200,
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await page.route("**/api/project-check/*/follow-up", (r) => {
    if (r.request().method() === "PATCH") {
      practice = { ...r.request().postDataJSON(), revision: 1 };
      original.review!.practice = practice;
      return r.fulfill({ json: practice });
    }
    revised = {
      ...original,
      id: r.request().postDataJSON().requestId || randomUUID(),
      review: undefined,
      previousReview: {
        answers: original.review!.answers,
        assessment: original.review!.assessment,
      },
      revisionNumber: 1,
    };
    data.checks.unshift(revised);
    return r.fulfill({ json: revised });
  });
  await page.goto(`/project-check?check=${original.id}`);
  await page.getByText("질문 생성에 사용한 공개 화면 1곳 보기", { exact: true }).click();
  await expect(page.getByRole("img", { name: /분석 화면 — 분석 당시/ })).toBeVisible();
  const follow = page.locator("#project-follow-up");
  const task = follow.locator("details").first();
  await task
    .getByLabel("계획과 실제 결과")
    .fill("초대 멤버와 탈퇴 계정으로 조회했고, 탈퇴한 계정은 접근 거절을 확인했습니다.");
  await task.getByLabel("확인 상태").selectOption("observed");
  await follow.getByRole("button", { name: "확인 기록 저장", exact: true }).click();
  await expect(follow.getByRole("status")).toContainText("서버에 저장");
  await page.reload();
  await expect(follow.locator("details").first().getByLabel("계획과 실제 결과")).toContainText(
    "탈퇴한 계정",
  );
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(
    (
      await new AxeBuilder({ page })
        .include("#project-follow-up")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.setViewportSize({ width: 390, height: 950 });
  await follow.screenshot({ path: `artifacts/project-follow-up-${info.project.name}.png` });
  await follow.getByRole("button", { name: "같은 질문에 보완 답변 작성 →" }).click();
  await expect(page.getByLabel("내 설계 설명")).toHaveValue("처음 작성한 설명입니다.");
  await page
    .getByLabel("내 설계 설명")
    .fill("보완한 설명: 탈퇴한 계정의 접근 차단을 확인했습니다.");
  await page.getByRole("button", { name: /5\. 설계 선택/ }).click();
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).last().click();
  await expect(page.getByText(/이전 답변 50점 → 보완 답변 50점/)).toBeVisible();
  expect(original.review!.answers[0]).toBe("처음 작성한 설명입니다.");
  expect(revised!.review!.answers[0]).toContain("보완한 설명");
});

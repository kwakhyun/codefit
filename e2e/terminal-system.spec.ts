import { expect, test } from "@playwright/test";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import type { CheckOverview } from "../src/lib/project-check/types";

test("first visit offers a direct guest start and responsive menu controls retain visibility", async ({
  page,
}) => {
  await page.goto("/");
  const start = page.getByRole("region", { name: "처음 방문한 분의 시작점" });
  await expect(start).toBeVisible();
  await expect(page.getByRole("button", { name: "메뉴 열기", exact: true })).toBeHidden();
  await expect(page.locator(".sidebar-close")).toBeHidden();
  await start.getByRole("link", { name: "내 프로젝트 점검", exact: true }).click();
  await expect(page.getByLabel("서비스 링크", { exact: true })).toBeVisible();
  await expect(page.locator(".guest-trial-notice")).toContainText("분석 2회");
  await page.goto("/");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  await expect(page.locator(".sidebar-close")).toBeVisible();
  await page.locator(".sidebar-close").click();
  await expect(page.getByRole("button", { name: "메뉴 열기", exact: true })).toBeFocused();
});

test("guest generation exposes the actual form and two-use allowance without login", async ({
  page,
}) => {
  await page.goto("/?generate=1");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("오늘 2 / 2회 남음");
  await expect(dialog.getByRole("combobox", { name: "분야", exact: true })).toBeVisible();
  await expect(dialog.getByRole("link", { name: "로그인하고 하루 6회 이용하기" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("a guest can submit five explanations and receive feedback in the same workspace", async ({
  page,
}) => {
  const data: CheckOverview = {
    scope: "guest:terminal-test",
    signedIn: false,
    aiReady: true,
    nextCursor: null,
    checks: [],
    usage: {
      analysis: { limit: 2, remaining: 2, resetsAt: null },
      review: { limit: 2, remaining: 2, resetsAt: null },
    },
  };
  let analyses = 0,
    reviews = 0;
  await page.route("**/api/project-check", async (route) => {
    const method = route.request().method();
    if (method === "GET") return route.fulfill({ json: data });
    expect(route.request().headers()["x-codefit-workspace"]).toBe(data.scope);
    if (method === "POST") {
      analyses++;
      const check = { ...publicCheck(fixtureCheck), id: route.request().postDataJSON().requestId };
      data.checks = [check];
      data.usage.analysis.remaining--;
      return route.fulfill({ json: check });
    }
    if (method === "PATCH") {
      reviews++;
      const review = {
        answers: route.request().postDataJSON().answers,
        assessment: fixtureAssessment,
      };
      data.checks[0].review = review;
      data.usage.review.remaining--;
      return route.fulfill({ json: review });
    }
  });
  await page.goto("/project-check");
  await page.getByLabel("서비스 링크", { exact: true }).fill("https://example.com/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  for (let i = 0; i < 5; i++) {
    await page
      .getByLabel("내 설계 설명")
      .fill("서버에서 요청 번호와 사용자 권한을 확인하고, 저장 결과를 직접 비교했습니다.");
    if (i < 4) await page.getByRole("button", { name: "다음 질문 →" }).click();
  }
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
  await expect(page.getByRole("heading", { name: "설계 설명 점수 50 / 100" })).toBeVisible();
  expect(analyses).toBe(1);
  expect(reviews).toBe(1);
});

test("pending data shows an indeterminate progress bar and clears when the response arrives", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/project-check", async (route) => {
    await gate;
    return route.continue();
  });
  await page.goto("/project-check");
  const progress = page.getByRole("progressbar", { name: "응답 처리 진행률" });
  await expect(progress).toBeVisible();
  await expect(progress).not.toHaveAttribute("value");
  release();
  await expect(progress).toBeHidden();
  await expect(page.getByLabel("서비스 링크", { exact: true })).toBeVisible();
});

test("neutral surfaces and useful labels stay consistent; type and route changes fade without moving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      if (this.id === "main-content") {
        document.documentElement.dataset.mainFade = String(
          Number(document.documentElement.dataset.mainFade || 0) + 1,
        );
        document.documentElement.dataset.mainFrames = JSON.stringify(frames);
      }
      return original.call(this, frames, options);
    };
  });
  await page.goto("/");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(14, 18, 25)");
  await expect(page.getByText("저장소 연결됨", { exact: true })).toHaveCount(0);
  await expect(page.locator(".sidebar-version")).toHaveCount(0);
  const start = page.getByRole("region", { name: "처음 방문한 분의 시작점" });
  await expect(start.locator(".feature-banner")).toBeVisible();
  await expect(start.getByRole("link", { name: "내 프로젝트 점검", exact: true })).toHaveCSS(
    "background-color",
    "rgb(147, 197, 253)",
  );
  const before = await page.locator("html").getAttribute("data-main-fade");
  await page.getByRole("region", { name: "나에게 맞는 시작점" }).getByRole("radio").nth(2).click();
  await expect(start).toHaveCount(0);
  await expect(page.locator("html")).not.toHaveAttribute("data-main-fade", before || "0");
  await expect(page.locator("html")).toHaveAttribute(
    "data-main-frames",
    '[{"opacity":0.45},{"opacity":1}]',
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  const afterType = await page.locator("html").getAttribute("data-main-fade");
  await page.locator(".sidebar").getByRole("link", { name: "내 프로젝트 점검" }).click();
  await expect(page.getByLabel("서비스 링크", { exact: true })).toBeVisible();
  await expect(page.locator("html")).not.toHaveAttribute("data-main-fade", afterType!);
});

test("reduced motion disables type transitions and typing never starts a view animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("region", { name: "나에게 맞는 시작점" }).getByRole("radio").first().click();
  expect(await page.locator("#main-content").evaluate((node) => node.getAnimations().length)).toBe(
    0,
  );
  await page.goto("/project-check");
  const input = page.getByLabel("서비스 링크", { exact: true });
  await input.fill("https://example.com/");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("https://example.com/");
  expect(
    await page
      .locator("#main-content")
      .evaluate((node) => node.getAnimations({ subtree: true }).length),
  ).toBe(0);
});

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("a partial beginner draft resumes from course, home and history without leaking to another browser", async ({
  page,
  browser,
}) => {
  await page.goto("/learn/where-data-lives");
  await page.getByLabel("왜 그렇게 생각했나요?").fill("아직 예상을 제출하지 않은 개인 초안입니다.");
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/learn/where-data-lives")).json()).progress?.code,
    )
    .toContain("개인 초안");
  await page.getByRole("link", { name: "서비스 원리 배우기", exact: true }).click();
  const recommendation = page.getByRole("region", { name: "추천 입문 미션" });
  await expect(recommendation).toContainText("1/4단계");
  await recommendation.getByRole("link", { name: "이어서 연습하기" }).click();
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toHaveValue(
    "아직 예상을 제출하지 않은 개인 초안입니다.",
  );
  for (const url of ["/", "/?view=history"]) {
    await page.goto(url);
    const resume = page.getByRole("region", { name: "입문 학습 이어하기" });
    await expect(resume).toContainText("데이터는 어디에 저장될까요?");
    await expect(resume.getByRole("link")).toHaveAttribute("href", "/learn/where-data-lives");
  }
  const other = await browser.newContext();
  const guest = await other.newPage();
  const loaded = guest.waitForResponse(
    (response) => response.url().endsWith("/api/learn") && response.ok(),
  );
  await guest.goto(new URL("/", page.url()).href);
  await loaded;
  await expect(guest.getByText("입문 학습 기록을 확인하고 있습니다…")).toHaveCount(0);
  await expect(guest.getByRole("region", { name: "입문 학습 이어하기" })).toHaveCount(0);
  await other.close();
});

test("new code learners get one consistent first recommendation; public navigation works", async ({
  page,
}) => {
  await page.goto("/handoff");
  const next = page.getByRole("region", { name: "추천 코드 이해 훈련" });
  await expect(next).toContainText("장바구니 상태 인수인계");
  await expect(next.getByRole("link")).toHaveAttribute(
    "href",
    "/problems/handoff-cart?from=%2Fhandoff",
  );
  await next.getByRole("link").click();
  await expect(page.getByRole("heading", { name: "1. 예측하기" })).toBeVisible();
  await page.goto("/learn");
  const navigation = page.getByRole("navigation", { name: "서비스 메뉴" });
  await navigation.getByRole("link", { name: "코드 분석", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/handoff$/);
  await expect(
    page.getByRole("navigation", { name: "서비스 메뉴" }).getByRole("link", { name: "코드 분석" }),
  ).toHaveAttribute("aria-current", "page");
});

test("mobile filters preserve selection when folded and reset cleanly", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "메뉴 열기" }).click();
  await page.getByRole("link", { name: /문제 보관함 24/ }).click();
  await expect(page.locator(".sidebar")).not.toHaveClass(/open/);
  await expect(page.locator("#problem-library")).toBeInViewport();
  const toggle = page.getByRole("button", { name: /상세 필터/ });
  await expect(page.getByRole("combobox", { name: "난이도 필터", exact: true })).toBeHidden();
  await toggle.click();
  await page.getByRole("combobox", { name: "난이도 필터", exact: true }).click();
  await page.getByRole("option", { name: "난이도 하", exact: true }).click();
  await expect(page).toHaveURL(/level=/);
  await toggle.click();
  await expect(page.locator(".filter-summary")).toContainText("난이도 하");
  await expect(page.getByRole("combobox", { name: "난이도 필터", exact: true })).toBeHidden();
  await page.locator(".filter-summary").getByRole("button", { name: "초기화" }).click();
  await expect(page.locator(".filter-summary")).toHaveCount(0);
  await toggle.click();
  await expect(page.getByRole("combobox", { name: "난이도 필터", exact: true })).toHaveText(
    "모든 난이도",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("all public page families remain readable on mobile and have accessible navigation", async ({
  page,
}, info) => {
  test.setTimeout(120000);
  const pages = [
    ["home", "/"],
    ["learn", "/learn"],
    ["handoff", "/handoff"],
    ["login", "/login"],
    ["project-check", "/project-check"],
    ["privacy", "/privacy"],
    ["quality", "/quality"],
    ["history", "/?view=history"],
    ["bookmarks", "/?view=bookmarks"],
    ["mission", "/learn/where-data-lives"],
    ["workspace", "/problems/be-pagination"],
  ];
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const [name, url] of pages) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url);
    await expect(page.locator("h1")).toBeVisible();
    if (url.includes("problems")) await expect(page.locator(".monaco-editor")).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    for (const width of [320, 390, 768]) {
      await page.setViewportSize({ width, height: 844 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        `${name} at ${width}px`,
      ).toBe(true);
    }
    if (info.project.name === "chromium") {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: `artifacts/ui-refresh/${name}-mobile.png`, fullPage: true });
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.screenshot({ path: `artifacts/ui-refresh/${name}-desktop.png`, fullPage: true });
    }
  }
});

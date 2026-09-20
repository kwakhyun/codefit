import { waitForUiTransitions } from "./ui-helpers";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedProblems } from "../src/data/problems";
import { MISSIONS } from "../src/lib/learn/catalog";
import { scenarioFor } from "../src/lib/scenario-visuals";
async function loadedImages(page: Page) {
  for (const img of await page.locator(".scenario-art img").all()) {
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
  }
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}
test("home and all mission cards have loaded representative artwork", async ({ page }, info) => {
  for (const [url, selector, count] of [
    ["/", ".persona-art", 3],
    ["/learn", ".learn-card .service-card-art", MISSIONS.length],
    ["/handoff", ".handoff-card .scenario-art", 6],
  ] as const) {
    await page.goto(url);
    await expect(page.locator(selector)).toHaveCount(count);
    await loadedImages(page);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await noOverflow(page);
    }
    await expect(page.getByRole("main")).not.toContainText("메모는 어디에 저장될까요?");
    if (info.project.name === "chromium") {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({
        path: `artifacts/scenario-visuals/${url === "/" ? "home" : url.slice(1)}.png`,
        fullPage: true,
      });
    }
  }
});
test("all curated problems expose four illustrated stages without missing assets", async ({
  page,
}) => {
  test.setTimeout(180_000);
  for (const problem of seedProblems.filter((p) => !p.handoff)) {
    expect(scenarioFor(problem.id), problem.id).toBeTruthy();
    await page.goto(`/problems/${problem.id}`);
    await expect(page.locator(".scenario-visual")).toHaveAttribute("data-stage", "0");
    await loadedImages(page);
    const controls = problem.handoff
      ? page.getByRole("navigation", { name: "코드 이해 훈련 단계" })
      : page.getByRole("group", { name: "상황 그림 단계" });
    for (let stage = 1; stage < 4; stage++) {
      await controls.getByRole("button").nth(stage).click();
      await expect(page.locator(".scenario-visual")).toHaveAttribute("data-stage", String(stage));
    }
  }
});
test("beginner previews and keyboard illustration controls remain understandable without images", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  for (const mission of MISSIONS) {
    await page.goto(`/learn/${mission.id}`);
    await expect(page.getByRole("region", { name: "실습 상황과 기준" })).toBeVisible();
    await expect(page.getByText("그림으로 원리 살펴보기", { exact: true })).toHaveCount(0);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/_next/image**", (route) => route.abort());
  await page.goto("/learn/where-data-lives");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("데이터는 어디에 저장될까요?");
  await expect(page.getByRole("region", { name: "실습 상황과 기준" })).toContainText("새로고침");
  await noOverflow(page);
  await waitForUiTransitions(page);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.unroute("**/_next/image**");
  await page.goto("/problems/net-framing");
  const controls = page.getByRole("group", { name: "상황 그림 단계" });
  await controls.getByRole("button", { name: "1. 상황", exact: true }).focus();
  await expect(controls.getByRole("button", { name: "1. 상황", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(controls.getByRole("button", { name: "2. 확인할 점", exact: true })).toBeFocused();
  await expect(page.locator(".scenario-visual")).toHaveAttribute("data-stage", "1");
  await noOverflow(page);
  await waitForUiTransitions(page);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({
      path: "artifacts/scenario-visuals/problem-mobile.png",
      fullPage: true,
    });
});

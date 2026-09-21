import { expect, test } from "@playwright/test";
import { AI_CONTENT } from "../src/lib/ai-learning/content";

for (const width of [1280, 390]) {
  test(`AI catalog keeps filters and position at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/learn/ai");
    await page.getByRole("searchbox", { name: "기술이나 도구 검색" }).fill("랭그래프");
    const select = page.getByRole("combobox", { name: "학습 수준" });
    await select.selectOption("기초");
    await page.getByRole("button", { name: /^LangChain과 LangGraph/ }).click();
    const card = page.locator(".ai-lesson-card");
    await expect(card).toHaveCount(1);
    await expect(select).toHaveCSS("background-position", "calc(100% - 14px) 50%");
    await expect(select).toHaveCSS("padding-right", "44px");
    await card.scrollIntoViewIfNeeded();
    let y = await page.evaluate(() => window.scrollY);
    const url = page.url();
    await card.click();
    await expect(page.locator(".ai-lesson-header h1")).toContainText("LangGraph");
    await page.getByRole("button", { name: "선택하며 실습하기", exact: true }).click();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "확인 문제 풀기" }).click();
    await page.getByRole("radio").nth(AI_CONTENT.langgraph.quiz.answer).check();
    await page.getByRole("button", { name: "답 확인하기" }).click();
    await page
      .locator(".ai-completion")
      .getByRole("link", { name: "검색 결과로 돌아가기", exact: true })
      .click();
    await expect(page).toHaveURL(url);
    await expect(card).toHaveCount(1);
    await expect(page.getByRole("searchbox")).toHaveValue("랭그래프");
    await expect(select).toHaveValue("기초");
    await expect
      .poll(() => page.evaluate((saved) => Math.abs(window.scrollY - saved), y))
      .toBeLessThan(24);
    await card.scrollIntoViewIfNeeded();
    y = await page.evaluate(() => window.scrollY);
    await card.click();
    await expect(page.locator(".ai-lesson-header h1")).toContainText("LangGraph");
    await page.goBack();
    await expect(card).toHaveCount(1);
    await expect(page.locator(".ai-lesson-body")).toHaveCount(0);
    await expect(select).toHaveValue("기초");
    await expect
      .poll(() => page.evaluate((saved) => Math.abs(window.scrollY - saved), y))
      .toBeLessThan(24);
    await page.getByRole("button", { name: "검색과 필터 초기화" }).click();
    await expect(card).toHaveCount(32);
    await expect(page.getByRole("searchbox")).toHaveValue("");
    await expect(select).toHaveValue("all");
    await select.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `artifacts/ai-catalog-${width}.png` });
    await page.emulateMedia({ forcedColors: "active" });
    await expect(select).toHaveCSS("appearance", "auto");
    await expect(select).toHaveCSS("background-image", "none");
    await select.focus();
    await expect(select).toBeFocused();
    // macOS headless Chromium does not operate native popup choices via arrow keys.
    await select.selectOption("입문");
    await expect(select).toHaveValue("입문");
  });
}

test("direct lesson ignores unsafe return URL", async ({ page }) => {
  await page.goto("/learn/ai/langgraph?returnTo=https%3A%2F%2Fevil.example");
  await expect(page.getByRole("link", { name: "전체 수업으로 돌아가기" })).toHaveAttribute(
    "href",
    "/learn/ai",
  );
});

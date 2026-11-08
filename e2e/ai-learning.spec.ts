import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { waitForUiTransitions } from "./ui-helpers";
import { AI_LESSONS, AI_TRACKS } from "../src/lib/ai-learning/catalog";
import { AI_CONTENT, correctQuizIndex } from "../src/lib/ai-learning/content";

test("home sidebar opens AI learning", async ({ page }) => {
  await page.goto("/");
  await page
    .getByRole("complementary", { name: "주 메뉴" })
    .getByRole("link", { name: "AI 실무 배우기", exact: true })
    .click();
  await expect(page).toHaveURL(/\/learn\/ai$/);
  await expect(page.locator(".ai-track")).toHaveCount(AI_TRACKS.length);
});

test("catalog discovery, Korean search, filters and no-results recovery", async ({ page }) => {
  await page.goto("/learn/ai");
  await expect(page).toHaveURL(/\/learn\/ai$/);
  // The default view lists tracks; their lessons open one track at a time.
  await expect(page.locator(".ai-track")).toHaveCount(AI_TRACKS.length);
  await expect(page.locator(".ai-lesson-card")).toHaveCount(0);
  await page.getByRole("searchbox", { name: "기술이나 도구 검색" }).fill("랭체인");
  await expect(page.locator(".ai-lesson-card")).toHaveCount(1);
  await expect(page.locator(".ai-lesson-card")).toContainText("LangChain");
  await page.getByRole("combobox", { name: "학습 수준" }).selectOption("응용");
  await expect(page.getByRole("heading", { name: "일치하는 수업이 없어요" })).toBeVisible();
  await page.getByRole("button", { name: "전체 수업 보기", exact: true }).click();
  await expect(page.locator(".ai-track")).toHaveCount(AI_TRACKS.length);
  const frameworks = page.getByRole("button", { name: /^LangChain과 LangGraph/ });
  await frameworks.click();
  await expect(frameworks).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".ai-lesson-card")).toHaveCount(
    AI_LESSONS.filter((lesson) => lesson.track === "frameworks").length,
  );
  await page.getByRole("button", { name: /^AI 에이전트 워크플로우/ }).click();
  await expect(frameworks).toHaveAttribute("aria-expanded", "false");
  await frameworks.click();
  await page.locator('.ai-lesson-card[href^="/learn/ai/langgraph?"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "LangGraph로 멈추고 이어가는 흐름 만들기",
  );
});

test("lesson gates completion, resumes after reload, retries a wrong answer and keeps history", async ({
  page,
}) => {
  await page.goto("/learn/ai/langchain");
  await page.getByRole("button", { name: "선택하며 실습하기", exact: true }).click();
  await expect(page.getByRole("heading", { name: "선택하며 실습", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "확인 문제 풀기" })).toBeDisabled();
  await page.getByRole("radio").first().check();
  await expect(page.locator(".ai-feedback")).toContainText(
    AI_CONTENT.langchain.exercise.choices[0].result,
  );
  await page.getByRole("button", { name: "확인 문제 풀기" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "확인 문제", exact: true })).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "답 확인하기" }).click();
  await expect(page.getByRole("heading", { name: "다시 생각해 볼까요?" })).toBeVisible();
  // One wrong answer does not reveal the explanation.
  await expect(page.locator(".ai-feedback")).not.toContainText(
    AI_CONTENT.langchain.quiz.explanation,
  );
  await expect(page.getByRole("button", { name: "답 확인하기" })).toBeDisabled();
  await expect(page.locator(".ai-completion")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await expect(page.getByRole("heading", { name: "다시 생각해 볼까요?" })).toBeVisible();
  await page.getByRole("radio").nth(correctQuizIndex(AI_CONTENT.langchain.quiz)).check();
  await page.getByRole("button", { name: "답 확인하기" }).click();
  await expect(page.locator(".ai-completion")).toBeVisible();
  await expect(page.getByText("처음 고른 답은 틀렸어요.", { exact: false })).toBeAttached();
  await page.reload();
  await expect(page.getByRole("heading", { name: "수업 완료", exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("button", { name: "확인 문제 다시 풀기" }).click();
  await expect(page.getByRole("radio")).toHaveCount(3);
  await page.getByRole("radio").nth(correctQuizIndex(AI_CONTENT.langchain.quiz)).check();
  await page.getByRole("button", { name: "답 확인하기" }).click();
  await page.getByRole("link", { name: "다른 수업 고르기" }).click();
  await expect(
    page.getByRole("region", { name: "다시 볼 수업" }).getByRole("link", {
      name: AI_LESSONS.find((lesson) => lesson.id === "langchain")!.title,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^LangChain과 LangGraph/ }).click();
  await expect(page.locator('.ai-lesson-card[href^="/learn/ai/langchain?"]')).toContainText("완료");
  await expect(page.locator(".ai-progress-summary strong")).toHaveText(`1 / ${AI_LESSONS.length}`);
});

test("all lessons have usable content, choices and completion routes", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const lesson of AI_LESSONS) {
    await page.goto(`/learn/ai/${lesson.id}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(lesson.title);
    await page.getByRole("button", { name: "선택하며 실습하기", exact: true }).click();
    for (let choice = 0; choice < AI_CONTENT[lesson.id].exercise.choices.length; choice++) {
      await page.getByRole("radio").nth(choice).check();
      await expect(page.locator(".ai-feedback")).toContainText(
        AI_CONTENT[lesson.id].exercise.choices[choice].result,
      );
    }
    await page.getByRole("button", { name: "확인 문제 풀기" }).click();
    await page.getByRole("radio").nth(correctQuizIndex(AI_CONTENT[lesson.id].quiz)).check();
    await page.getByRole("button", { name: "답 확인하기" }).click();
    await expect(page.locator(".ai-completion")).toContainText(AI_CONTENT[lesson.id].takeaway);
  }
  expect(errors).toEqual([]);
  await page.goto("/learn/ai");
  await expect(
    page
      .getByRole("region", { name: "AI 학습 현황" })
      .getByRole("heading", { name: AI_LESSONS[0].title, exact: true }),
  ).toBeVisible();
  await expect(page.locator(".ai-progress-summary strong")).toHaveText(
    `${AI_LESSONS.length} / ${AI_LESSONS.length}`,
  );
});

test("mobile layout, keyboard controls, accessibility and unavailable storage", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("storage unavailable");
      },
    });
  });
  await page.goto("/learn/ai");
  await expect(page.locator(".ai-progress-summary")).toContainText("브라우저 저장이 차단되어");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await waitForUiTransitions(page);
  expect((await new AxeBuilder({ page }).include("#main-content").analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({ path: `artifacts/ai-catalog-mobile-${info.project.name}.png` });
  await page.goto("/learn/ai/jev-decisions");
  await page.getByRole("button", { name: "선택하며 실습하기", exact: true }).click();
  // The stage change moves focus to its heading on the next frame; focus the choice after that.
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.tagName ?? ""))
    .toMatch(/^H[1-6]$/);
  await page.getByRole("radio").first().focus();
  await page.keyboard.press("Space");
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  await expect(page.locator(".ai-feedback")).toContainText("점수를 받아도");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await waitForUiTransitions(page);
  expect((await new AxeBuilder({ page }).include("#main-content").analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: `artifacts/ai-lesson-mobile-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "확인 문제 풀기" }).click();
  await page.getByRole("radio").nth(correctQuizIndex(AI_CONTENT["jev-decisions"].quiz)).check();
  await page.getByRole("button", { name: "답 확인하기" }).click();
  await expect(page.locator(".ai-completion")).toBeVisible();
});

test("unknown lessons offer a route back", async ({ page }) => {
  await page.goto("/learn/ai/does-not-exist");
  await expect(page.getByRole("heading", { name: "이 수업을 찾을 수 없어요" })).toBeVisible();
  await page.getByRole("link", { name: "AI 수업 목록으로" }).click();
  await expect(page).toHaveURL(/\/learn\/ai$/);
});

import { openLabTools, waitForUiTransitions } from "./ui-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readHandoffDraft } from "../src/lib/handoff/draft";

const reason = "같은 객체를 참조합니다. <img src=x onerror=alert(1)>는 설명에 넣은 문자열입니다.";
const learnerQuote = "같은 객체를 참조합니다.";
const goal = "배열과 항목 객체의 참조가 각각 같은지 확인합니다.";
test("coaching focus preserves exact learner text, escapes HTML and restores legacy questions", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  let legacy = false;
  await page.route("**/api/problems/handoff-cart/coach", async (route) => {
    await route.fulfill({
      json: {
        evidenceId: "prediction",
        observation: "원본은 두 수량이 모두 3입니다.",
        question: "배열과 항목의 참조를 각각 비교해 볼까요?",
        nextCheck: "같은 입력으로 두 참조를 확인합니다.",
        ...(legacy
          ? {}
          : {
              focus: { learnerQuote: reason, goal },
              experiment: {
                expression:
                  "(() => { const items=[{id:'a',quantity:2}]; const next=changeQuantity(items,'a',1); return [items===next,items[0]===next[0]]; })()",
              },
            }),
      },
    });
  });
  await page.goto("/problems/handoff-cart");
  await page.getByRole("radio", { name: "원본 3, 반환값 3" }).check();
  await page.getByLabel("왜 그렇게 생각했나요?").fill(reason);
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await openLabTools(page);
  await page.getByRole("button", { name: "내 예상에 맞는 AI 질문 받기" }).click();
  const focus = page.getByLabel("질문의 초점");
  await expect(focus.locator("blockquote")).toHaveText(reason);
  await expect(focus).toContainText(goal);
  await expect(focus.locator("img")).toHaveCount(0);
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/problems/handoff-cart")).json();
      return readHandoffDraft(data.progress?.code ?? "").training?.coach?.focus?.learnerQuote;
    })
    .toBe(reason);
  await page.reload();
  await page.getByRole("button", { name: "비교 결과 다시 보기" }).click();
  await expect(focus).toContainText(learnerQuote);
  await expect(focus).toContainText(goal);
  await waitForUiTransitions(page);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === "chromium") {
    await focus.evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page
      .locator(".lab-ai-question")
      .screenshot({ path: "artifacts/coaching-focus-mobile.png" });
  }
  legacy = true;
  await page.getByRole("button", { name: "현재 코드로 AI 질문 다시 받기" }).click();
  await expect(focus).toHaveCount(0);
  await expect(page.getByLabel("AI 맞춤 질문")).toContainText(
    "배열과 항목의 참조를 각각 비교해 볼까요?",
  );
  expect(dialogs).toEqual([]);
});

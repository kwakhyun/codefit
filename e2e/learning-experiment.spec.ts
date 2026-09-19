import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { handoffProblems } from "../src/data/handoff-problems";
import { readHandoffDraft } from "../src/lib/handoff/draft";
import { codeHash } from "../src/lib/handoff/training";
import { setCode } from "./editor-helpers";

const problem = handoffProblems.find((p) => p.id === "handoff-cart")!;
const expression =
  "(() => { const items = [{id:'a',quantity:2}]; const next = changeQuantity(items,'a',1); return [items[0].quantity,next[0].quantity]; })()";
async function stage(page: Page, index: number) {
  await page
    .getByRole("navigation", { name: "코드 이해 훈련 단계" })
    .getByRole("button")
    .nth(index)
    .click();
}
async function begin(page: Page) {
  await page.goto("/problems/handoff-cart");
  await page.getByRole("radio", { name: "원본 2, 반환값 3" }).check();
  await page.getByLabel("왜 그렇게 생각했나요?").fill("배열 복사와 객체 참조를 구분하겠습니다.");
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.locator(".lab-observation > .lab-comparison")).toContainText("[3,3]");
}
async function saved(page: Page) {
  return readHandoffDraft(
    (await (await page.request.get("/api/problems/handoff-cart")).json()).progress?.code ?? "",
  );
}
async function experimentEditor(page: Page) {
  const details = page.locator(".lab-experiment-editor");
  if (!(await details.evaluate((e) => (e as HTMLDetailsElement).open)))
    await details.locator("summary").click();
}
async function run(page: Page) {
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }),
  ).toBeEnabled();
}

test("manual experiment compares real versions, persists and marks changed conditions on mobile", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await begin(page);
  await stage(page, 2);
  await setCode(page, problem.solution);
  await stage(page, 1);
  await experimentEditor(page);
  await page.getByLabel("실험 코드", { exact: true }).fill(expression);
  await page.getByLabel("실험 결과 예상").fill("원본 [3,3], 수정 [2,3]을 예상합니다.");
  await run(page);
  const result = page.getByLabel("추가 실험 결과");
  await expect(result).toContainText("[3,3]");
  await expect(result).toContainText("[2,3]");
  await expect
    .poll(async () => (await saved(page)).training?.experiment?.run?.current.actual)
    .toBe("[2,3]");
  expect(
    await page
      .getByLabel("실험 코드", { exact: true })
      .evaluate((e) => getComputedStyle(e).fontFamily),
  ).toContain("monospace");
  if (info.project.name === "chromium") {
    await page.locator(".lab-experiment").evaluate((e) => e.scrollIntoView({ block: "start" }));
    await page
      .locator(".lab-experiment")
      .screenshot({ path: "artifacts/learning-experiment-comparison.png" });
  }
  expect((await saved(page)).training?.prediction.reason).toBe(
    "배열 복사와 객체 참조를 구분하겠습니다.",
  );
  await page.reload();
  await stage(page, 1);
  await expect(result).toContainText("원본 [3,3], 수정 [2,3]");
  await experimentEditor(page);
  await expect(page.getByLabel("실험 코드", { exact: true })).toHaveValue(expression);
  await page.getByLabel("실험 코드", { exact: true }).fill("[1,2]");
  await expect(result).toContainText("이전에 실행한 실험 결과");
  await expect(result).toContainText("[3,3]");
  await run(page);
  await expect(result.locator(".lab-comparison > div").first()).toContainText("[1,2]");
  await expect(result.locator(".lab-comparison > div").last()).toContainText("[1,2]");
  await expect(result).not.toContainText("통과");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("실험 코드", { exact: true }).focus();
  await page.screenshot({
    path: `artifacts/learning-experiment-${info.project.name}.png`,
    fullPage: true,
  });
});

test("AI proposal is inspected and imported explicitly, execution and recovery do not call AI again", async ({
  page,
}, info) => {
  let calls = 0;
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  await page.route("**/api/problems/handoff-cart/coach", async (route) => {
    calls++;
    await route.fulfill({
      json: {
        evidenceId: "prediction",
        observation: "원본은 [3,3]입니다.",
        question: "원본과 반환 항목이 같은 객체인지 확인할까요?",
        nextCheck: "같은 수량을 두 코드에서 비교하세요.",
        experiment: { expression },
      },
    });
  });
  await begin(page);
  await page.getByRole("button", { name: "내 예상에 맞는 AI 질문 받기" }).click();
  await expect(page.getByRole("button", { name: "AI 실험 코드 가져오기" })).toBeVisible();
  await expect(page.getByLabel("추가 실험 결과")).toHaveCount(0);
  await page.getByText("AI 제안 코드 보기", { exact: true }).click();
  await expect(page.locator(".lab-experiment-proposal pre")).toHaveText(expression);
  await page.getByRole("button", { name: "AI 실험 코드 가져오기" }).click();
  await expect(page.getByLabel("실험 코드", { exact: true })).toBeFocused();
  await expect(page.getByLabel("실험 코드", { exact: true })).toHaveValue(expression);
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("추가 실험 결과")).toContainText("[3,3]");
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page
      .locator(".lab-experiment")
      .screenshot({ path: "artifacts/learning-experiment-proposal.png" });
  await page.getByLabel("실험 코드", { exact: true }).fill("(() => { while(true) {} })()");
  await run(page);
  await expect(
    page.getByLabel("추가 실험 결과").locator(".lab-comparison > div").first(),
  ).toContainText("실행 오류");
  await page
    .getByLabel("실험 코드", { exact: true })
    .fill("[typeof fetch, typeof process, typeof document]");
  await run(page);
  await expect(page.getByLabel("추가 실험 결과")).toContainText(
    '["undefined","undefined","undefined"]',
  );
  expect(calls).toBe(1);
});

test("late experiment preserves newer implementation and labels results with the old source", async ({
  page,
}) => {
  await begin(page);
  await stage(page, 2);
  await setCode(page, problem.starterCode);
  await stage(page, 1);
  await experimentEditor(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/quickjs/quickjs-0.32.0.wasm", async (route) => {
    await gate;
    await route.continue();
  });
  const requested = page.waitForRequest((r) => r.url().endsWith("quickjs-0.32.0.wasm"));
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).click();
  await requested;
  await stage(page, 2);
  await setCode(page, problem.solution);
  release();
  await stage(page, 1);
  await expect(page.getByLabel("추가 실험 결과")).toContainText("이전에 실행한 실험 결과");
  await expect
    .poll(async () => (await saved(page)).training?.experiment?.run?.codeHash)
    .toBe(await codeHash(problem.starterCode));
  expect((await saved(page)).implementation).toBe(problem.solution);
  await experimentEditor(page);
  await run(page);
  await expect(page.getByLabel("추가 실험 결과")).toContainText("[2,3]");
});

test("cancelling an experiment keeps saved results, and changed input rejects a late result", async ({
  page,
}) => {
  await begin(page);
  await experimentEditor(page);
  await run(page);
  await expect
    .poll(async () => (await saved(page)).training?.experiment?.run?.original.actual)
    .toBe("[3,3]");
  let cancelled = false;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/quickjs/quickjs-0.32.0.wasm", async (route) => {
    await gate;
    // Resolve the intercepted route even after Worker termination. Returning without
    // handling leaves Playwright's route completion pending and stalls unrouteAll.
    try {
      if (cancelled) await route.abort("aborted");
      else await route.continue();
    } catch (error) {
      if (
        !cancelled ||
        !(error instanceof Error) ||
        !/already handled|Target.*closed/.test(error.message)
      )
        throw error;
    }
  });
  const requested = page.waitForRequest((r) => r.url().endsWith("quickjs-0.32.0.wasm"));
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).click();
  await requested;
  cancelled = true;
  await page.getByRole("button", { name: "대기 취소", exact: true }).click();
  await expect(page.locator(".lab-error")).toContainText("취소");
  release();
  await page.unrouteAll({ behavior: "wait" });
  expect((await saved(page)).training?.experiment?.run?.original.actual).toBe("[3,3]");
  let releaseNext!: () => void;
  const nextGate = new Promise<void>((resolve) => {
    releaseNext = resolve;
  });
  await page.route("**/quickjs/quickjs-0.32.0.wasm", async (route) => {
    await nextGate;
    await route.continue();
  });
  const nextRequest = page.waitForRequest((r) => r.url().endsWith("quickjs-0.32.0.wasm"));
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).click();
  await nextRequest;
  await page.getByLabel("실험 코드", { exact: true }).fill("[9,9]");
  releaseNext();
  await expect(page.locator(".lab-error")).toContainText("실험 코드나 예상이 바뀌었습니다");
  expect((await saved(page)).training?.experiment?.run?.original.actual).toBe("[3,3]");
  await expect(page.getByLabel("실험 코드", { exact: true })).toHaveValue("[9,9]");
});

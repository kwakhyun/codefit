import { openLabTools, waitForUiTransitions } from "./ui-helpers";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readHandoffDraft } from "../src/lib/handoff/draft";
import { codeHash, experimentRunText } from "../src/lib/handoff/training";
const initialReason = "새 배열을 만들면 항목도 복사됩니다.";
const reflection = "배열과 항목의 참조를 따로 확인해야 합니다. <img src=x onerror=alert(1)>";
const expression =
  "(() => { const xs=[{id:'a',quantity:2}]; const ys=changeQuantity(xs,'a',1); return {array:xs===ys,item:xs[0]===ys[0]}; })()";
const reply = {
  evidenceId: "experiment",
  observation: "표시된 결과에서 두 참조가 같습니다.",
  question: "대상이 없는 입력에서도 참조가 유지될까요?",
  nextCheck: "없는 id로 두 코드를 비교하세요.",
  experiment: {
    expression:
      "(() => { const xs=[{id:'a',quantity:2}]; return xs===changeQuantity(xs,'missing',1); })()",
  },
  focus: { learnerQuote: reflection, goal: "대상 항목이 없는 경우의 참조를 확인합니다." },
};
async function saved(page: Page) {
  return readHandoffDraft(
    (await (await page.request.get("/api/problems/handoff-cart")).json()).progress?.code ?? "",
  );
}
async function begin(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  await page.goto("/problems/handoff-cart");
  await page.getByRole("radio", { name: "원본 2, 반환값 3" }).check();
  await page.getByLabel("왜 그렇게 생각했나요?").fill(initialReason);
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await openLabTools(page);
  await page.locator(".lab-experiment-editor summary").click();
  await page.getByLabel("실험 코드", { exact: true }).fill(expression);
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).click();
  await expect(page.getByLabel("실험 후 알게 된 점")).toBeEnabled();
  await page.getByLabel("실험 후 알게 된 점").fill(reflection);
}
test("follow-up uses both reports and reflection, retries without replacing the first prediction and restores safely", async ({
  page,
}, info) => {
  const requests: { evidence: string; requestId: string; code: string }[] = [];
  await page.route("**/api/problems/handoff-cart/coach", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill(
      requests.length === 1
        ? { status: 503, json: { error: "잠시 후 다시 요청해 주세요." } }
        : { json: reply },
    );
  });
  await begin(page);
  const button = page.getByRole("button", { name: "실험 결과로 다음 AI 질문 받기" });
  await button.click();
  await expect(page.locator(".lab-error")).toContainText("잠시 후");
  await button.click();
  await expect(page.getByLabel("질문의 초점")).toContainText(reflection);
  expect(requests).toHaveLength(2);
  expect(requests[0]).toEqual(requests[1]);
  expect(requests[0].evidence).toBe("experiment");
  const t = readHandoffDraft(requests[0].code).training!;
  expect(t.prediction.reason).toBe(initialReason);
  expect(t.experiment!.run!.original.actual).toBe('{"array":true,"item":true}');
  expect(t.experiment!.run!.current.actual).toBe('{"array":true,"item":true}');
  expect(t.experiment!.reflection!.runHash).toBe(
    await codeHash(experimentRunText(t.experiment!.run!)),
  );
  await expect.poll(async () => (await saved(page)).training?.coach?.evidenceId).toBe("experiment");
  await page.reload();
  await page.getByRole("button", { name: "비교 결과 다시 보기" }).click();
  await expect(page.getByLabel("실험 후 알게 된 점")).toHaveValue(reflection);
  await expect(page.getByLabel("질문의 초점").locator("img")).toHaveCount(0);
  await expect(page.getByLabel("AI 맞춤 질문")).not.toContainText("이전 실행 기록");
  await waitForUiTransitions(page);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  if (info.project.name === "chromium")
    await page
      .locator(".lab-experiment-reflection")
      .screenshot({ path: "artifacts/experiment-followup-mobile.png" });
  await openLabTools(page);
  await page.locator(".lab-experiment-editor summary").click();
  await page.getByLabel("실험 코드", { exact: true }).fill("[9,9]");
  await expect(button).toBeDisabled();
  await page.getByRole("button", { name: "두 코드로 실험 실행", exact: true }).click();
  await expect(page.getByRole("button", { name: "현재 결과에도 이 설명 사용하기" })).toBeEnabled();
  await expect(button).toBeDisabled();
  await expect(page.getByLabel("실험 후 알게 된 점")).toHaveValue(reflection);
  await page.getByRole("button", { name: "현재 결과에도 이 설명 사용하기" }).click();
  await expect(button).toBeEnabled();
  expect(requests).toHaveLength(2);
});
test("reflection edited during a pending AI call survives and discards the outdated question", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/problems/handoff-cart/coach", async (route) => {
    await gate;
    await route.fulfill({ json: reply });
  });
  await begin(page);
  const requested = page.waitForRequest((r) => r.url().endsWith("/handoff-cart/coach"));
  await page.getByRole("button", { name: "실험 결과로 다음 AI 질문 받기" }).click();
  await requested;
  const revised = "이 실행만으로 모든 입력의 참조 관계를 알 수는 없습니다.";
  await page.getByLabel("실험 후 알게 된 점").fill(revised);
  release();
  await expect(page.locator(".lab-error")).toContainText("현재 기록으로 다시 요청");
  await expect(page.getByLabel("AI 맞춤 질문")).toHaveCount(0);
  await expect
    .poll(async () => (await saved(page)).training?.experiment?.reflection?.text)
    .toBe(revised);
  expect((await saved(page)).training?.prediction.reason).toBe(initialReason);
});

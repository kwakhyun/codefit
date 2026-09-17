import { E2E_BASE_URL } from "../scripts/lib/e2e-environment";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { handoffProblems } from "../src/data/handoff-problems";
import { readHandoffDraft } from "../src/lib/handoff/draft";
import { readCode, setCode } from "./editor-helpers";

const base = handoffProblems.find((p) => p.id === "handoff-cart")!;
const reason = "반환값을 새 배열로 받아 사용하므로 원본 수량은 유지된다고 예상합니다.";
async function stage(page: Page, index: number) {
  await page
    .getByRole("navigation", { name: "코드 이해 훈련 단계" })
    .getByRole("button")
    .nth(index)
    .click();
}
async function predict(page: Page) {
  await page.goto("/problems/handoff-cart?from=%2Fhandoff");
  await page.getByRole("radio", { name: "원본 2, 반환값 3" }).check();
  await page.getByLabel("왜 그렇게 생각했나요?").fill(reason);
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.locator(".lab-comparison")).toContainText("[3,3]");
}
async function saved(page: Page) {
  const response = await page.request.get("/api/problems/handoff-cart");
  return readHandoffDraft((await response.json()).progress?.code ?? "");
}
async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
}
async function capture(page: Page, name: string) {
  await page.evaluate(() => {
    (document.activeElement as HTMLElement)?.blur();
    window.scrollTo(0, 0);
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
  await page.screenshot({ path: `artifacts/${name}.png`, fullPage: true });
}
test("prediction → real execution → repair → independent transfer, keyboard and accessibility", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/problems/handoff-cart?from=%2Fhandoff");
  await expect(page.locator(".monaco-editor")).toHaveCount(0);
  await accessible(page);
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.getByRole("radio").first()).toBeFocused();
  await page.keyboard.press("Space");
  await page.getByLabel("왜 그렇게 생각했나요?").fill(reason);
  await expect(page.locator(".lab-error")).toHaveCount(0);
  if (info.project.name === "chromium") await capture(page, "understanding-predict");
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.locator(".lab-comparison")).toContainText("[3,3]");
  await expect(page.locator("#lab-stage-title")).toBeFocused();
  await expect(page.locator(".lab-comparison")).toContainText("예상과 다른 결과");
  await accessible(page);
  if (info.project.name === "chromium") await capture(page, "understanding-observe");
  await expect.poll(async () => (await saved(page)).training?.observation?.actual).toBe("[3,3]");
  await page.reload();
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toHaveValue(reason);
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "비교 결과 다시 보기" }).click();
  await page.getByRole("button", { name: "내 코드 수정하고 테스트하기" }).click();
  await readCode(page);
  await expect(page.locator(".scenario")).not.toContainText(
    "서비스는 제출 코드를 실행하지 않습니다.",
  );
  await page.getByRole("button", { name: "내 코드 테스트", exact: true }).click();
  await expect(page.locator(".lab-test-summary")).toContainText("1/3개 통과");
  await setCode(page, base.solution);
  await expect(page.locator(".lab-tests .inline-warning")).toContainText("이전 실행 결과");
  await page.getByRole("button", { name: "내 코드 테스트", exact: true }).click();
  await expect(page.locator(".lab-test-summary")).toContainText("3/3개 통과");
  await accessible(page);
  if (info.project.name === "chromium") await capture(page, "understanding-repair");
  await stage(page, 3);
  await page.getByRole("link", { name: "새 상황에서 응용하기" }).click();
  await expect(page).toHaveURL(/handoff-cart-transfer/);
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toHaveValue("");
  expect(errors).toEqual([]);
});

test("async requests run deterministically; infinite code fails without freezing typing", async ({
  page,
}) => {
  await page.goto("/problems/handoff-latest");
  await page.getByRole("radio").first().check();
  await page
    .getByLabel("왜 그렇게 생각했나요?")
    .fill("나중에 시작한 요청의 결과만 보여 줄 것으로 예상합니다.");
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.locator(".lab-comparison")).toContainText('["new","old"]');
  await stage(page, 2);
  await readCode(page);
  await setCode(page, "while (true) {}");
  await page.getByRole("button", { name: "내 코드 테스트", exact: true }).click();
  const solution = handoffProblems.find((p) => p.id === "handoff-latest")!.solution;
  await setCode(page, solution);
  await expect(page.locator(".lab-tests .inline-warning")).toContainText("이전 실행 결과");
  await expect(page.locator(".lab-fail")).toHaveCount(3);
  expect(await readCode(page)).toBe(solution);
  await page.getByRole("button", { name: "내 코드 테스트", exact: true }).click();
  await expect(page.locator(".lab-test-summary")).toContainText("3/3개 통과");
});

test("mobile prediction, offline preservation, late AI coaching does not overwrite newer edits", async ({
  page,
  context,
}, info) => {
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await predict(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accessible(page);
  if (info.project.name === "chromium") await capture(page, "understanding-mobile");
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/problems/handoff-cart/coach", async (route) => {
    await gate;
    await route.fulfill({
      json: {
        evidenceId: "prediction",
        observation: "표시된 원본의 수량은 둘 다 3입니다.",
        question: "수량을 바꾼 객체를 원본 배열도 참조하고 있나요?",
        nextCheck: "객체 참조가 같은지 비교해 보세요.",
      },
    });
  });
  const request = page.waitForRequest((r) => r.url().endsWith("/coach"));
  await page.getByRole("button", { name: "내 예상에 맞는 AI 질문 받기" }).click();
  await request;
  await stage(page, 2);
  await readCode(page);
  await setCode(page, base.solution);
  await stage(page, 3);
  await page
    .getByRole("textbox", { name: "구조 이해", exact: true })
    .fill("AI 질문을 기다리는 동안 추가로 분석한 입력과 출력입니다.");
  release();
  await expect
    .poll(async () => (await saved(page)).training?.coach?.question)
    .toContain("원본 배열");
  expect(await readCode(page)).toBe(base.solution);
  await stage(page, 1);
  await expect(page.getByLabel("AI 맞춤 질문")).toContainText("코드가 바뀌었습니다");
  await context.setOffline(true);
  await stage(page, 3);
  await page
    .getByRole("textbox", { name: "문제 판단", exact: true })
    .fill("오프라인에서 추가로 분석한 참조 공유 문제입니다.");
  await expect(page.locator(".save-indicator")).toContainText("오프라인 보관");
  await context.setOffline(false);
  await expect.poll(async () => (await saved(page)).notes.diagnosis).toContain("오프라인");
  expect((await saved(page)).training?.prediction.reason).toBe(reason);
});

test("prediction conflicts preserve both records and expose readable comparison", async ({
  page,
  context,
}) => {
  await page.goto("/problems/handoff-cart");
  await page.getByLabel("왜 그렇게 생각했나요?").waitFor();
  const other = await context.newPage();
  await other.goto("/problems/handoff-cart");
  await other.getByLabel("왜 그렇게 생각했나요?").fill("서버에서 먼저 저장한 다른 예상입니다.");
  await expect
    .poll(async () => (await saved(page)).training?.prediction.reason)
    .toContain("서버에서");
  await page.getByLabel("왜 그렇게 생각했나요?").fill("내 탭에서 나중에 작성한 첫 예상입니다.");
  await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toBeVisible();
  await page.getByText("내 초안과 서버 저장본 비교", { exact: true }).click();
  await expect(page.locator(".training-conflict-record").first()).toContainText("내 탭에서");
  await expect(page.locator(".training-conflict-record").last()).toContainText("서버에서");
  await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).click();
  await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toHaveCount(0);
  await expect
    .poll(async () => (await saved(page)).training?.prediction.reason)
    .toContain("내 탭에서");
  await other.close();
});

test("coaching API validates observations, isolates accounts and does not execute submitted code", async ({
  page,
  browser,
}) => {
  await page.goto("/problems/handoff-cart");
  const lab = await page.request.get("/api/problems/handoff-cart/lab");
  expect(lab.headers()["cache-control"]).toBe("no-store");
  const data = await lab.json();
  expect(data).not.toHaveProperty("solution");
  expect((await page.request.get("/api/problems/be-pagination/lab")).status()).toBe(404);
  const invalid = await page.request.post("/api/problems/handoff-cart/coach", {
    data: { code: base.starterCode, requestId: crypto.randomUUID() },
  });
  expect(invalid.status()).toBe(400);
  await predict(page);
  await expect.poll(async () => (await saved(page)).training?.observation?.actual).toBe("[3,3]");
  const other = await browser.newContext();
  expect(
    (await (await other.request.get(`${E2E_BASE_URL}/api/problems/handoff-cart`)).json()).progress,
  ).toBeNull();
  await other.close();
  const workspace = await (await page.request.get("/api/workspace")).json();
  const code = (await (await page.request.get("/api/problems/handoff-cart")).json()).progress.code;
  const changed = await page.request.post("/api/problems/handoff-cart/coach", {
    headers: { "X-Codefit-Workspace": "user:someone-else" },
    data: { code, requestId: crypto.randomUUID() },
  });
  expect(changed.status()).toBe(409);
  const crossSite = await page.request.post("/api/problems/handoff-cart/coach", {
    headers: { Origin: "https://example.com" },
    data: { code, requestId: crypto.randomUUID() },
  });
  expect(crossSite.status()).toBe(403);
  const noKey = await page.request.post("/api/problems/handoff-cart/coach", {
    headers: { "X-Codefit-Workspace": workspace.scope },
    data: { code, requestId: crypto.randomUUID() },
  });
  expect(noKey.status()).toBe(503);
});

test("coaching failure retries the same snapshot and preserves prediction and notes", async ({
  page,
}) => {
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  await predict(page);
  const requests: { code: string; requestId: string }[] = [];
  await page.route("**/api/problems/handoff-cart/coach", (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({
      status: 502,
      json: { error: "질문을 받지 못했습니다. 다시 시도해 주세요." },
    });
  });
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: "내 예상에 맞는 AI 질문 받기" }).click();
    await expect(page.locator(".lab-error")).toContainText("질문을 받지 못했습니다");
  }
  expect(requests[0]).toEqual(requests[1]);
  await stage(page, 3);
  const diagnosis = page.getByRole("textbox", { name: "문제 판단", exact: true });
  await diagnosis.fill("원본과 반환값의 객체 참조를 추가로 비교하는 메모입니다.");
  await expect(diagnosis).toHaveValue("원본과 반환값의 객체 참조를 추가로 비교하는 메모입니다.");
  await expect(diagnosis).toBeFocused();
  await stage(page, 1);
  await page.getByRole("button", { name: "내 예상에 맞는 AI 질문 받기" }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].requestId).not.toBe(requests[1].requestId);
  await expect.poll(async () => (await saved(page)).notes.diagnosis).toContain("추가로 비교");
  expect((await saved(page)).training?.prediction.reason).toBe(reason);
});

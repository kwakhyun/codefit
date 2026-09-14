import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readCode, setCode } from "./editor-helpers";
import { readHandoffDraft, writeHandoffDraft } from "../src/lib/handoff/draft";
import { handoffProblems } from "../src/data/handoff-problems";

const base = handoffProblems.find((p) => p.id === "handoff-cart")!;
const notes = {
  understanding: "입력 항목의 수량을 처리하며 반환 배열과 원본 객체의 소유 관계를 확인합니다.",
  diagnosis: "배열 복사만으로 객체 변경을 막을 수 없으므로 원본 수량이 함께 변하는지 확인합니다.",
  verification:
    "입력 수량 1에서 -5 변경 시 대상 항목이 제거되어야 합니다. assert.deepEqual(changeQuantity([{id:'a',quantity:1}], 'a', -5), []); 미실행입니다.",
  decision:
    "대상 항목을 새 객체로 만들고 다른 항목을 유지했습니다. 배포 전에 실제 화면과 연결해 검증해야 합니다.",
};
async function openHandoff(page: Page) {
  await page.goto("/problems/handoff-cart?from=%2Fhandoff");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await readCode(page);
}
async function fillNotes(page: Page) {
  for (const [key, value] of Object.entries(notes))
    await page.locator(`#handoff-${key}`).fill(value);
}
async function saved(page: Page) {
  return (await (await page.request.get("/api/problems/handoff-cart")).json()).progress?.code as
    string | undefined;
}
async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
}
function reviewed() {
  return {
    passed: false,
    score: 50,
    summary: "기존 코드의 변경 범위와 테스트 근거를 더 구체적으로 작성하세요.",
    criteria: base.requirements.map((_, requirementIndex) => ({
      requirementIndex,
      passed: requirementIndex < 3,
      feedback: "새 요구사항과 검증 계획을 보완해 주세요.",
    })),
    strengths: [],
    improvements: [],
  };
}

test("handoff discovery, no answer leak, mobile layout, keyboard navigation and accessibility", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("link", { name: /NEW \/ AI 코드 인수인계 훈련/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("이제 내가 책임질 차례");
  await expect(page.locator(".handoff-card")).toHaveCount(6);
  await expect(page.getByRole("status")).toContainText("0/6개");
  await accessible(page);
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: "artifacts/handoff-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accessible(page);
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: "artifacts/handoff-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "인수인계 시작 : 장바구니 상태 인수인계" }).click();
  await expect(page.locator("#handoff-understanding")).toBeVisible();
  await page.getByRole("button", { name: "1. 이해" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#handoff-understanding")).toBeFocused();
  await page.keyboard.insertText(
    "키보드로 구조 이해 메모를 작성합니다. 원본 데이터와 반환값을 확인합니다.",
  );
  await page.getByRole("button", { name: "4. 검증" }).click();
  await expect(page.locator("#handoff-verification")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accessible(page);
  const detail = await (await page.request.get("/api/problems/handoff-cart")).json();
  expect(detail.problem).not.toHaveProperty("solution");
  expect(detail.solution).toBeNull();
  await page.locator(".workspace-breadcrumb").getByRole("link", { name: "인수인계 훈련" }).click();
  await expect(page).toHaveURL(/\/handoff$/);
  expect(errors).toEqual([]);
});

test("handoff code and report persist together, retain offline edits, and remain private", async ({
  page,
  context,
  browser,
}) => {
  await openHandoff(page);
  await fillNotes(page);
  await setCode(page, base.solution);
  await expect.poll(async () => readHandoffDraft((await saved(page)) ?? "").notes).toEqual(notes);
  await expect
    .poll(async () => readHandoffDraft((await saved(page)) ?? "").implementation)
    .toBe(base.solution);
  await page.reload();
  await expect(page.locator("#handoff-diagnosis")).toHaveValue(notes.diagnosis);
  expect(await readCode(page)).toBe(base.solution);
  await context.setOffline(true);
  const offline = notes.decision + " 오프라인에서도 메모를 보존합니다.";
  await page.locator("#handoff-decision").fill(offline);
  await expect(page.locator(".save-indicator")).toContainText("오프라인 보관");
  await context.setOffline(false);
  await expect
    .poll(async () => readHandoffDraft((await saved(page)) ?? "").notes.decision)
    .toBe(offline);
  const other = await browser.newContext();
  expect(
    (await (await other.request.get("http://127.0.0.1:3010/api/problems/handoff-cart")).json())
      .progress,
  ).toBeNull();
  await other.close();
  const response = await page.request.post("/api/problems/handoff-cart/review", {
    data: { requestId: crypto.randomUUID(), code: base.solution },
  });
  expect(response.status()).toBe(400);
  expect((await response.json()).error).toContain("구조 이해");
});

test("two tabs compare code and report; edits made during a repeated conflict survive", async ({
  page,
  context,
}, testInfo) => {
  await openHandoff(page);
  const tabB = await context.newPage();
  await openHandoff(tabB);
  await tabB.locator("#handoff-understanding").fill(notes.understanding + " 서버 최신 메모");
  await expect
    .poll(async () => readHandoffDraft((await saved(page)) ?? "").notes.understanding)
    .toContain("서버 최신 메모");
  await page.locator("#handoff-understanding").fill(notes.understanding + " 내 별도 메모");
  await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toBeVisible();
  await page.getByText("내 초안과 서버 저장본 비교", { exact: true }).click();
  await expect(page.locator("#remote-conflict-understanding")).toContainText("서버 최신 메모");
  await page.locator("#local-conflict-diagnosis").fill(notes.diagnosis);
  await tabB.locator("#handoff-understanding").fill(notes.understanding + " 서버가 또 변경됨");
  await expect
    .poll(async () => readHandoffDraft((await saved(page)) ?? "").notes.understanding)
    .toContain("또 변경됨");
  await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).click();
  await expect(page.locator("#remote-conflict-understanding")).toContainText("또 변경됨");
  await expect(page.locator("#handoff-diagnosis")).toHaveValue(notes.diagnosis);
  await accessible(page);
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: "artifacts/handoff-conflict.png", fullPage: true });
  await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).click();
  await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toHaveCount(0);
  await expect
    .poll(async () => readHandoffDraft((await saved(page)) ?? "").notes.diagnosis)
    .toBe(notes.diagnosis);
  await expect(page.locator(".monaco-editor textarea").first()).toBeFocused();
  await tabB.close();
});

test("mocked AI review uses the submitted snapshot and never replaces newer notes", async ({
  page,
}) => {
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, aiReady: true } });
  });
  await openHandoff(page);
  await fillNotes(page);
  await setCode(page, base.solution);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submitted = "";
  await page.route("**/api/problems/handoff-cart/review", async (route) => {
    submitted = route.request().postDataJSON().code;
    await gate;
    const detail = await (await page.request.get("/api/problems/handoff-cart")).json();
    await route.fulfill({
      json: {
        attempt: {
          id: "mock-handoff-review",
          problemId: base.id,
          code: submitted,
          review: reviewed(),
          createdAt: new Date().toISOString(),
          assisted: false,
        },
        progress: detail.progress,
      },
    });
  });
  const request = page.waitForRequest((r) => r.url().endsWith("/handoff-cart/review"));
  await page.getByRole("button", { name: "AI 풀이 검토", exact: true }).click();
  await request;
  const newer = notes.decision + " 검토 중 추가로 발견한 위험입니다.";
  await page.locator("#handoff-decision").fill(newer);
  release();
  await expect(page.getByText("현재 코드와 다른 제출본의 검토 결과입니다.")).toBeVisible();
  expect(readHandoffDraft(submitted).notes.decision).toBe(notes.decision);
  await expect(page.locator("#handoff-decision")).toHaveValue(newer);
  await page.locator(".submitted-code summary").click();
  await expect(page.locator(".submitted-code pre")).toContainText("[인수인계 판단]");
  await page.getByRole("button", { name: "이 제출본으로 이어 풀기" }).click();
  await page.getByRole("button", { name: "제출본 불러오기" }).click();
  await expect(page.locator("#handoff-decision")).toHaveValue(notes.decision);
  await page.getByRole("button", { name: "변경 취소" }).click();
  await expect(page.locator("#handoff-decision")).toHaveValue(newer);
  await accessible(page);
});

test("private learning feedback shows a due transfer and survives backup roundtrip", async ({
  page,
  browser,
}) => {
  await page.goto("/handoff");
  const backup = await (await page.request.get("/api/export")).json();
  const code = writeHandoffDraft(base.solution, notes);
  backup.attempts = [
    {
      id: "handoff-reviewed-base",
      problemId: base.id,
      code,
      review: reviewed(),
      assisted: false,
      createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    },
  ];
  expect((await page.request.post("/api/import", { data: backup })).status()).toBe(200);
  await page.reload();
  const card = page
    .locator(".handoff-card")
    .filter({ has: page.getByRole("heading", { name: base.title }) });
  await expect(card).toContainText("7일이 지났습니다");
  await card.getByText("다시 연습할 부분 3개").click();
  await expect(card).toContainText("검증 설계");
  const response = await page.request.get("/api/handoff");
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(JSON.stringify(await response.json())).not.toContain("CODEFIT_HANDOFF_V1");
  const exported = await (await page.request.get("/api/export")).json();
  expect(exported.attempts.some((a: { code: string }) => a.code === code)).toBe(true);
  const other = await browser.newContext();
  const otherData = await (await other.request.get("http://127.0.0.1:3010/api/handoff")).json();
  expect(otherData.learning.every((t: { base: unknown }) => t.base === null)).toBe(true);
  await other.close();
  await card.getByRole("link", { name: /예약 인원 변경/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("예약 인원 변경");
  await expect(page.locator("#handoff-understanding")).toHaveValue("");
});

test("reset retains handoff notes and undo restores the code; review errors retain every field", async ({
  page,
}) => {
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({ response, json: { ...body, aiReady: true } });
  });
  await openHandoff(page);
  await fillNotes(page);
  await setCode(page, base.solution);
  await page.getByRole("button", { name: "시작 코드로 초기화", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("작성한 인수인계 메모는 유지됩니다.");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "시작 코드로 초기화", exact: true })
    .click();
  await expect.poll(() => readCode(page)).toBe(base.starterCode);
  await expect(page.locator("#handoff-understanding")).toHaveValue(notes.understanding);
  await page.getByRole("button", { name: "변경 취소" }).click();
  await expect.poll(() => readCode(page)).toBe(base.solution);
  await page.route("**/api/problems/handoff-cart/review", (route) =>
    route.fulfill({
      status: 502,
      json: { error: "AI 응답을 받지 못했습니다. 다시 시도해 주세요." },
    }),
  );
  await page.getByRole("button", { name: "AI 풀이 검토", exact: true }).click();
  await expect(page.locator(".workspace-error")).toContainText("AI 응답을 받지 못했습니다");
  for (const [key, value] of Object.entries(notes))
    await expect(page.locator(`#handoff-${key}`)).toHaveValue(value);
  expect(await readCode(page)).toBe(base.solution);
});

test("audit: original code, stable labels, missing-note focus and handoff document download", async ({
  page,
}, testInfo) => {
  await page.route("**/api/workspace?*", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  await openHandoff(page);
  await page.getByText("인수받은 원본 코드 보기", { exact: true }).click();
  await expect(page.locator(".handoff-original pre")).toContainText(base.starterCode);
  await setCode(page, base.solution);
  await page.getByRole("button", { name: "AI 풀이 검토", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "구조 이해", exact: true })).toBeFocused();
  await fillNotes(page);
  await expect(page.locator(".handoff-readiness")).toContainText("4/4");
  await expect(page.locator(".workspace-error")).toHaveCount(0);
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "인수인계 문서 저장" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("handoff-cart-handoff.md");
  const { readFile } = await import("node:fs/promises");
  const content = await readFile((await file.path())!, "utf8");
  expect(content).toContain(base.solution);
  expect(content).toContain(notes.decision);
  await expect(page.locator(".handoff-original pre")).toContainText(base.starterCode);
  await accessible(page);
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: "artifacts/handoff-audit-workspace.png", fullPage: true });
  await expect.poll(async () => readHandoffDraft((await saved(page)) ?? "").notes).toEqual(notes);
  await page.goto("/handoff");
  await expect(page.locator(".handoff-recommendation")).toContainText("작성 중인 과제 이어가기");
  await expect(page.locator(".handoff-recommendation")).toContainText(base.title);
});

test("audit: revisiting the base preserves retention and latest variant feedback drives next practice", async ({
  page,
}, testInfo) => {
  await page.goto("/handoff");
  const backup = await (await page.request.get("/api/export")).json();
  const now = Date.now(),
    day = 86400000;
  const pass = {
    ...reviewed(),
    passed: true,
    score: 100,
    criteria: reviewed().criteria.map((c) => ({ ...c, passed: true })),
  };
  const make = (id: string, problemId: string, days: number, review = pass) => ({
    id,
    problemId,
    code: writeHandoffDraft(base.solution, notes),
    review,
    assisted: false,
    createdAt: new Date(now - days * day).toISOString(),
  });
  backup.attempts = [
    make("audit-base-first", base.id, 30),
    make("audit-transfer-first", base.id + "-transfer", 22),
    make("audit-base-later", base.id, 12),
    make("audit-transfer-later", base.id + "-transfer", 8, reviewed()),
  ];
  expect((await page.request.post("/api/import", { data: backup })).status()).toBe(200);
  await page.reload();
  const card = page
    .locator(".handoff-card")
    .filter({ has: page.getByRole("heading", { name: base.title }) });
  await expect(card).toContainText("최근 변형 과제: AI 기준 50%");
  await expect(card).toContainText("첫 지연 재도전에서 서비스 내 도움 없이 AI 기준을 충족");
  await expect(card.getByRole("link", { name: /7일 복습 시작/ })).toHaveAttribute(
    "href",
    /handoff-cart-transfer/,
  );
  await card.getByText("다시 연습할 부분 3개").click();
  await expect(card).toContainText("검증 설계");
  await accessible(page);
  if (testInfo.project.name === "chromium")
    await page.screenshot({ path: "artifacts/handoff-audit-dashboard.png", fullPage: true });
});

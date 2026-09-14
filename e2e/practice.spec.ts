import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { editor, setCode, readCode } from "./editor-helpers";

async function home(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "검색 결과가 뒤바뀌는 버그 수정하기" }),
  ).toBeVisible();
}
async function accessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}

test("anonymous entry, paged search, URL restoration, and home accessibility", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await home(page);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.locator(".problem-row")).toHaveCount(8);
  await accessible(page);
  await page.getByRole("button", { name: "다음 페이지" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.locator(".problem-row")).toHaveCount(8);
  await page.getByRole("textbox", { name: "문제 검색" }).fill("TCP");
  await expect(page.locator(".problem-row")).toHaveCount(1);
  await page.locator(".problem-link").click();
  await expect(page).toHaveURL(/\/problems\/net-framing/);
  await page.locator(".workspace-breadcrumb").getByRole("link", { name: "문제 보관함" }).click();
  await expect(page.getByRole("textbox", { name: "문제 검색" })).toHaveValue("TCP");
  expect(errors).toEqual([]);
});

test("a late search response cannot overwrite a newer query", async ({ page }) => {
  await home(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/library?*", async (route) => {
    if (new URL(route.request().url()).searchParams.get("q") === "TCP") {
      const response = await route.fetch();
      await gate;
      await route.fulfill({ response }).catch(() => {});
    } else await route.continue();
  });
  const oldRequest = page.waitForRequest((r) => r.url().includes("q=TCP"));
  await page.getByRole("textbox", { name: "문제 검색" }).fill("TCP");
  await oldRequest;
  await page.getByRole("textbox", { name: "문제 검색" }).fill("Docker");
  await expect(
    page.getByRole("heading", { name: "무겁고 권한이 큰 Docker 이미지 개선하기" }),
  ).toBeVisible();
  release();
  await expect(page.locator(".problem-row")).toHaveCount(1);
  await expect(page.getByRole("textbox", { name: "문제 검색" })).toHaveValue("Docker");
});

test("draft survives reload; anonymous browsers remain isolated; hints preserve code", async ({
  page,
  browser,
}) => {
  await editor(page);
  const draft = "def paginate(items, page=1, size=20):\n    return {'draft': 'saved'}";
  await setCode(page, draft);
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/problems/be-pagination")).json()).progress?.code,
    )
    .toBe(draft);
  await page.reload();
  await page.waitForFunction(
    () =>
      (
        window as unknown as { monaco?: { editor: { getModels(): unknown[] } } }
      ).monaco?.editor.getModels().length,
  );
  expect(await readCode(page)).toBe(draft);
  await page.getByRole("button", { name: /힌트/ }).first().click();
  expect(await readCode(page)).toBe(draft);
  const other = await browser.newContext();
  const response = await other.request.get("http://127.0.0.1:3010/api/problems/be-pagination");
  expect((await response.json()).progress).toBeNull();
  await other.close();
});

test("queued saves and an offline retry retain the latest code", async ({ page, context }) => {
  await editor(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let held = false;
  await page.route("**/api/progress/be-pagination", async (route) => {
    if (!held) {
      held = true;
      await gate;
    }
    await route.continue();
  });
  const requested = page.waitForRequest(
    (r) => r.url().includes("/api/progress/be-pagination") && r.method() === "PUT",
  );
  await setCode(page, "print('first pending save')");
  await requested;
  await setCode(page, "print('newer queued save')");
  release();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/problems/be-pagination")).json()).progress?.code,
    )
    .toBe("print('newer queued save')");
  await page.unroute("**/api/progress/be-pagination");
  await context.setOffline(true);
  await setCode(page, "print('offline draft survives')");
  await expect(page.getByText(/오프라인 보관/).first()).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/problems/be-pagination")).json()).progress?.code,
    )
    .toBe("print('offline draft survives')");
});

test("settings and quality page are accessible, with keyboard focus restored", async ({ page }) => {
  await home(page);
  const settings = page.getByRole("button", { name: "환경 설정" });
  await settings.click();
  await expect(page.getByRole("heading", { name: "내 AI 이용 현황" })).toBeVisible();
  await accessible(page);
  await page.keyboard.press("Escape");
  await expect(settings).toBeFocused();
  await page.getByRole("link", { name: "AI 검토 방식과 검증 결과", exact: true }).click();
  await expect(page.getByRole("heading", { name: /AI의 피드백도/ })).toBeVisible();
  await accessible(page);
});

test("mobile navigation, search and workspace have no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await home(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await accessible(page);
  await page.getByRole("button", { name: /메뉴 열기/ }).click();
  await expect(page.getByRole("link", { name: "학습 기록" })).toBeVisible();
  await page.keyboard.press("Escape");
  await editor(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("backup import keeps the active draft and old history links open the selected submission", async ({
  page,
}) => {
  await editor(page);
  const code = "print('keep my current draft during import')";
  await setCode(page, code);
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/problems/be-pagination")).json()).progress?.code,
    )
    .toBe(code);
  const backup = await (await page.request.get("/api/export")).json();
  const problem = backup.problems.find((p: { id: string }) => p.id === "be-pagination");
  const review = {
    passed: false,
    score: 0,
    summary: "요구사항 구현이 필요합니다.",
    criteria: problem.requirements.map((_: string, i: number) => ({
      requirementIndex: i,
      passed: false,
      feedback: "이 요구사항은 아직 구현하지 않았습니다.",
    })),
    strengths: [],
    improvements: [],
  };
  backup.attempts = Array.from({ length: 23 }, (_, i) => ({
    id: `history-${i}`,
    problemId: problem.id,
    code: `print('submission ${i}')`,
    review,
    assisted: false,
    createdAt: "2026-09-01T03:00:00.000Z",
  }));
  await page.getByRole("button", { name: "환경 설정" }).click();
  await page.getByLabel("학습 기록 백업 파일").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(backup)),
  });
  await expect(page.getByRole("dialog").getByText(/새 문제 0개, 풀이 기록 23개/)).toBeVisible();
  await page.keyboard.press("Escape");
  expect(await readCode(page)).toBe(code);
  await page.goto("/?view=history");
  await expect(page.locator(".timeline-item")).toHaveCount(20);
  await page.getByRole("button", { name: "이전 풀이 더 보기" }).click();
  await expect(page.locator(".timeline-item")).toHaveCount(23);
  const last = page.locator(".timeline-item").last();
  const href = (await last.getAttribute("href"))!;
  const attemptId = new URL(href, "http://127.0.0.1:3010").searchParams.get("attempt");
  const detail = await (
    await page.request.get(`/api/problems/be-pagination?attempt=${attemptId}`)
  ).json();
  const selected = detail.attempts.find((a: { id: string }) => a.id === attemptId);
  await last.click();
  await page.locator(".submitted-code summary").first().click();
  await expect(page.locator(".submitted-code pre").first()).toContainText(selected.code);
  await page.getByRole("button", { name: "이 제출본으로 이어 풀기" }).first().click();
  await page.getByRole("button", { name: "제출본 불러오기" }).click();
  await expect.poll(() => readCode(page)).toBe(selected.code);
  await page.getByRole("button", { name: "변경 취소" }).click();
  await expect.poll(() => readCode(page)).toBe(code);
});

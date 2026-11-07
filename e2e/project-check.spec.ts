import { waitForUiTransitions } from "./ui-helpers";
import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import type { CheckOverview } from "../src/lib/project-check/types";
/** The list holds summaries; an opened record is read from its own detail endpoint. */
async function routeDetails(page: Page, records: () => CheckOverview["checks"]) {
  await page.route(/\/api\/project-check\/[0-9a-f-]{36}$/, (route) => {
    const id = new URL(route.request().url()).pathname.split("/").pop();
    const record = records().find((check) => check.id === id);
    return record
      ? route.fulfill({ json: record })
      : route.fulfill({
          status: 404,
          json: { error: "이 계정에서 점검 기록을 찾을 수 없습니다." },
        });
  });
}
function overview(): CheckOverview {
  return {
    scope: "user:project-test",
    signedIn: true,
    aiReady: true,
    usage: {
      analysis: { limit: 2, remaining: 2, resetsAt: null },
      review: { limit: 4, remaining: 4, resetsAt: null },
    },
    nextCursor: null,
    checks: [],
  };
}
test("guests can enter project checks while stale writes remain blocked", async ({
  page,
  request,
}) => {
  await page.goto("/project-check");
  await expect(page.getByRole("link", { name: "로그인하고 AI 이용 횟수 늘리기" })).toBeVisible();
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const response = await request.fetch("/api/project-check", { method, data: {} });
    expect(response.status()).toBe(409);
  }
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await waitForUiTransitions(page);
  const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole("link", { name: "로그인하고 AI 이용 횟수 늘리기" }).click();
  await expect(page).toHaveURL(/login\?returnTo=/);
});
test("link to questions, draft restore, keyboard navigation, assessment and deletion", async ({
  page,
}, info) => {
  let data = overview();
  let lastAnswers: string[] = [];
  await page.route("**/api/project-check", async (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fulfill({ json: data });
    if (request.method() === "POST") {
      const body = request.postDataJSON();
      expect(body.consent).toBeUndefined();
      const check = { ...publicCheck(fixtureCheck), id: body.requestId };
      data = {
        ...data,
        checks: [check],
        usage: {
          ...data.usage,
          analysis: { limit: 2, remaining: 1, resetsAt: "2026-09-19T00:00:00Z" },
        },
      };
      return route.fulfill({ json: check });
    }
    if (request.method() === "PATCH") {
      lastAnswers = request.postDataJSON().answers;
      const review = { answers: lastAnswers, assessment: fixtureAssessment };
      data.checks[0] = { ...data.checks[0], review };
      return route.fulfill({ json: review });
    }
    if (request.method() === "DELETE") {
      data.checks = [];
      return route.fulfill({ json: { removed: true } });
    }
  });
  await routeDetails(page, () => data.checks);
  await page.goto("/project-check");
  await page
    .getByLabel("서비스 또는 공개 저장소 링크", { exact: true })
    .fill("https://example.com/");
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByRole("heading", { name: "예약 서비스 설계 점검" })).toBeFocused();
  await page
    .getByLabel("내 설계 설명")
    .fill("서버에 예약을 보내고 실패하면 이전 화면을 유지합니다.");
  await page.reload();
  await expect(page.getByLabel("내 설계 설명")).toHaveValue(
    "서버에 예약을 보내고 실패하면 이전 화면을 유지합니다.",
  );
  for (let i = 1; i < 5; i++) {
    await page.getByRole("button", { name: "다음 질문 →" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".project-questions h2")).toBeFocused();
    await page.getByLabel("내 설계 설명").fill("두 계정에서 요청해 결과가 저장되는지 확인합니다.");
  }
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await waitForUiTransitions(page);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "docs/images/project-check-questions.png", fullPage: true });
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
  await expect(page.getByRole("heading", { name: "설계 설명 점수 50 / 100" })).toBeVisible();
  expect(lastAnswers).toHaveLength(5);
  await waitForUiTransitions(page);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "docs/images/project-check-result.png", fullPage: true });
  await page.getByRole("button", { name: "프로젝트 삭제", exact: true }).click();
  const deletion = page.getByRole("dialog", { name: "프로젝트 삭제" });
  // The confirmation lists everything the deletion removes, not only questions and reviews.
  await expect(deletion).toContainText("코드 대화");
  await expect(deletion).toContainText("AI 워크숍");
  await deletion.getByRole("button", { name: "프로젝트 영구 삭제", exact: true }).click();
  await expect(page.getByRole("heading", { name: "어떤 프로젝트를 살펴볼까요?" })).toBeVisible();
});
test("quota, failed assessment retry and account isolation preserve the right drafts", async ({
  page,
}) => {
  let data = overview();
  data.checks = [publicCheck(fixtureCheck)];
  let attempts = 0;
  const submitted: string[][] = [];
  await page.route("**/api/project-check", async (route) => {
    if (route.request().method() === "PATCH") {
      attempts++;
      submitted.push(route.request().postDataJSON().answers);
      // A server-reported failure is definite: the answers unlock for editing or a retry.
      return route.fulfill({ status: 500, json: { error: "AI 응답을 받지 못했습니다." } });
    }
    return route.fulfill({ json: data });
  });
  await routeDetails(page, () => data.checks);
  await page.goto("/project-check");
  // Saved checks are folded under "점검 기록".
  await page.locator(".project-history-list > summary").click();
  await page.getByRole("button", { name: /예약 서비스 설계 점검/ }).click();
  await page.getByLabel("내 설계 설명").fill("나만의 설계 메모");
  await page.getByRole("button", { name: "5. 설계 선택" }).click();
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
  await expect(page.locator(".project-recovery[role=alert]")).toContainText(
    "AI 응답을 받지 못했습니다.",
  );
  await expect(page.getByLabel("내 설계 설명")).not.toHaveAttribute("readonly", "");
  await page.getByRole("button", { name: "답변 수정하기" }).click();
  await expect(page.getByLabel("내 설계 설명")).toBeFocused();
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
  await expect.poll(() => attempts).toBe(2);
  expect(submitted[0]).toEqual(submitted[1]);
  await page.reload();
  await expect(page.getByRole("button", { name: "다시 평가 요청" })).toBeEnabled();
  data = {
    ...overview(),
    scope: "user:another-account",
    usage: { ...data.usage, analysis: { limit: 2, remaining: 0, resetsAt: null } },
  };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "어떤 프로젝트를 살펴볼까요?" })).toBeVisible();
  await expect(page.getByRole("button", { name: "분석 횟수를 모두 사용했습니다" })).toBeDisabled();
  await expect(page.getByText("나만의 설계 메모")).toHaveCount(0);
});

test("real signed-in API keeps stored project evidence private across account changes", async ({
  page,
  context,
  baseURL,
}) => {
  const { testAccount } = await import("../scripts/lib/test-account");
  const { resolve } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const db = resolve(process.env.CODEFIT_PROJECT_TEST_DB || "artifacts/e2e.sqlite");
  const a = await testAccount(db, baseURL!);
  const b = await testAccount(db, baseURL!);
  const login = async (cookie: string) => {
    const [name, ...value] = cookie.split("=");
    await context.addCookies([
      { name, value: value.join("="), url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
  };
  try {
    const id = randomUUID(),
      claim = a.store.startJob(a.owner, id, "project-analysis", "test-input");
    if (claim.state !== "new") throw new Error();
    await a.store.queries.projectChecks.complete(claim.lease, { ...fixtureCheck, id });
    await login(a.cookie);
    const response = await page.request.get("/api/project-check");
    const owned = await response.json();
    expect(owned.scope).toBe(a.owner);
    expect(owned.checks[0].id).toBe(id);
    expect(owned.checks[0].page).not.toHaveProperty("text");
    // The list carries summaries only; questions come from the owner's detail request.
    expect(Object.keys(owned.checks[0].analysis)).toEqual(["title"]);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const detailResponse = await page.request.get(`/api/project-check/${id}`, {
      headers: { "x-codefit-workspace": a.owner },
    });
    const detail = await detailResponse.json();
    expect(detail.id).toBe(id);
    expect(detail.page).not.toHaveProperty("text");
    expect(detail.analysis.questions).toHaveLength(fixtureCheck.analysis.questions.length);
    for (const question of detail.analysis.questions)
      expect(question).not.toHaveProperty("criteria");
    expect(detailResponse.headers()["cache-control"]).toBe("no-store");
    await login(b.cookie);
    expect((await (await page.request.get("/api/project-check")).json()).checks).toEqual([]);
    expect(
      (
        await page.request.get(`/api/project-check/${id}`, {
          headers: { "x-codefit-workspace": b.owner },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await page.request.patch("/api/project-check", {
          headers: { "x-codefit-workspace": a.owner },
          data: { id, answers: Array(5).fill("test") },
        })
      ).status(),
    ).toBe(409);
    await page.request.delete("/api/project-check", {
      headers: { "x-codefit-workspace": b.owner },
      data: { id },
    });
    expect(await a.store.queries.projectChecks.get(a.owner, id)).not.toBeNull();
    await login(a.cookie);
    expect(
      (
        await page.request.post("/api/project-check", {
          headers: { "x-codefit-workspace": a.owner, origin: "https://unrelated.example" },
          data: {},
        })
      ).status(),
    ).toBe(403);
    await page.request.delete("/api/project-check", {
      headers: { "x-codefit-workspace": a.owner },
      data: { id },
    });
    expect(await a.store.queries.projectChecks.get(a.owner, id)).toBeNull();
  } finally {
    a.store.db.close();
    b.store.db.close();
  }
});

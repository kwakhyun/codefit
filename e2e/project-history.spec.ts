import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import type { CheckOverview } from "../src/lib/project-check/types";
import { testAccount } from "../scripts/lib/test-account";

const overview = (): CheckOverview => ({
  scope: "user:history-test",
  signedIn: true,
  aiReady: true,
  usage: {
    analysis: { limit: 2, remaining: 2, resetsAt: null },
    review: { limit: 4, remaining: 4, resetsAt: null },
  },
  checks: [],
  nextCursor: null,
});

test("older records remain reachable by pagination, reload and browser history", async ({
  page,
  context,
  baseURL,
}, info) => {
  const account = await testAccount(resolve("artifacts/e2e.sqlite"), baseURL!);
  try {
    for (let i = 0; i < 23; i++) {
      const id = randomUUID();
      const claim = account.store.startJob(account.owner, id, "project-analysis", "fixture");
      if (claim.state !== "new") throw new Error();
      await account.store.queries.projectChecks.complete(claim.lease, {
        ...fixtureCheck,
        id,
        analysis: { ...fixtureCheck.analysis, title: `저장된 프로젝트 ${i}` },
      });
    }
    const first = await account.store.queries.projectChecks.page(account.owner);
    const second = await account.store.queries.projectChecks.page(account.owner, first.nextCursor);
    const older = second.checks[0];
    const [name, ...value] = account.cookie.split("=");
    await context.addCookies([
      { name, value: value.join("="), url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
    await page.goto("/project-check");
    await expect(
      page.getByRole("button", { name: new RegExp(`${older.analysis.title}\\s+example`) }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "이전 기록 더 보기" }).click();
    await page
      .getByRole("button", { name: new RegExp(`${older.analysis.title}\\s+example`) })
      .click();
    await expect(page).toHaveURL(new RegExp(`check=${older.id}`));
    await expect(
      page.getByRole("heading", { name: older.analysis.title, exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: older.analysis.title, exact: true }),
    ).toBeVisible();
    await page.getByLabel("내 설계 설명").fill("새로고침해도 이어 쓸 설계 설명");
    await page.getByRole("button", { name: "+ 새 프로젝트 점검", exact: true }).click();
    await expect(page.getByRole("heading", { name: "어떤 서비스를 만드셨나요?" })).toBeVisible();
    await page.goBack();
    await expect(page.getByLabel("내 설계 설명")).toHaveValue("새로고침해도 이어 쓸 설계 설명");
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const summary = page.locator(".project-history-list > summary");
    const historyWidth = (await page.locator(".project-history").boundingBox())!.width;
    expect((await summary.boundingBox())!.width).toBeGreaterThanOrEqual(historyWidth - 2);
    await summary.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".project-history-list")).toHaveAttribute("open", "");
    await page.keyboard.press("Enter");
    await expect(page.locator(".project-history-list")).not.toHaveAttribute("open", "");
    await page.screenshot({
      path: `artifacts/project-history-mobile-${info.project.name}.png`,
      fullPage: true,
    });
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "이 점검 기록 삭제" }).click();
    await expect(page.getByRole("heading", { name: "어떤 서비스를 만드셨나요?" })).toBeVisible();
    await page.goto(`/project-check?check=${older.id}`);
    await expect(page.locator("main [role=alert]")).toContainText(
      "이 계정에서 점검 기록을 찾을 수 없습니다",
    );
    await expect(page.getByRole("heading", { name: "어떤 서비스를 만드셨나요?" })).toHaveCount(0);
  } finally {
    account.store.db.close();
  }
});

test("an uncertain analysis retries its ID but an explicit new check uses a new ID", async ({
  page,
}) => {
  let data = overview();
  const ids: string[] = [];
  await page.route(/\/api\/project-check(?:\?.*)?$/, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ json: data });
    const input = route.request().postDataJSON();
    ids.push(input.requestId);
    if (ids.length === 1)
      return route.fulfill({ status: 502, json: { error: "응답이 끊겼습니다." } });
    const check = { ...publicCheck(fixtureCheck), id: input.requestId };
    data = { ...data, checks: [check, ...data.checks.filter((c) => c.id !== check.id)] };
    return route.fulfill({ json: check });
  });
  await page.goto("/project-check");
  await page.getByLabel("서비스 링크", { exact: true }).fill("https://example.com/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("응답이 끊겼습니다");
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByRole("heading", { name: "예약 서비스 설계 점검" })).toBeVisible();
  expect(ids[1]).toBe(ids[0]);
  await page.getByRole("button", { name: "+ 새 프로젝트 점검", exact: true }).click();
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect.poll(() => ids.length).toBe(3);
  expect(ids[2]).not.toBe(ids[1]);
  await expect(page).toHaveURL(new RegExp(`check=${ids[2]}`));
});

test("account discovery recovers after visiting home and switching the signed-in account", async ({
  page,
  context,
  baseURL,
}) => {
  const a = await testAccount(resolve("artifacts/e2e.sqlite"), baseURL!);
  const b = await testAccount(resolve("artifacts/e2e.sqlite"), baseURL!);
  const login = async (cookie: string) => {
    const [name, ...value] = cookie.split("=");
    await context.addCookies([
      { name, value: value.join("="), url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
  };
  try {
    const id = randomUUID();
    const claim = a.store.startJob(a.owner, id, "project-analysis", "input");
    if (claim.state !== "new") throw new Error();
    await a.store.queries.projectChecks.complete(claim.lease, { ...fixtureCheck, id });
    await login(a.cookie);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "오늘은 무엇을 연습할까요?" })).toBeVisible();
    await page.locator('a[href="/project-check"]').first().click();
    await page.getByRole("button", { name: /예약 서비스 설계 점검/ }).click();
    await page.getByLabel("내 설계 설명").fill("첫 계정의 비공개 초안");
    await login(b.cookie);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("heading", { name: "어떤 서비스를 만드셨나요?" })).toBeVisible();
    await expect(page.getByRole("button", { name: /예약 서비스 설계 점검/ })).toHaveCount(0);
    await expect(page).not.toHaveURL(/check=/);
    await login(a.cookie);
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await page.getByRole("button", { name: /예약 서비스 설계 점검/ }).click();
    await expect(page.getByLabel("내 설계 설명")).toHaveValue("첫 계정의 비공개 초안");
  } finally {
    a.store.db.close();
    b.store.db.close();
  }
});

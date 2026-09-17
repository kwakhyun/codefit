import { E2E_BASE_URL } from "../scripts/lib/e2e-environment";
import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { testAccount } from "../scripts/lib/test-account";
import { editor, setCode, readCode } from "./editor-helpers";
const base = E2E_BASE_URL;
const endpoint = "/api/progress/be-pagination";
const saved = async (page: Page) =>
  (await (await page.request.get("/api/problems/be-pagination")).json()).progress;
async function login(context: BrowserContext, cookie: string) {
  const [name, ...value] = cookie.split("=");
  await context.addCookies([
    { name, value: value.join("="), url: base, httpOnly: true, sameSite: "Lax" },
  ]);
}
function gate() {
  let release!: () => void;
  const wait = new Promise<void>((r) => {
    release = r;
  });
  return { wait, release };
}

test("two signed-in tabs preserve typing through stale saves, repeated conflicts and a delayed acknowledgement", async ({
  page,
  context,
}, info) => {
  const account = await testAccount(resolve("artifacts/e2e.sqlite"), base);
  try {
    await login(context, account.cookie);
    await editor(page);
    const b = await context.newPage();
    await editor(b);
    const first = gate();
    let held = false;
    await page.route(`**${endpoint}`, async (route) => {
      if (!held) {
        held = true;
        await first.wait;
      }
      await route.continue();
    });
    const sent = page.waitForRequest((r) => r.url().endsWith(endpoint) && r.method() === "PUT");
    await setCode(page, "print('A delayed draft')");
    await sent;
    await setCode(b, "print('B saved code')");
    await expect.poll(async () => (await saved(b))?.code).toBe("print('B saved code')");
    await setCode(page, "print('A kept typing')");
    first.release();
    const conflict = page.getByRole("region", { name: "코드 저장 충돌" });
    await expect(conflict).toBeVisible();
    expect((await saved(page)).code).toBe("print('B saved code')");
    expect(await readCode(page)).toBe("print('A kept typing')");
    await page.getByText("내 초안과 서버 저장본 비교", { exact: true }).focus();
    await page.keyboard.press("Enter");
    const local = page.getByRole("textbox", { name: "비교 화면의 내 초안" });
    await expect(local).toHaveValue("print('A kept typing')");
    await page.keyboard.press("Tab");
    await expect(local).toBeFocused();
    await local.fill("print('A merged code')");
    expect(await readCode(page)).toBe("print('A merged code')");
    await setCode(b, "print('B changed again')");
    await expect.poll(async () => (await saved(b))?.code).toBe("print('B changed again')");
    await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).click();
    await expect(page.getByRole("textbox", { name: "서버 저장본", exact: true })).toHaveValue(
      "print('B changed again')",
    );
    await expect(local).toHaveValue("print('A merged code')");
    expect(
      (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
        .violations,
    ).toEqual([]);
    if (info.project.name === "chromium")
      await page.screenshot({ path: "artifacts/draft-conflict-desktop.png", fullPage: true });
    await page.unroute(`**${endpoint}`);
    const ack = gate();
    const reached = gate();
    let holdAck = true;
    await page.route(`**${endpoint}`, async (route) => {
      const response = await route.fetch();
      if (holdAck) {
        holdAck = false;
        reached.release();
        await ack.wait;
      }
      await route.fulfill({ response });
    });
    await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).click();
    await reached.wait;
    await local.fill("print('typed during conflict resolution')");
    ack.release();
    await expect(conflict).toHaveCount(0);
    await expect
      .poll(async () => (await saved(page))?.code)
      .toBe("print('typed during conflict resolution')");
    expect(await readCode(page)).toBe("print('typed during conflict resolution')");
    await page.unroute(`**${endpoint}`);
    await b.close();
  } finally {
    account.store.db.close();
  }
});

test("offline device drafts survive reconnect and reload without replacing another device's code", async ({
  page,
  context,
  browser,
}) => {
  const account = await testAccount(resolve("artifacts/e2e.sqlite"), base);
  const other = await browser.newContext({ baseURL: base });
  try {
    await login(context, account.cookie);
    await login(other, account.cookie);
    await editor(page);
    const b = await other.newPage();
    await editor(b);
    await context.setOffline(true);
    await setCode(page, "print('offline device A')");
    await expect(page.getByText("오프라인 보관", { exact: true })).toBeVisible();
    await setCode(b, "print('online device B')");
    await expect.poll(async () => (await saved(b))?.code).toBe("print('online device B')");
    await context.setOffline(false);
    await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toBeVisible();
    await editor(page);
    await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toBeVisible();
    expect(await readCode(page)).toBe("print('offline device A')");
    expect((await saved(b)).code).toBe("print('online device B')");
    await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toHaveCount(0);
    await expect(page.locator(".monaco-editor textarea").first()).toBeFocused();
    expect((await saved(page)).code).toBe("print('offline device A')");
  } finally {
    await context.setOffline(false);
    await other.close();
    account.store.db.close();
  }
});

test("mobile conflict comparison supports keyboard editing, recovery, and accessible layout", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await editor(page);
  await page.request.put(endpoint, {
    data: { code: "print('server from another window')", baseRevision: 0 },
  });
  const input = page.locator(".monaco-editor textarea").first();
  await input.focus();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n# local keyboard edit");
  await expect(page.getByRole("region", { name: "코드 저장 충돌" })).toBeVisible();
  const summary = page.getByText("내 초안과 서버 저장본 비교", { exact: true });
  await summary.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const local = page.getByRole("textbox", { name: "비교 화면의 내 초안" });
  await expect(local).toBeFocused();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n# preserved on mobile");
  expect(await readCode(page)).toContain("# preserved on mobile");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
  if (info.project.name === "chromium")
    await page
      .getByRole("region", { name: "코드 저장 충돌" })
      .screenshot({ path: "artifacts/draft-conflict-mobile.png" });
  await page.getByRole("button", { name: "비교한 버전에 내 초안 저장" }).focus();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect(page.getByText("저장됨", { exact: true })).toBeVisible();
});

test("initial data stays private and API rejects unversioned saves and reused AI IDs", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  const first = await page.request.get("/api/workspace?include=initial&problem=be-pagination");
  expect(first.headers()["cache-control"]).toBe("no-store");
  const scope = (await first.json()).scope;
  expect((await page.request.put(endpoint, { data: { code: "unversioned" } })).status()).toBe(428);
  const write = await page.request.put(endpoint, {
    data: { code: "private bootstrap code", baseRevision: 0 },
  });
  expect(write.status()).toBe(200);
  const bootstrap = await (
    await page.request.get("/api/workspace?include=initial&problem=be-pagination")
  ).json();
  expect(bootstrap.bootstrap.detail.progress.code).toBe("private bootstrap code");
  expect(bootstrap.bootstrap.detail.problem.solution).toBeUndefined();
  expect(bootstrap.bootstrap.detail.solution).toBeNull();
  const other = await browser.newContext({ baseURL: base });
  try {
    const response = await other.request.get(
      "/api/workspace?include=initial&problem=be-pagination",
    );
    const theirs = await response.json();
    expect(theirs.scope).not.toBe(scope);
    expect(theirs.bootstrap.detail.progress).toBeNull();
    expect(response.headers()["cache-control"]).toBe("no-store");
  } finally {
    await other.close();
  }
  const requestId = crypto.randomUUID();
  const review = (code: string) =>
    page.request.post("/api/problems/be-pagination/review", { data: { requestId, code } });
  expect((await review("print('first request')")).status()).toBe(503);
  expect((await review("print('first request')")).status()).toBe(503);
  expect((await review("print('different request')")).status()).toBe(409);
});

import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openGuide(page: Page) {
  await page.getByRole("button", { name: "핏 시작 가이드 열기" }).click();
  const dialog = page.getByRole("dialog", { name: "핏의 시작 가이드" });
  await expect(dialog.getByRole("radio", { name: "코딩은 처음이에요" })).toBeVisible();
  return dialog;
}
async function choose(
  page: Page,
  experience = "코딩은 처음이에요",
  goal = "서비스가 작동하는 원리 배우기",
  time = "5분 정도",
) {
  await page.getByRole("radio", { name: experience, exact: true }).check();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("radio", { name: goal, exact: true }).check();
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByRole("radio", { name: time, exact: true }).check();
}
const fixtureReply = {
  source: "ai",
  message:
    "입력값에 따라 결과가 어떻게 달라지는지 확인하면 AI 코드의 조건문을 이해하는 데 도움이 돼요.",
  recommendation: {
    id: "price-and-rules",
    title: "입력값에 따라 계산 결과는 어떻게 달라질까요?",
    description: "수량과 조건을 바꾸며 결과를 확인해요.",
    href: "/learn/price-and-rules",
    minutes: 5,
    action: "이 미션 시작하기",
  },
};

test("home guide stays in the page flow and is keyboard accessible", async ({ page }, info) => {
  let requests = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/guide")) requests++;
  });
  await page.goto("/");
  const launcher = page.getByRole("button", { name: "핏 시작 가이드 열기" });
  await expect(launcher).toBeVisible();
  await expect(page.locator(".guide-intro-hint, .guide-launcher")).toHaveCount(0);
  expect(requests).toBe(0);
  await page.reload();
  await expect(launcher).toBeVisible();
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const card = page.getByRole("region", { name: "추천 첫 학습" });
    await expect(card).toBeVisible();
    for (const position of [0, 200, 500]) {
      await page.evaluate((y) => window.scrollTo(0, y), position);
      const guideBox = await launcher.boundingBox();
      const cardBox = await card.boundingBox();
      expect(
        guideBox &&
          cardBox &&
          (guideBox.y + guideBox.height <= cardBox.y || guideBox.y >= cardBox.y + cardBox.height),
      ).toBe(true);
    }
    await card.getByRole("link").click({ trial: true });
    if (info.project.name === "chromium")
      await page.screenshot({ path: `artifacts/guide-home-${viewport.width}.png` });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await launcher.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "핏의 시작 가이드" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "다음", exact: true })).toBeDisabled();
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/guide-first-step.png" });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(launcher).toBeFocused();
  await launcher.click();
  await expect(dialog).toBeVisible();
  await choose(page);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/guide-preferences-desktop.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
  await page.goto("/?view=bookmarks");
  await expect(page.getByRole("button", { name: "핏 시작 가이드 열기" })).toHaveCount(1);
  await expect(page.locator(".guide-launcher")).toHaveCount(0);
});

test("no-key guide recommends a real first mission and follows the deep link", async ({
  page,
}, info) => {
  await page.goto("/learn");
  const dialog = await openGuide(page);
  await choose(page);
  await dialog.getByRole("button", { name: "내 시작점 추천받기" }).click();
  await expect(dialog.getByText("핏 · 선택 기반 안내")).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "데이터는 어디에 저장될까요?" })).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/guide-recommendation-desktop.png" });
  await dialog.getByRole("link", { name: "이 미션 시작하기" }).click();
  await expect(page).toHaveURL(/\/learn\/where-data-lives$/);
  await expect(dialog).not.toBeVisible();
});

test("AI followups use the profile, cancel cleanly, preserve failed input and isolate account changes", async ({
  page,
}) => {
  let scope = "guest:guide-a",
    hold = false;
  const bodies: { profile: unknown; messages: { content: string }[] }[] = [];
  await page.route("**/api/guide", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { scope, aiReady: true } });
    bodies.push(route.request().postDataJSON());
    if (hold) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    await route.fulfill({ json: fixtureReply }).catch(() => {});
  });
  await page.goto("/");
  let dialog = await openGuide(page);
  await choose(page, "AI로 서비스를 만들어 봤어요", "AI가 만든 코드 이해하기");
  await dialog.getByRole("button", { name: "내 시작점 추천받기" }).click();
  await expect(dialog.getByText("핏 · AI 맞춤 안내")).toBeVisible();
  const input = dialog.getByLabel("목표를 더 알려주거나 궁금한 점을 물어보세요");
  await input.fill("나만의 목표입니다");
  hold = true;
  await dialog.getByRole("button", { name: "핏에게 질문 보내기" }).click();
  await dialog.getByRole("button", { name: "중지", exact: true }).click();
  await expect(input).toHaveValue("나만의 목표입니다");
  await page.waitForTimeout(1700);
  await expect(dialog.getByText("핏 · AI 맞춤 안내")).toHaveCount(1);
  hold = false;
  await dialog.getByRole("button", { name: "핏에게 질문 보내기" }).click();
  await expect(input).toHaveValue("");
  expect(bodies.at(-1)?.messages.at(-1)?.content).toBe("나만의 목표입니다");
  expect(bodies[0].profile).toEqual({ experience: "builder", goal: "review", minutes: 5 });
  await dialog.getByRole("button", { name: "닫기", exact: true }).click();
  scope = "user:guide-b";
  dialog = await openGuide(page);
  await expect(dialog.getByText("나만의 목표입니다")).toHaveCount(0);
  await expect(
    dialog.getByRole("radio", { name: "AI로 서비스를 만들어 봤어요" }),
  ).not.toBeChecked();
});

test("mobile chooser and chat fit small viewports, recover network failures and reset", async ({
  page,
}, info) => {
  let fail = false;
  await page.route("**/api/guide", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: { scope: "guest:mobile", aiReady: true } });
    if (fail) return route.abort("internetdisconnected");
    return route.fulfill({ json: fixtureReply });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const dialog = await openGuide(page);
  await choose(page);
  await dialog.getByRole("button", { name: "내 시작점 추천받기" }).click();
  await expect(dialog.getByText("핏 · AI 맞춤 안내")).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/guide-chat-mobile.png" });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  const input = dialog.getByLabel("목표를 더 알려주거나 궁금한 점을 물어보세요");
  fail = true;
  await input.fill("저장 오류를 확인하고 싶어요");
  await dialog.getByRole("button", { name: "핏에게 질문 보내기" }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(input).toHaveValue("저장 오류를 확인하고 싶어요");
  fail = false;
  await dialog.getByRole("button", { name: "핏에게 질문 보내기" }).click();
  await expect(input).toHaveValue("");
  await dialog.getByRole("button", { name: "대화 지우고 다시 시작" }).click();
  await expect(dialog.getByRole("radio", { name: "코딩은 처음이에요" })).toBeVisible();
  await expect(dialog.getByRole("log")).toHaveCount(0);
});

test("guide API requires current scope, validates input, blocks cross-origin and keeps responses private", async ({
  request,
}) => {
  const status = await request.get("/api/guide");
  expect(status.headers()["cache-control"]).toBe("no-store");
  const { scope } = await status.json();
  const data = {
    profile: { experience: "developer", goal: "review", minutes: 30 },
    messages: [{ role: "user", content: "추천해 줘" }],
    mode: "basic",
  };
  expect((await request.post("/api/guide", { data })).status()).toBe(409);
  const headers = { "X-Codefit-Workspace": scope };
  const result = await request.post("/api/guide", { headers, data });
  expect(result.status()).toBe(200);
  expect((await result.json()).recommendation.id).toBe("handoff-cart");
  expect(
    (await request.post("/api/guide", { headers, data: { ...data, messages: [] } })).status(),
  ).toBe(400);
  expect(
    (
      await request.post("/api/guide", {
        headers: { ...headers, origin: "https://another.example" },
        data,
      })
    ).status(),
  ).toBe(403);
});

test("practice starts with a compact guide and restores focus after closing", async ({ page }) => {
  await page.goto("/learn/where-data-lives");
  const launcher = page.getByRole("button", { name: "핏 시작 가이드 열기" });
  await expect(page.locator(".guide-launcher")).toHaveClass(/is-compact/);
  await expect(launcher).toHaveCSS("width", "48px");
  await expect(page.getByRole("button", { name: "첫 방문 안내 숨기기" })).toHaveCount(0);
  await launcher.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "핏의 시작 가이드" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launcher).toBeFocused();
});

import { test, expect } from "@playwright/test";

for (const width of [1024, 1440]) {
  test(`desktop navigation stays consistent at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "메뉴 열기", exact: true })).toBeHidden();
    const nav = page.getByRole("navigation", { name: "작업 공간 메뉴", exact: true });
    for (const name of [
      "내 프로젝트",
      "내 프로젝트 점검",
      "서비스 보안 점검",
      "AI 실무 배우기",
      "AI 코드 이해 훈련",
      "서비스 원리 배우기",
      "홈",
    ]) {
      const link = nav.getByRole("link", { name, exact: true });
      const href = await link.getAttribute("href");
      await link.click();
      await expect(page).toHaveURL(new RegExp(`${href === "/" ? "/" : href}$`));
      await expect(nav).toBeVisible();
      await expect(nav.locator('[aria-current="page"]')).toHaveText(name);
      expect(
        await page.locator("main").evaluate((element) => element.getBoundingClientRect().left),
      ).toBe(240);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
    }
  });
}

test("below 1024px the sidebar becomes one accessible menu dialog", async ({ page }) => {
  for (const width of [390, 900]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/", "/projects"]) {
      await page.goto(path);
      await expect(page.locator(".sidebar")).toBeHidden();
      const trigger = page.getByRole("button", { name: "메뉴 열기", exact: true });
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await trigger.click();
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      const dialog = page.getByRole("dialog", { name: "메뉴", exact: true });
      await expect(dialog.getByRole("navigation", { name: "작업 공간 메뉴" })).toBeVisible();
      await expect(dialog.getByRole("button", { name: "환경 설정" })).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(trigger).toBeFocused();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "메뉴 열기", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "메뉴", exact: true });
  await dialog.getByRole("link", { name: "내 프로젝트 점검", exact: true }).click();
  await expect(page).toHaveURL(/\/project-check$/);
  await expect(dialog).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
    true,
  );
});

test("project practice highlights the track it belongs to", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const nav = page.getByRole("navigation", { name: "작업 공간 메뉴", exact: true });
  for (const [mode, name] of [
    ["code", "AI 코드 이해 훈련"],
    ["service", "서비스 원리 배우기"],
  ]) {
    await page.goto(`/project-practice?mode=${mode}`);
    await expect(nav.locator('[aria-current="page"]')).toHaveText(name);
    await expect(
      page.getByRole("navigation", { name: "프로젝트 연습 종류" }).locator('[aria-current="page"]'),
    ).toHaveCount(1);
  }
});

test("every route shares one header outside the main landmark", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/project-check", "/learn/ai", "/projects", "/learn/where-data-lives"]) {
    await page.goto(path);
    const header = page.locator("header.app-header");
    await expect(header).toHaveCount(1);
    expect((await header.boundingBox())!.y, path).toBe(0);
    await expect(page.locator("main header.app-header")).toHaveCount(0);
    await expect(header.getByRole("button", { name: "메뉴 열기", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: /작업 공간 변경/ })).toBeVisible();
    await expect(header.getByRole("button", { name: "사용 안내", exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      path,
    ).toBe(true);
  }
});

test("the breadcrumb names the current page and unknown addresses show the shared 404", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const crumb = page
    .getByRole("navigation", { name: "현재 위치" })
    .locator('[aria-current="page"]');
  for (const [path, label] of [
    ["/?view=history", "내 학습 기록"],
    ["/projects", "내 프로젝트"],
    ["/learn/ai/project", "내 프로젝트 AI 워크숍"],
  ]) {
    await page.goto(path);
    await expect(crumb).toHaveText(label);
  }
  const response = await page.goto("/no-such-page");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("페이지를 찾을 수 없습니다");
  await expect(crumb).toHaveText("페이지를 찾을 수 없음");
  await expect(page.getByRole("navigation", { name: "작업 공간 메뉴" })).toBeVisible();
  await expect(page.getByRole("link", { name: "내 프로젝트", exact: true }).last()).toBeVisible();
  await page.goto("/learn/no-such-mission");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("페이지를 찾을 수 없습니다");
});

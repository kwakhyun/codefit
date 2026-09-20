import { expect, test } from "@playwright/test";
import { learnerTypes, preferenceForType } from "../src/lib/learner-types";
import { preferredDestinations } from "../src/lib/learning-preference";
import { editor, setCode, readCode } from "./editor-helpers";
const change = (page: import("@playwright/test").Page) =>
  page.getByRole("button", { name: /작업 공간 변경/ });
test("three workspaces expose distinct home sections and navigation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "지금 필요한 연습부터 시작하세요",
  );
  const picker = page.getByRole("region", { name: "나에게 맞는 시작점" });
  await expect(picker.getByRole("radio")).toHaveCount(3);
  for (const [index, item] of learnerTypes.entries()) {
    if (index) await change(page).click();
    await picker.getByRole("radio", { name: item.name, exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "작업 공간 변경", exact: true }),
    ).not.toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(item.title);
    await expect(page.locator(".workspace-home")).toHaveAttribute("data-learner-type", item.id);
    await expect(page.locator("#problem-library")).toHaveCount(item.id === "code" ? 1 : 0);
    await expect(page.locator(".ai-home-grid")).toHaveCount(item.id === "ai" ? 1 : 0);
    await expect(page.locator(".service-check-path")).toHaveCount(item.id === "service" ? 1 : 0);
    const nav = page.getByRole("complementary", { name: "주 메뉴" }).locator("nav > div .nav-item");
    await expect(nav.first()).toHaveAttribute(
      "href",
      preferredDestinations(preferenceForType(item.id))[0].href,
    );
    await expect
      .poll(() =>
        page
          .locator(".workspace-art img")
          .evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).naturalWidth > 0)),
      )
      .toBe(true);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.reload();
    await expect(change(page)).toContainText(item.name);
    await expect(picker).toHaveCount(0);
  }
});
test("legacy choices migrate without touching learning progress", async ({ page }) => {
  for (const [before, after] of Object.entries({
    starter: "AI 워크숍",
    coder: "코딩 트레이닝",
    maker: "서비스 점검실",
    builder: "서비스 점검실",
  })) {
    await page.goto("/");
    await page.evaluate(
      (type) =>
        localStorage.setItem(
          "codefit-learning-preference-v2",
          JSON.stringify({ version: 2, type }),
        ),
      before,
    );
    await page.reload();
    await expect(change(page)).toContainText(after);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            JSON.parse(localStorage.getItem("codefit-learning-preference-v2") || "null")?.version,
        ),
      )
      .toBe(3);
  }
});
test("choosing a workspace still works when storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.goto("/");
  await page.getByRole("radio", { name: "AI 워크숍", exact: true }).click();
  await expect(page.locator(".workspace-ai")).toBeVisible();
  await expect(page.locator(".workspace-home").getByRole("status")).toContainText(
    "선택을 저장하지 못했어요",
  );
});
test("workspace changes preserve code drafts", async ({ page }) => {
  await page.goto("/problems/fe-search-race");
  await editor(page);
  const draft = "// workspace migration draft\nexport function search() { return []; }";
  await setCode(page, draft);
  await change(page).click();
  await page.getByRole("radio", { name: "서비스 점검실", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "작업 공간 변경", exact: true })).not.toBeVisible();
  expect(await readCode(page)).toBe(draft);
  await page.reload();
  await editor(page);
  expect(await readCode(page)).toBe(draft);
});

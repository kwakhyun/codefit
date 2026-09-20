import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";

test("always-visible banner follows each learner type and keeps all features reachable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const banner = page.getByRole("region", { name: "코드핏 핵심 기능" });
  await expect(banner).toBeVisible();
  for (const [index, type, title] of [
    [0, "원리 입문", "서비스 원리 배우기"],
    [1, "코드 훈련", "AI 코드 이해 훈련"],
    [2, "내 서비스 이해", "내 프로젝트 점검"],
    [3, "배포 전 점검", "서비스 보안 점검"],
  ] as const) {
    if (index > 0) await page.locator(".persona-change").click();
    await page.getByRole("radio", { name: type, exact: true }).click();
    if (index > 0) await page.getByRole("button", { name: "선택 완료" }).click();
    await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "1 / 6");
    await expect(banner.getByRole("group").locator(".eyebrow")).toHaveText(title);
    await expect(banner.locator(".feature-topic-rail button")).toHaveCount(6);
    await expect(page.locator(".training-welcome .persona-picker")).toHaveCount(0);
    await page.reload();
    await expect(banner.getByRole("group").locator(".eyebrow")).toHaveText(title);
  }
});

test("illustrated menus work on narrow screens and expose keyboard step previews", async ({
  page,
}, info) => {
  test.setTimeout(180000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const path of [
    "/learn",
    "/handoff",
    "/project-check",
    "/security-check",
    "/quality",
    "/privacy",
    "/login",
    "/?view=history",
  ]) {
    await page.goto(path);
    const img = page.locator(".visual-intro .section-artwork img, .auth-artwork img").first();
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0))
      .toBe(true);
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        path,
      ).toBe(true);
    }
    const journey = page.getByRole("region", { name: "진행 방식 미리보기" });
    if (await journey.count()) {
      const steps = journey.getByRole("button");
      await steps.nth(2).focus();
      await page.keyboard.press("Enter");
      await expect(steps.nth(2)).toHaveAttribute("aria-pressed", "true");
      await expect(steps.nth(0)).toHaveAttribute("aria-pressed", "false");
      await expect(journey.locator(".journey-detail")).not.toBeEmpty();
    }
    if (info.project.name === "chromium") {
      expect(
        (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
          .violations,
        path,
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/experience/${path.replace(/[^a-z]/g, "")}-desktop.png`,
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: `artifacts/experience/${path.replace(/[^a-z]/g, "")}-mobile.png`,
        fullPage: true,
      });
    }
  }
});

test("project preview changes the expected permission result without running AI", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/project-check**", (route) => {
    if (route.request().method() === "POST") calls++;
    return route.continue();
  });
  await page.goto("/project-check");
  const preview = page.getByLabel("접근 권한 설명용 예시", { exact: true });
  await expect(preview).toContainText("설명용 예시");
  await preview.getByRole("button", { name: "민수 (다른 사용자)" }).click();
  await expect(preview.locator(".access-preview-result")).toContainText(
    "메모 내용을 보내지 않아야",
  );
  await preview.getByRole("button", { name: "지민 (소유자)" }).click();
  await expect(preview.locator(".access-preview-result")).toContainText("지민의 메모를 보여줘야");
  expect(calls).toBe(0);
});

test("security filters keep the full export and notes progress reflects only written notes", async ({
  page,
}) => {
  let scans = 0;
  await page.route("**/api/security-check", (route) => {
    scans++;
    return route.fulfill({
      json: {
        url: "https://example.com/",
        checkedAt: "2026-09-20T00:00:00Z",
        findings: ["observed", "review", "unknown"].map((status, i) => ({
          id: String(i),
          title: `설정 ${i}`,
          status,
          evidence: `근거 ${i}`,
          action: "직접 확인하세요.",
        })),
      },
    });
  });
  await page.goto("/security-check");
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://example.com/");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "공개 페이지 보안 점검", exact: true }).click();
  const results = page.getByRole("region", { name: "보안 점검 결과" });
  await expect(results.getByRole("article")).toHaveCount(3);
  await results.getByRole("button", { name: "보완 검토 1", exact: true }).click();
  await expect(results.getByRole("article")).toHaveCount(1);
  await expect(results.getByRole("article")).toContainText("설정 1");
  const download = page.waitForEvent("download");
  await results.getByRole("button", { name: "결과와 AI 수정 요청 저장" }).click();
  const exported = await readFile((await (await download).path())!, "utf8");
  for (let i = 0; i < 3; i++) expect(exported).toContain(`근거 ${i}`);
  await page.locator(".security-exercises summary").first().click();
  await page.locator(".security-exercises textarea").first().fill("관찰했지만 추가 확인이 필요함");
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  await expect(page.locator(".notes-progress")).toContainText("검증 완료나 안전 판정이 아닙니다");
  await page.reload();
  await expect(page.getByRole("progressbar")).toHaveAttribute("value", "1");
  expect(scans).toBe(1);
});

import { expect, test } from "@playwright/test";
test("experience and intent reorder menus, survive reload and keep every destination", async ({
  page,
}) => {
  await page.goto("/");
  const picker = page.getByRole("region", { name: "나에게 맞는 시작점" });
  await expect(picker.getByRole("heading", { name: "서비스 원리 배우기" })).toBeVisible();
  await picker.getByLabel("개발 경험").selectOption("developer");
  await expect(picker.getByRole("heading", { name: "AI 코드 이해 훈련" })).toBeVisible();
  await picker.getByLabel("지금 하고 싶은 일").selectOption("project");
  await expect(picker.getByRole("heading", { name: "내 프로젝트 점검" })).toBeVisible();
  await picker.getByLabel("개발 경험").selectOption("beginner");
  await expect(picker.getByRole("heading", { name: "내 프로젝트 점검" })).toBeVisible();
  await page.reload();
  await expect(picker.getByLabel("지금 하고 싶은 일")).toHaveValue("project");
  const menus = page
    .getByRole("complementary", { name: "주 메뉴" })
    .locator(
      'a[href="/learn"],a[href="/handoff"],a[href="/project-check"],a[href="/security-check"]',
    );
  await expect(menus).toHaveCount(4);
  await expect(menus.first()).toHaveAttribute("href", "/project-check");
  await page.goto("/security-check");
  await expect(
    page.getByRole("navigation", { name: "서비스 메뉴" }).getByRole("link").nth(1),
  ).toHaveAttribute("href", "/project-check");
});
test("security form shows scoped observations and handles failures without showing stale results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/security-check");
  await expect(page.getByRole("button", { name: "공개 페이지 보안 점검" })).toBeDisabled();
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://example.com/");
  await page.getByRole("checkbox").check();
  await page.route("**/api/security-check", (route) =>
    route.fulfill({
      json: {
        url: "https://example.com/",
        checkedAt: "2026-09-20T00:00:00Z",
        findings: [
          {
            id: "authorization",
            title: "접근 권한",
            status: "unknown",
            evidence: "로그인 후 권한은 확인하지 못했습니다.",
            action: "테스트 계정으로 확인하세요.",
          },
        ],
      },
    }),
  );
  await page.getByRole("button", { name: "공개 페이지 보안 점검" }).click();
  await expect(page.getByRole("region", { name: "보안 점검 결과" })).toBeVisible();
  await expect(page.getByText("설정 관찰 0개 / 보완 검토 0개 / 추가 확인 1개")).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "결과와 AI 수정 요청 저장" }).click();
  expect((await download).suggestedFilename()).toBe("codefit-security-check.txt");
  await page.unroute("**/api/security-check");
  await page.route("**/api/security-check", (route) =>
    route.fulfill({ status: 429, json: { error: "점검 요청 한도에 도달했습니다." } }),
  );
  await page.getByRole("button", { name: "공개 페이지 보안 점검" }).click();
  await expect(page.locator(".security-error")).toContainText("한도");
  await expect(page.getByRole("region", { name: "보안 점검 결과" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

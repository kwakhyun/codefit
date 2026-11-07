import { expect, test } from "@playwright/test";
test("security form shows scoped observations, keeps results across failures and address edits", async ({
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
  await page.getByRole("button", { name: "텍스트로 저장" }).click();
  expect((await download).suggestedFilename()).toBe("codefit-security-check.txt");
  await page.unroute("**/api/security-check");
  await page.route("**/api/security-check", (route) =>
    route.fulfill({ status: 429, json: { error: "점검 요청 한도에 도달했습니다." } }),
  );
  await page.getByRole("button", { name: "공개 페이지 보안 점검" }).click();
  await expect(page.locator(".security-error")).toContainText("한도");
  // A failed re-run keeps the last result; editing the address marks it as the previous one.
  const results = page.getByRole("region", { name: "보안 점검 결과" });
  await expect(results).toBeVisible();
  await expect(results.locator(".security-stale-notice")).toHaveCount(0);
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://example.com/other");
  await expect(results.locator(".security-stale-notice")).toContainText("이전 주소 기준 결과");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

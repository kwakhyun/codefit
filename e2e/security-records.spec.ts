import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const report = {
  url: "https://example.com/",
  checkedAt: "2026-09-20T00:00:00Z",
  findings: [
    {
      id: "access",
      title: "접근 권한",
      status: "unknown",
      evidence: "공개 응답만 확인했습니다.",
      action: "테스트 계정으로 확인하세요.",
    },
  ],
};

test("security notes survive practice navigation and reload, export without a scan, and restore results", async ({
  page,
}, info) => {
  let scans = 0;
  await page.route("**/api/security-check", (route) => {
    scans++;
    return route.fulfill({ json: report });
  });
  await page.goto("/security-check");
  const notes = [
    "소유자 읽기 성공, 비참여자는 거절됨",
    "권한 회수 뒤 기존 세션의 접근이 거절됨",
    "같은 예약을 다시 보내도 한 건만 저장됨",
  ];
  for (let i = 0; i < 3; i++) {
    const item = page.locator(".security-exercises details").nth(i);
    await item.locator("summary").click();
    await item.getByLabel("내 확인 결과", { exact: true }).fill(notes[i]);
  }
  await expect(page.getByText(/현재 탭에 계정별로 임시 보관됩니다/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "내 프로젝트의 권한 설계 설명 점검하기 →" }),
  ).toHaveAttribute("href", "/project-check");
  await page.locator(".security-exercises details").first().getByRole("link").click();
  await expect(page).toHaveURL(/\/learn\/private-board$/);
  await page.goBack();
  await expect(page.locator(".security-exercises textarea").first()).toHaveValue(notes[0]);
  await page.reload();
  for (let i = 0; i < 3; i++)
    await expect(page.locator(".security-exercises textarea").nth(i)).toHaveValue(notes[i]);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "확인 기록 파일로 저장" }).click();
  const text = await readFile((await (await downloading).path())!, "utf8");
  for (const note of notes) expect(text).toContain(note);
  expect(text).toContain("자동 검증 결과가 아닙니다");
  expect(scans).toBe(0);
  await page.getByLabel("점검할 공개 서비스 링크").fill(report.url);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "공개 페이지 보안 점검" }).click();
  await expect(page.getByRole("region", { name: "보안 점검 결과" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("region", { name: "보안 점검 결과" })).toContainText(report.url);
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  expect(scans).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".security-exercises details").first().locator("summary").click();
  await expect(page.locator(".security-exercises textarea").first()).toHaveValue(notes[0]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page
    .locator(".security-exercises")
    .screenshot({ path: `artifacts/security-records-${info.project.name}.png` });
  await page.getByRole("button", { name: "임시 기록 지우기" }).click();
  await page
    .getByRole("dialog", { name: "기록 삭제 확인" })
    .getByRole("button", { name: "삭제하기", exact: true })
    .click();
  await expect(page.locator(".security-exercises textarea").first()).toHaveValue("");
  await page.reload();
  await expect(page.locator(".security-exercises textarea").first()).toHaveValue("");
  await expect(page.getByRole("region", { name: "보안 점검 결과" })).toHaveCount(0);
  expect(scans).toBe(1);
});

test("security drafts stay with their account across focus refresh and sign-out", async ({
  page,
}) => {
  let scope = "user:security-a";
  await page.route("**/api/workspace", (route) => route.fulfill({ json: { scope } }));
  await page.goto("/security-check");
  await page.locator(".security-exercises summary").first().click();
  const note = page.locator(".security-exercises textarea").first();
  await note.fill("A의 테스트 확인 기록");
  await page.getByLabel("점검할 공개 서비스 링크").fill("https://example.com/");
  scope = "user:security-b";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(note).toHaveValue("");
  await expect(page.getByLabel("점검할 공개 서비스 링크")).toHaveValue("");
  scope = "guest:security-test";
  await page.reload();
  await expect(note).toHaveValue("");
  scope = "user:security-a";
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(note).toHaveValue("A의 테스트 확인 기록");
  await expect(page.getByLabel("점검할 공개 서비스 링크")).toHaveValue("https://example.com/");
});

test("blocked tab storage warns and still allows exporting the notes", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new Error("storage blocked");
    };
  });
  await page.goto("/security-check");
  await page.locator(".security-exercises summary").first().click();
  await page.locator(".security-exercises textarea").first().fill("파일로 보관할 테스트 결과");
  await expect(page.locator(".security-exercises").getByRole("alert")).toContainText(
    "임시 보관하지 못했습니다",
  );
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "확인 기록 파일로 저장" }).click();
  expect(await readFile((await (await downloading).path())!, "utf8")).toContain(
    "파일로 보관할 테스트 결과",
  );
});

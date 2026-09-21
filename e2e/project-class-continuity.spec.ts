import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import { checkListItem } from "../src/lib/project-check/types";
const check = publicCheck(fixtureCheck);
const id = check.id;
const overview = {
  scope: "visitor:continuity",
  signedIn: false,
  checks: [checkListItem(check)],
  nextCursor: null,
};
test("search survives a trip to class details", async ({ page }) => {
  await page.route("**/api/project-check", (route) => route.fulfill({ json: overview }));
  await page.route(`**/api/projects/${id}`, (route) =>
    route.fulfill({ json: { check, practice: null, workshop: null } }),
  );
  await page.goto("/projects");
  const search = page.getByRole("searchbox", { name: "내 프로젝트 찾기" });
  await search.fill(check.analysis.title.slice(0, 2));
  await page.getByRole("link", { name: /클래스 열기/ }).click();
  await page.getByRole("link", { name: /내 프로젝트 목록/ }).click();
  await expect(search).toHaveValue(check.analysis.title.slice(0, 2));
});
test("concurrent tabs retain both versions of a review note", async ({ context, page }) => {
  await context.route("**/api/project-check", (route) => route.fulfill({ json: overview }));
  await context.route(`**/api/projects/${id}`, (route) =>
    route.fulfill({ json: { check, practice: null, workshop: null } }),
  );
  const other = await context.newPage();
  for (const tab of [page, other]) {
    await tab.goto(`/projects?class=${id}`);
    await tab.getByRole("button", { name: "복습하기", exact: true }).click();
  }
  await page.getByRole("textbox", { name: "지금 떠오르는 설명" }).fill("첫 번째 탭의 메모");
  await expect(page.getByText(/복습 위치와 메모는 이 브라우저에 저장됩니다/)).toBeVisible();
  await other.getByRole("textbox", { name: "지금 떠오르는 설명" }).fill("두 번째 탭의 메모");
  await other.getByText("다른 탭에서 작성한 메모 1개").click();
  await expect(other.getByText("첫 번째 탭의 메모", { exact: true })).toBeVisible();
  await other.reload();
  await other.getByRole("button", { name: "복습하기", exact: true }).click();
  await expect(other.getByRole("textbox", { name: "지금 떠오르는 설명" })).toHaveValue(
    "두 번째 탭의 메모",
  );
  await other.getByText("다른 탭에서 작성한 메모 1개").click();
  await expect(other.getByText("첫 번째 탭의 메모", { exact: true })).toBeVisible();
});
test("history refresh keeps loaded pages and removes deleted versions", async ({ page }) => {
  let changed = false;
  let tailReads = 0;
  const repository = {
    name: "owner/repo",
    commit: "a".repeat(40),
    totalFiles: 0,
    eligibleFiles: 0,
    omittedFiles: 0,
    truncatedTree: false,
    links: [],
    files: [],
  };
  const older = {
    ...checkListItem(check),
    id: "77777777-7777-4777-8777-777777777777",
    analysis: { title: "이전 분석" },
  };
  await page.route("**/api/project-check", (route) => route.fulfill({ json: overview }));
  await page.route(`**/api/projects/${id}`, (route) =>
    route.fulfill({
      json: {
        check: { ...check, page: { ...check.page, repository } },
        practice: null,
        workshop: null,
      },
    }),
  );
  await page.route(`**/api/projects/${id}/versions`, (route) =>
    route.fulfill({ json: { checks: [checkListItem(check)], nextCursor: "tail" } }),
  );
  await page.route(`**/api/projects/${id}/versions?*`, (route) => {
    tailReads++;
    return route.fulfill({
      json: {
        checks: [
          {
            ...older,
            id: changed ? "88888888-8888-4888-8888-888888888888" : older.id,
            analysis: { title: changed ? "새 분석" : "이전 분석" },
          },
        ],
        nextCursor: null,
      },
    });
  });
  await page.goto(`/projects?class=${id}`);
  await page.getByRole("button", { name: "이전 분석 더 보기" }).click();
  await expect(page.getByRole("link", { name: /이전 분석 —/ })).toBeVisible();
  changed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("link", { name: /새 분석 —/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /이전 분석 —/ })).toHaveCount(0);
  expect(tailReads).toBeGreaterThanOrEqual(2);
});

test("storage failures keep the draft visible and explain that it is unsaved", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("codefit-project-review:"))
        throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  await page.route("**/api/project-check", (route) => route.fulfill({ json: overview }));
  await page.route(`**/api/projects/${id}`, (route) =>
    route.fulfill({ json: { check, practice: null, workshop: null } }),
  );
  await page.goto(`/projects?class=${id}`);
  await page.getByRole("button", { name: "복습하기", exact: true }).click();
  const note = page.getByRole("textbox", { name: "지금 떠오르는 설명" });
  await note.fill("아직 저장되지 않은 메모");
  await expect(page.getByText(/브라우저에 복습을 저장하지 못했습니다/)).toBeVisible();
  await expect(note).toHaveValue("아직 저장되지 않은 메모");
});

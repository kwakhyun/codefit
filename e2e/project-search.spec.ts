import { expect, test } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import { checkListItem } from "../src/lib/project-check/types";
test("search finds unloaded classes and paginates only matching records", async ({ page }) => {
  const item = checkListItem(publicCheck(fixtureCheck));
  let initialReads = 0;
  const requests: string[] = [];
  await page.route(/\/api\/project-check(?:\?.*)?$/, (route) => {
    const params = new URL(route.request().url()).searchParams;
    const term = params.get("q");
    if (!term) initialReads++;
    else requests.push(`${term}:${params.get("cursor") ?? "first"}`);
    const title = !term
      ? "최근 클래스"
      : params.has("cursor")
        ? "이전 예약 두 번째"
        : "이전 예약 첫 번째";
    return route.fulfill({
      json: {
        scope: "visitor:search",
        signedIn: false,
        checks: [
          {
            ...item,
            id: params.has("cursor") ? "77777777-7777-4777-8777-777777777777" : item.id,
            analysis: { title },
          },
        ],
        nextCursor: term && !params.has("cursor") ? "search-tail" : null,
      },
    });
  });
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "최근 클래스" })).toBeVisible();
  const before = initialReads;
  const search = page.getByRole("searchbox", { name: "내 프로젝트 찾기" });
  await search.fill("이전 예약");
  await expect(page.getByRole("heading", { name: "이전 예약 첫 번째" })).toBeVisible();
  await page.getByRole("button", { name: "검색 결과 더 보기" }).click();
  await expect(page.getByRole("heading", { name: "이전 예약 두 번째" })).toBeVisible();
  expect(requests).toContain("이전 예약:search-tail");
  expect(initialReads).toBe(before);
  await search.fill("");
  await expect(page.getByRole("heading", { name: "최근 클래스" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { publicCheck } from "../src/lib/server/project-check-store";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { checkListItem } from "../src/lib/project-check/types";

test("focus preserves search and loaded pages while refreshing changed and deleted classes", async ({
  page,
}) => {
  let changed = false;
  let secondPageReads = 0;
  let firstPageReads = 0;
  const first = checkListItem(publicCheck(fixtureCheck));
  const second = {
    ...first,
    id: "77777777-7777-4777-8777-777777777777",
    analysis: { ...first.analysis, title: "이전 예약 클래스" },
  };
  await page.route("**/api/project-check?*", (route) => {
    if (new URL(route.request().url()).searchParams.has("q"))
      return route.fulfill({
        json: {
          scope: "visitor:refresh",
          checks: [
            {
              ...first,
              analysis: {
                ...first.analysis,
                title: changed ? "갱신된 예약 클래스" : "새 예약 클래스",
              },
            },
            ...(changed ? [] : [second]),
          ],
          nextCursor: null,
        },
      });
    secondPageReads++;
    return route.fulfill({
      json: { scope: "visitor:refresh", checks: changed ? [] : [second], nextCursor: null },
    });
  });
  await page.route("**/api/project-check", (route) => {
    firstPageReads++;
    return route.fulfill({
      json: {
        scope: "visitor:refresh",
        signedIn: false,
        checks: [
          {
            ...first,
            analysis: {
              ...first.analysis,
              title: changed ? "갱신된 예약 클래스" : "새 예약 클래스",
            },
          },
        ],
        nextCursor: "older",
      },
    });
  });
  await page.goto("/projects");
  await expect(page.getByRole("button", { name: "이전 프로젝트 더 보기" })).toBeEnabled();
  const readsBeforeMore = firstPageReads;
  await page.getByRole("button", { name: "이전 프로젝트 더 보기" }).click();
  await expect(page.getByRole("heading", { name: "이전 예약 클래스" })).toBeVisible();
  expect(firstPageReads).toBe(readsBeforeMore);
  const search = page.getByRole("searchbox", { name: "내 프로젝트 찾기" });
  await search.fill("예약");
  changed = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("heading", { name: "갱신된 예약 클래스" })).toBeVisible();
  await expect(search).toHaveValue("예약");
  await expect(page.getByRole("heading", { name: "이전 예약 클래스" })).toHaveCount(0);
  expect(secondPageReads).toBeGreaterThanOrEqual(2);
  await expect(page.getByRole("button", { name: "이전 프로젝트 더 보기" })).toHaveCount(0);
});

test("detail refreshes on focus without replacing edit drafts or accepting stale revisions", async ({
  page,
}) => {
  let revision = 0;
  let submittedRevision: number | undefined;
  await page.route("**/api/project-check", (route) =>
    route.fulfill({
      json: {
        scope: "visitor:refresh",
        checks: [checkListItem(publicCheck(fixtureCheck))],
        nextCursor: null,
      },
    }),
  );
  await page.route(`**/api/projects/${fixtureCheck.id}`, (route) => {
    if (route.request().method() === "PATCH") {
      submittedRevision = route.request().postDataJSON().revision;
      return route.fulfill({
        status: 409,
        json: { error: "다른 탭에서 수정되었습니다. 최신 정보를 확인해 주세요." },
      });
    }
    return route.fulfill({
      json: {
        check: {
          ...fixtureCheck,
          review: revision ? { answers: ["새로 작성한 답변"] } : undefined,
          classMetadata: {
            name: revision ? "다른 탭에서 수정한 이름" : "처음 이름",
            goal: "",
            revision,
            updatedAt: fixtureCheck.createdAt,
          },
        },
        practice: null,
        workshop: null,
      },
    });
  });
  await page.goto(`/projects?class=${fixtureCheck.id}`);
  await page.getByRole("button", { name: "정보 수정" }).click();
  await page.getByRole("textbox", { name: "클래스 이름" }).fill("작성 중인 이름");
  revision = 1;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(
    page.getByRole("heading", { name: "다른 탭에서 수정한 이름", includeHidden: true }),
  ).toBeAttached();
  await expect(page.getByRole("textbox", { name: "클래스 이름" })).toHaveValue("작성 중인 이름");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "다른 탭에서 수정되었습니다",
  );
  expect(submittedRevision).toBe(0);
  await page.getByRole("button", { name: "최신 정보 다시 불러오기" }).click();
  await expect(page.getByText("1/5 완료", { exact: true })).toBeVisible();
});

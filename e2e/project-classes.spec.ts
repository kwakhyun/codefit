import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SqliteStore } from "../src/lib/server/sqlite-store";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { checkListItem } from "../src/lib/project-check/types";
for (const width of [1280, 390]) {
  test(`project classes edit, review without overwriting, and delete at ${width}px`, async ({
    page,
  }) => {
    const store = new SqliteStore(":memory:"),
      owner = "visitor:classes",
      id = fixtureCheck.id;
    const job = store.startJob(owner, id, "project-analysis", "class");
    if (job.state !== "new") throw Error();
    await store.queries.projectChecks.complete(job.lease, {
      ...fixtureCheck,
      page: {
        ...fixtureCheck.page,
        source: "repository",
        repository: {
          name: "owner/repo",
          commit: "a".repeat(40),
          totalFiles: 1,
          eligibleFiles: 1,
          omittedFiles: 0,
          truncatedTree: false,
          links: [],
          files: [
            {
              path: "main.ts",
              totalLines: 1,
              partial: false,
              lines: [{ number: 1, text: "if (previous) return previous;" }],
            },
          ],
        },
      },
    });
    const task = {
      title: "기존 결과 재사용",
      purpose: "중복 저장 확인",
      situation: "기존 결과가 있는 요청",
      assumptions: "previous가 있음",
      evidence: ["main.ts:L1 if (previous) return previous;"],
      question: "어떤 결과를 반환하나요?",
      choices: ["기존 결과", "새 결과"],
      answer: 0,
      walkthrough: [
        { action: "기존 값 확인", result: "값 있음" },
        { action: "반환", result: "기존 값" },
      ],
      explanation: "기존 값을 반환하므로 새 결과를 만들지 않습니다.",
      verification: "같은 요청으로 반환값 비교",
    };
    const practice = {
      exercises: { code: Array(3).fill(task), service: Array(3).fill(task) },
      progress: { code: [{ choice: 0, note: "처음 확인한 기록", completed: true }], service: [] },
      revision: 1,
      createdAt: fixtureCheck.createdAt,
    };
    const practiceJob = store.startJob(
      owner,
      `${id}:practice`,
      `project-practice:${id}`,
      "practice",
    );
    if (practiceJob.state !== "new") throw Error();
    await store.queries.projectChecks.completePractice(practiceJob.lease, id, practice);
    let edits = 0;
    await page.route("**/api/project-check", async (route) =>
      route.fulfill({
        json: {
          scope: owner,
          signedIn: false,
          aiReady: false,
          ...(await store.queries.projectChecks.page(owner)),
          checks: (await store.queries.projectChecks.list(owner)).map(checkListItem),
          usage: await store.queries.projectChecks.usage(owner),
        },
      }),
    );
    await page.route(`**/api/projects/${id}/versions`, async (route) =>
      route.fulfill({
        json: {
          checks: [
            {
              ...checkListItem((await store.queries.projectChecks.detail(owner, id))!),
              id: "77777777-7777-4777-8777-777777777777",
              analysis: { title: "이전 분석 클래스" },
            },
          ],
          nextCursor: null,
        },
      }),
    );
    await page.route(`**/api/projects/${id}`, async (route) => {
      if (route.request().method() === "PATCH") {
        edits++;
        return route.fulfill({
          json: await store.queries.projectChecks.editClass(
            owner,
            id,
            route.request().postDataJSON(),
          ),
        });
      }
      if (route.request().method() === "DELETE") {
        await store.queries.projectChecks.remove(owner, id);
        return route.fulfill({ json: { removed: true } });
      }
      return route.fulfill({
        json: {
          check: await store.queries.projectChecks.detail(owner, id),
          practice: await store.queries.projectChecks.generatedPractice(owner, id),
          workshop: null,
        },
      });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/projects");
    await page.getByRole("link", { name: /클래스 열기/ }).click();
    await expect(
      page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /이전 분석 클래스/ })).toHaveAttribute(
      "href",
      "/projects?class=77777777-7777-4777-8777-777777777777",
    );
    await page.getByRole("button", { name: "정보 수정" }).click();
    await page.getByRole("textbox", { name: "클래스 이름" }).fill("내 예약 서비스 클래스");
    await page
      .getByRole("textbox", { name: "학습 목표와 메모" })
      .fill("중복 요청과 권한 변경을 확인합니다.");
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByRole("heading", { name: "내 예약 서비스 클래스" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "내 예약 서비스 클래스" })).toBeVisible();
    await page.getByRole("button", { name: "복습하기", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "기억나는 만큼 다시 풀어보세요" }),
    ).toBeVisible();
    await page
      .getByRole("textbox", { name: "지금 떠오르는 설명" })
      .fill("서버에서 권한을 다시 확인합니다.");
    await page.reload();
    await page.getByRole("button", { name: "복습하기", exact: true }).click();
    await expect(page.getByRole("textbox", { name: "지금 떠오르는 설명" })).toHaveValue(
      "서버에서 권한을 다시 확인합니다.",
    );
    await page.getByRole("button", { name: "이전 답변과 비교" }).click();
    await expect(page.getByText("아직 저장한 답변이 없습니다.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "다음 복습" }).click();
    await page.reload();
    await page.getByRole("button", { name: "복습하기", exact: true }).click();
    await expect(page.getByText("2 / 11", { exact: true })).toBeVisible();
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "이전 답변과 비교" }).click();
      await page.getByRole("button", { name: "다음 복습" }).click();
    }
    await expect(page.getByRole("button", { name: "정답과 해설 확인" })).toBeDisabled();
    await page.getByRole("radio", { name: "새 결과", exact: true }).check();
    await page.getByRole("button", { name: "정답과 해설 확인" }).click();
    await expect(
      page.getByText("기존 값을 반환하므로 새 결과를 만들지 않습니다.", { exact: true }),
    ).toBeVisible();
    expect(await store.queries.projectChecks.generatedPractice(owner, id)).toEqual(practice);
    expect(edits).toBe(1);
    expect((await store.queries.projectChecks.get(owner, id))?.analysis).toEqual(
      fixtureCheck.analysis,
    );
    expect(
      (await new AxeBuilder({ page }).include(".project-classes-page").analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/project-classes-${width}.png`, fullPage: true });
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("button", { name: "취소", exact: true }).click();
    expect(await store.queries.projectChecks.get(owner, id)).not.toBeNull();
    await page.getByRole("button", { name: "삭제", exact: true }).click();
    await page.getByRole("button", { name: "클래스 영구 삭제" }).click();
    await expect(page).toHaveURL(/\/projects$/);
    await expect(page.getByRole("link", { name: "첫 프로젝트 연결하기" })).toBeVisible();
    expect(await store.queries.projectChecks.get(owner, id)).toBeNull();
    store.db.close();
  });
}

import { test, expect } from "@playwright/test";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { testAccount } from "../scripts/lib/test-account";
import { E2E_BASE_URL } from "../scripts/lib/e2e-environment";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { emptyLearning } from "../src/lib/learn/progress";
import { restoredProjectId } from "../src/lib/server/workspace-backup";
import AxeBuilder from "@axe-core/playwright";

test("download and restore coding, beginner and project learning through account UI", async ({
  page,
  context,
}) => {
  const source = await testAccount(resolve("artifacts/e2e.sqlite"), E2E_BASE_URL);
  const target = await testAccount(resolve("artifacts/e2e.sqlite"), E2E_BASE_URL);
  const id = crypto.randomUUID();
  const login = async (cookie: string) => {
    const [name, ...parts] = cookie.split("=");
    await context.clearCookies();
    await context.addCookies([
      { name, value: parts.join("="), url: E2E_BASE_URL, httpOnly: true, sameSite: "Lax" },
    ]);
  };
  try {
    // All browser projects share only this disposable test DB. Previous runs
    // must not exhaust its global/network import buckets for the next browser.
    source.store.db.prepare("DELETE FROM limits WHERE key LIKE 'import:%'").run();
    source.store.saveProgress(source.owner, "be-pagination", {
      code: "백업할 코드",
      baseRevision: 0,
    });
    await source.store.queries.learning.save(
      source.owner,
      "where-data-lives",
      JSON.stringify({ ...emptyLearning(), reason: "새로고침해도 서버 기록을 다시 읽습니다." }),
      0,
    );
    for (const phase of ["analysis", "review"] as const) {
      const claim = source.store.startJob(
        source.owner,
        phase === "analysis" ? id : `project-review-${id}`,
        phase === "analysis" ? "project-analysis" : `project-review:${id}`,
        "fixture",
      );
      if (claim.state !== "new") throw new Error();
      await source.store.queries.projectChecks.complete(
        claim.lease,
        phase === "analysis"
          ? { ...fixtureCheck, id }
          : { answers: Array(5).fill("내 설계 설명"), assessment: fixtureAssessment },
      );
    }
    await source.store.queries.projectLearning.submit(source.owner, {
      id,
      moduleId: "storage",
      phase: "baseline",
      revision: 0,
      answers: [0, 1],
      confidence: "unsure",
      assisted: false,
    });
    const training = await source.store.queries.projectLearning.get(source.owner, id);
    await login(source.cookie);
    await page.goto("/");
    await page.getByRole("button", { name: "환경 설정" }).click();
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name: "내 학습 기록 내보내기", exact: true }).click();
    const path = await (await downloaded).path();
    const file = await readFile(path!);
    const data = JSON.parse(file.toString());
    expect(data.version).toBe(3);
    expect(data.problems).toHaveLength(1);
    expect(data.projects).toHaveLength(1);
    await login(target.cookie);
    await page.goto("/");
    await page.getByRole("button", { name: "환경 설정" }).click();
    await page
      .getByLabel("학습 기록 백업 파일")
      .setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: file });
    const status = page
      .getByRole("dialog")
      .getByRole("status")
      .filter({ hasText: "백업을 가져왔습니다" });
    await expect(status).toContainText("입문 실습 1개, 프로젝트 1개");
    await page.setViewportSize({ width: 390, height: 844 });
    await status.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `artifacts/workspace-backup-${test.info().project.name}.png` });
    const restored = restoredProjectId(target.owner, id);
    expect(
      (await target.store.queries.learning.get(target.owner, "where-data-lives"))?.code,
    ).toContain("서버 기록");
    expect(target.store.progressFor(target.owner, "be-pagination")?.code).toBe("백업할 코드");
    expect(await target.store.queries.projectLearning.get(target.owner, restored)).toEqual(
      training,
    );
    // Re-import the same selected file; the input must reset so this change fires again.
    await page
      .getByLabel("학습 기록 백업 파일")
      .setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: file });
    await expect(status).toContainText("입문 실습 0개, 프로젝트 0개");
    await page.goto(`/project-check?check=${restored}`);
    await expect(
      page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
    ).toBeVisible();
    await page.getByText("질문별 AI 피드백 5개 보기", { exact: true }).click();
    await page.getByText("내 답변 보기", { exact: true }).first().click();
    await expect(page.getByText("내 설계 설명", { exact: true }).first()).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: fixtureCheck.analysis.title, exact: true }),
    ).toBeVisible();
    expect(await target.store.queries.projectChecks.get(target.owner, id)).toBeNull();
  } finally {
    source.store.db.close();
    target.store.db.close();
  }
});

import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SqliteStore } from "../src/lib/server/sqlite-store";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import { missionById } from "../src/lib/learn/catalog";
import { emptyLearning } from "../src/lib/learn/progress";
import { verification } from "../src/lib/learn/simulation";
import { trainingInput } from "../src/lib/project-learning/types";
// Real in-memory storage and grading behind transport fixtures; OAuth and paid AI are not invoked.
test("project learning: first answers, recovery, practice gate, transfer and accessible results", async ({
  page,
}, info) => {
  const store = new SqliteStore(":memory:"),
    owner = "user:learning-browser",
    id = fixtureCheck.id;
  const review = {
    answers: Array(5).fill("처리 흐름을 설명했습니다."),
    assessment: fixtureAssessment,
  };
  for (const phase of ["analysis", "review"] as const) {
    const claim = store.startJob(
      owner,
      phase === "analysis" ? id : `project-review-${id}`,
      phase === "analysis" ? "project-analysis" : `project-review:${id}`,
      "fixture",
    );
    if (claim.state !== "new") throw new Error();
    await store.queries.projectChecks.complete(
      claim.lease,
      phase === "analysis" ? fixtureCheck : review,
    );
  }
  let failNext = false,
    lostResponse = false;
  await page.route("**/api/project-check", (route) =>
    route.fulfill({
      json: {
        scope: owner,
        signedIn: true,
        aiReady: true,
        checks: [{ ...publicCheck(fixtureCheck), review }],
        usage: {
          analysis: { limit: 2, remaining: 1, resetsAt: null },
          review: { limit: 4, remaining: 3, resetsAt: null },
        },
      },
    }),
  );
  await page.route("**/api/project-check/training**", async (route) => {
    if (route.request().method() === "GET")
      return route.fulfill({ json: await store.queries.projectLearning.get(owner, id) });
    if (failNext) {
      failNext = false;
      return route.abort();
    }
    try {
      const result = await store.queries.projectLearning.submit(
        owner,
        trainingInput.parse(route.request().postDataJSON()),
      );
      if (lostResponse) {
        lostResponse = false;
        return route.abort();
      }
      return route.fulfill({ json: result });
    } catch (e) {
      return route.fulfill({ status: 409, json: { error: (e as Error).message } });
    }
  });
  try {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/project-check?check=${id}`);
    await page.getByText("기초 개념을 예제로 연습하기 (선택)", { exact: true }).click();
    const panel = page.getByRole("region", { name: "기초 개념 실습과 확인" });
    await expect(panel.getByRole("heading", { name: "요청과 결과 연결하기" })).toBeVisible();
    for (const width of [320, 390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await panel.getByRole("button", { name: /데이터 저장/ }).click();
    await expect(panel.getByRole("heading", { name: "저장 위치 확인하기" })).toBeFocused();
    expect(
      await panel
        .locator(".training-question label")
        .first()
        .evaluate((el) => getComputedStyle(el).display),
    ).toBe("flex");
    expect(
      (
        await new AxeBuilder({ page })
          .include("#training")
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await panel.screenshot({
      path: `artifacts/project-learning-${info.project.name}-questions.png`,
    });
    await panel.getByRole("radio", { name: "모든 사용자와 공유되는 서버 저장이 확인됐다" }).check();
    await panel.getByRole("radio", { name: "같은 기기에서 버튼을 여러 번 누른다" }).check();
    await panel.getByRole("radio", { name: "확신해요" }).focus();
    await page.keyboard.press("Space");
    await page.reload();
    await page.getByText("기초 개념을 예제로 연습하기 (선택)", { exact: true }).click();
    await panel.getByRole("button", { name: /데이터 저장/ }).click();
    await expect(panel.getByRole("radio", { name: "확신해요" })).toBeChecked();
    failNext = true;
    await panel.getByRole("button", { name: "첫 답변 저장하고 실습하기" }).click();
    await expect(panel.getByRole("alert")).toContainText("입력한 답변은 유지됩니다");
    await expect(
      panel.getByRole("radio", { name: "모든 사용자와 공유되는 서버 저장이 확인됐다" }),
    ).toBeChecked();
    lostResponse = true;
    await panel.getByRole("button", { name: "첫 답변 저장하고 실습하기" }).click();
    await expect
      .poll(() => store.queries.projectLearning.get(owner, id).then((v) => v.revision))
      .toBe(1);
    await expect(panel.getByRole("button", { name: "첫 답변 저장하고 실습하기" })).toBeEnabled();
    await panel.getByRole("button", { name: "첫 답변 저장하고 실습하기" }).click();
    await expect(panel.getByText("시작 전 답변이 저장됐습니다.")).toBeVisible();
    await page.reload();
    await page.getByText("기초 개념을 예제로 연습하기 (선택)", { exact: true }).click();
    await expect(panel.getByRole("heading", { name: "저장 위치 확인하기" })).toBeVisible();
    await expect(panel.getByText("시작 전 답변이 저장됐습니다.")).toBeVisible();
    await expect(panel.getByRole("link", { name: /데이터는 어디에 저장될까요/ })).toHaveAttribute(
      "href",
      `/learn/where-data-lives?project=${id}`,
    );
    await expect(panel.getByText("정답:", { exact: false })).toHaveCount(0);
    await store.queries.learning.save(
      owner,
      "where-data-lives",
      JSON.stringify(completedPractice("where-data-lives")),
      0,
    );
    await panel.getByRole("button", { name: "실습 기록 새로고침" }).click();
    await panel
      .getByRole("radio", {
        name: "브라우저 저장에 의존했을 수 있으며 서버 보관은 확인되지 않았다",
      })
      .check();
    await panel
      .getByRole("radio", {
        name: "같은 계정의 다른 기기에서는 보이고, 권한 없는 계정에서는 보이지 않는지",
      })
      .check();
    await panel.getByRole("radio", { name: "대체로 알겠어요" }).check();
    await panel.getByRole("checkbox", { name: /외부 도움/ }).check();
    await panel.getByRole("button", { name: "답변 저장하고 결과 보기" }).click();
    await expect(
      panel.getByRole("heading", { name: "새로운 상황의 두 문제를 모두 맞혔어요" }),
    ).toBeVisible();
    await expect(panel.getByText("0 / 2", { exact: true })).toBeVisible();
    await expect(panel.getByText("2 / 2", { exact: true })).toBeVisible();
    await expect(panel.getByText("확인 문제에서 도움을 사용했다고 표시했습니다.")).toBeVisible();
    await panel.getByText("다른 상황의 질문 답변과 해설", { exact: true }).click();
    await expect(panel.getByText(/브라우저 데이터 삭제 뒤의 관찰로/)).toBeVisible();
    const scan = await new AxeBuilder({ page })
      .include("#training")
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(scan.violations).toEqual([]);
    await panel.screenshot({
      path: `artifacts/project-learning-${info.project.name}-mobile.png`,
    });
    await page.setViewportSize({ width: 1440, height: 1100 });
    await panel.screenshot({ path: `artifacts/project-learning-${info.project.name}-desktop.png` });
    const download = page.waitForEvent("download");
    await panel.getByRole("button", { name: "내 확인 기록 내려받기" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe("codefit-learning-storage.json");
    const stream = await file.createReadStream();
    let exported = "";
    for await (const chunk of stream!) exported += chunk.toString();
    const saved = JSON.parse(exported);
    expect(saved.contentId).toBe((await store.queries.projectLearning.get(owner, id)).contentId);
    expect(saved.contentId).toMatch(/^[a-f0-9]{64}$/);
    expect(saved.result.transfer.correct).toBe(2);
    await panel.getByRole("button", { name: "다음 영역 연습하기" }).click();
    await expect(panel.getByRole("heading", { name: "요청과 결과 연결하기" })).toBeFocused();
  } finally {
    store.db.close();
  }
});

function completedPractice(missionId: string) {
  const m = missionById(missionId)!;
  const fix = m.fixes.find((f) => verification(m, f.id).every((c) => c.passed))!;
  return {
    ...emptyLearning(),
    locked: true,
    prediction: m.answer,
    actions: m.reproduce,
    fix: fix.id,
    checked: verification(m, fix.id).map((c) => c.id),
    transfer: m.transfer.answer,
    reflection: "관찰한 결과와 요구사항을 비교했습니다.",
    completed: true,
    request: {
      where: "서비스 화면",
      steps: "재현한 순서",
      actual: "관찰한 결과",
      expected: "예상한 결과",
      keep: "유지할 동작",
    },
  };
}

test("project learning API: authenticated persistence without AI, account isolation and deletion", async ({
  page,
  context,
  baseURL,
}) => {
  const { testAccount } = await import("../scripts/lib/test-account");
  const { resolve } = await import("node:path");
  const { randomUUID } = await import("node:crypto");
  const db = resolve(process.env.CODEFIT_PROJECT_TEST_DB || "artifacts/e2e.sqlite");
  const a = await testAccount(db, baseURL!),
    b = await testAccount(db, baseURL!);
  const id = randomUUID();
  const login = async (cookie: string) => {
    const [name, ...value] = cookie.split("=");
    await context.addCookies([
      { name, value: value.join("="), url: baseURL!, httpOnly: true, sameSite: "Lax" },
    ]);
  };
  const endpoint = "/api/project-check/training";
  try {
    for (const phase of ["analysis", "review"] as const) {
      const claim = a.store.startJob(
        a.owner,
        phase === "analysis" ? id : `project-review-${id}`,
        phase === "analysis" ? "project-analysis" : `project-review:${id}`,
        "fixture",
      );
      if (claim.state !== "new") throw new Error();
      await a.store.queries.projectChecks.complete(
        claim.lease,
        phase === "analysis"
          ? { ...fixtureCheck, id }
          : { answers: Array(5).fill("처리 흐름 설명"), assessment: fixtureAssessment },
      );
    }
    await login(a.cookie);
    const headers = { "x-codefit-workspace": a.owner };
    const first = await page.request.get(`${endpoint}?id=${id}`, { headers });
    expect(first.status()).toBe(200);
    expect(first.headers()["cache-control"]).toBe("no-store");
    const payload = {
      id,
      moduleId: "storage",
      phase: "baseline",
      revision: 0,
      answers: [1, 2],
      confidence: "likely",
      assisted: false,
    };
    const saved = await page.request.post(endpoint, { headers, data: payload });
    expect(saved.status()).toBe(200);
    expect((await saved.json()).revision).toBe(1);
    const replay = await page.request.post(endpoint, { headers, data: payload });
    expect((await replay.json()).revision).toBe(1);
    await login(b.cookie);
    expect(
      (
        await page.request.get(`${endpoint}?id=${id}`, {
          headers: { "x-codefit-workspace": b.owner },
        })
      ).status(),
    ).toBe(404);
    expect((await page.request.post(endpoint, { headers, data: payload })).status()).toBe(409);
    expect(
      (
        await page.request.post(endpoint, {
          headers: { "x-codefit-workspace": b.owner },
          data: payload,
        })
      ).status(),
    ).toBe(404);
    await login(a.cookie);
    const practice = await page.request.put("/api/learn/where-data-lives", {
      headers,
      data: { code: JSON.stringify(completedPractice("where-data-lives")), baseRevision: 0 },
    });
    expect(practice.status()).toBe(200);
    const final = await page.request.post(endpoint, {
      headers,
      data: { ...payload, revision: 1, phase: "transfer", answers: [2, 0] },
    });
    expect(final.status()).toBe(200);
    expect(
      (await final.json()).modules.find((m: { id: string }) => m.id === "storage").result.transfer
        .correct,
    ).toBe(2);
    await page.goto(`/learn/where-data-lives?project=${id}`);
    const back = page.getByRole("link", { name: "← 실습을 마치면 프로젝트 확인 문제로 돌아가기" });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page.getByRole("region", { name: "기초 개념 실습과 확인" })).toBeVisible();
    expect((await page.request.get("/api/project-check")).status()).toBe(200);
    await page.request.delete("/api/project-check", { headers, data: { id } });
    expect((await page.request.get(`${endpoint}?id=${id}`, { headers })).status()).toBe(404);
  } finally {
    a.store.db.close();
    b.store.db.close();
  }
});

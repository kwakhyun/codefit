import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MISSIONS, ACTION_LABELS, actionLabel, type Mission } from "../src/lib/learn/catalog";
import { verification } from "../src/lib/learn/simulation";
import { emptyLearning, requestFields } from "../src/lib/learn/progress";
async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
}
async function predict(page: Page, m: Mission) {
  await page.goto(`/learn/${m.id}`);
  await page.getByRole("radio", { name: m.choices[m.answer], exact: true }).check();
  await page
    .getByLabel("왜 그렇게 생각했나요?")
    .fill("실제 데이터와 화면 안내가 다를 수 있다고 생각합니다.");
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
}
async function reproduce(page: Page, m: Mission) {
  for (const a of m.reproduce)
    await page
      .getByRole("button", {
        name: m.app === "filter" && a === "refresh" ? "전체 다시 보기" : actionLabel(m, a),
        exact: true,
      })
      .click();
  await page.getByRole("button", { name: "수정 방법과 검사 살펴보기" }).click();
}
async function saved(page: Page, id: string) {
  return (await (await page.request.get(`/api/learn/${id}`)).json()).progress;
}
for (const m of MISSIONS)
  test(`${m.id}: predict, reproduce, compare repairs, verify and transfer`, async ({
    page,
  }, info) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await predict(page, m);
    await expect(page.getByRole("heading", { name: "2. 직접 확인" })).toBeFocused();
    await reproduce(page, m);
    if (m.kind === "lab")
      for (const f of requestFields)
        await page
          .getByLabel(f.label, { exact: true })
          .fill(`${f.placeholder} — 관찰한 결과와 정상 동작을 비교합니다.`);
    const good = m.fixes.find((f) => verification(m, f.id).every((c) => c.passed))!;
    const bad = m.fixes.find((f) => f.id !== good.id)!;
    await page.getByRole("radio", { name: `${bad.title} ${bad.detail}`, exact: true }).check();
    for (const check of verification(m, bad.id))
      await page.getByRole("button", { name: `${check.label} 검사`, exact: true }).click();
    await expect(page.getByRole("button", { name: "다른 상황에 적용하기" })).toBeDisabled();
    await page.getByRole("radio", { name: `${good.title} ${good.detail}`, exact: true }).check();
    for (const check of verification(m, good.id))
      await page.getByRole("button", { name: `${check.label} 검사`, exact: true }).click();
    if (m.id === "where-data-lives") {
      await accessible(page);
      if (info.project.name === "chromium")
        await page.screenshot({ path: "artifacts/beginner-repair.png", fullPage: true });
    }
    await page.getByRole("button", { name: "다른 상황에 적용하기" }).click();
    await page
      .getByRole("radio", { name: m.transfer.choices[m.transfer.answer], exact: true })
      .check();
    await page
      .getByLabel("내 제품에서는 무엇을 확인할 건가요?")
      .fill("정상 동작과 실패 상황을 구분하고 다른 사용자로 다시 확인하겠습니다.");
    await page.getByRole("button", { name: "학습 기록 마치기" }).click();
    await expect(
      page.getByRole("heading", { name: "직접 확인하는 연습을 마쳤어요." }),
    ).toBeVisible();
    await expect
      .poll(async () => JSON.parse((await saved(page, m.id))?.code || "{}").completed)
      .toBe(true);
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "직접 확인하는 연습을 마쳤어요." }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
test("stage navigation preserves observation undo and repair experiments", async ({ page }) => {
  const mission = MISSIONS.find((item) => item.id === "where-data-lives")!;
  await predict(page, mission);
  const app = page.getByRole("region", { name: "실습 서비스", exact: true });
  await app.getByRole("button", { name: ACTION_LABELS.save, exact: true }).click();
  await app.getByRole("button", { name: ACTION_LABELS.refresh, exact: true }).click();
  const observations = page.locator(".learn-observations ol li");
  const original = await observations.allTextContents();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "기록 내려받고 관찰 다시 시작", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("codefit-where-data-lives.txt");
  const navigation = page.getByRole("navigation", { name: "입문 미션 단계" });
  await navigation.getByRole("button", { name: /예상하기/ }).click();
  await navigation.getByRole("button", { name: /직접 확인/ }).click();
  await page.getByRole("button", { name: "이전 관찰 복구", exact: true }).click();
  await expect(observations).toHaveText(original);
  await page.getByRole("button", { name: "수정 방법과 검사 살펴보기" }).click();
  await page.getByRole("radio", { name: /^서버 저장 결과를 확인/ }).check();
  await page.getByText("수정안이 적용된 서비스 사용해 보기", { exact: true }).click();
  await app.getByRole("button", { name: ACTION_LABELS.save, exact: true }).click();
  await expect(app).toContainText("서버 응답 확인: 저장 완료");
  await navigation.getByRole("button", { name: /직접 확인/ }).click();
  await navigation.getByRole("button", { name: /수정과 검사/ }).click();
  await page.getByText("수정안이 적용된 서비스 사용해 보기", { exact: true }).click();
  await expect(app).toContainText("서버 응답 확인: 저장 완료");
});
test("mobile keyboard entry, dashboard, hints and accessibility", async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/learn");
  await expect(page.getByRole("heading", { name: "서비스 오류 해결 실습" })).toBeVisible();
  await accessible(page);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/beginner-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "첫 미션 시작하기 (약 5분)" }).click();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  await expect(page.locator("#learn-choice-0")).toBeFocused();
  await page.keyboard.press("Space");
  await page.getByLabel("왜 그렇게 생각했나요?").fill("화면에 남을 것 같아요.");
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  await page.getByRole("button", { name: "힌트 보기 0/3" }).click();
  await expect(page.getByText("저장 후 새로고침을 눌러 보세요.", { exact: true })).toBeVisible();
  await accessible(page);
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/beginner-observe.png", fullPage: true });
});
test("stale tabs retain drafts, recheck conflicts, isolate guests and recover offline", async ({
  page,
  context,
  browser,
}) => {
  await page.goto("/learn/where-data-lives");
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toBeEditable();
  const b = await context.newPage();
  await b.goto("/learn/where-data-lives");
  await b.getByLabel("왜 그렇게 생각했나요?").fill("B에서 먼저 저장한 내용");
  await expect
    .poll(async () => JSON.parse((await saved(b, "where-data-lives"))?.code || "{}").reason)
    .toBe("B에서 먼저 저장한 내용");
  await page.getByLabel("왜 그렇게 생각했나요?").fill("A에서 늦게 작성한 내용");
  await expect(page.getByRole("region", { name: "학습 기록 충돌" })).toBeVisible();
  await page.getByLabel("왜 그렇게 생각했나요?").fill("충돌 비교 중에도 입력을 유지합니다");
  await b.getByLabel("왜 그렇게 생각했나요?").fill("B에서 다시 바뀐 최신 내용");
  await expect
    .poll(async () => JSON.parse((await saved(b, "where-data-lives"))?.code || "{}").reason)
    .toBe("B에서 다시 바뀐 최신 내용");
  await page.getByRole("button", { name: "비교한 버전에 내 기록 저장" }).click();
  await expect(page.getByRole("region", { name: "학습 기록 충돌" })).toBeVisible();
  await page.getByText("내 기록과 서버 기록 비교", { exact: true }).click();
  await expect(page.getByLabel("서버 학습 기록")).toContainText("B에서 다시 바뀐 최신 내용");
  await page.getByRole("button", { name: "비교한 버전에 내 기록 저장" }).click();
  await expect(page.getByRole("region", { name: "학습 기록 충돌" })).toHaveCount(0);
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toHaveValue(
    "충돌 비교 중에도 입력을 유지합니다",
  );
  await context.setOffline(true);
  await page.getByLabel("왜 그렇게 생각했나요?").fill("연결이 끊겨도 생각을 기록합니다");
  await expect(page.getByText("오프라인 · 브라우저 보관", { exact: true })).toBeVisible();
  await context.setOffline(false);
  await expect
    .poll(async () => JSON.parse((await saved(page, "where-data-lives"))?.code || "{}").reason)
    .toBe("연결이 끊겨도 생각을 기록합니다");
  const other = await browser.newContext();
  expect(
    (
      await (
        await other.request.get(new URL("/api/learn/where-data-lives", page.url()).href)
      ).json()
    ).progress,
  ).toBeNull();
  await other.close();
  await b.close();
});
test("late AI question preserves new writing and retry IDs; APIs validate scope and evidence", async ({
  page,
}) => {
  const m = MISSIONS.find((m) => m.id === "broken-memo")!;
  await page.route(`**/api/learn/${m.id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const response = await route.fetch();
    await route.fulfill({ response, json: { ...(await response.json()), aiReady: true } });
  });
  await predict(page, m);
  await reproduce(page, m);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const ids: string[] = [];
  await page.route(`**/api/learn/${m.id}/coach`, async (route) => {
    ids.push(route.request().postDataJSON().requestId);
    if (ids.length === 1) return route.fulfill({ status: 503, json: { error: "AI 연결 실패" } });
    await gate;
    await route.fulfill({
      json: {
        question: "실제 저장 수와 안내가 같았나요?",
        nextCheck: "연결 복구 후 다시 확인하세요.",
      },
    });
  });
  await page.getByRole("button", { name: "AI에게 보완할 점 묻기" }).click();
  await expect(page.locator(".inline-error")).toContainText("AI 연결 실패");
  await page.getByRole("button", { name: "AI에게 보완할 점 묻기" }).click();
  await page
    .getByLabel("어디에서 문제가 생겼나요?", { exact: true })
    .fill("응답을 기다리면서 추가한 새 메모");
  release();
  await expect(page.getByLabel("AI 코치 질문")).toContainText("이전 작성 내용에 대한 질문");
  await expect(
    page.getByRole("textbox", { name: "어디에서 문제가 생겼나요?", exact: true }),
  ).toHaveValue("응답을 기다리면서 추가한 새 메모");
  expect(ids[0]).toBe(ids[1]);
  expect(
    (
      await page.request.put(`/api/learn/${m.id}`, {
        data: { code: JSON.stringify({ ...emptyLearning(), completed: true }), baseRevision: 0 },
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await page.request.put(`/api/learn/${m.id}`, {
        headers: { "X-Codefit-Workspace": "user:other" },
        data: { code: JSON.stringify(emptyLearning()), baseRevision: 0 },
      })
    ).status(),
  ).toBe(409);
  expect(
    (
      await page.request.post(`/api/learn/${m.id}/coach`, {
        data: { record: emptyLearning(), requestId: crypto.randomUUID() },
      })
    ).status(),
  ).toBe(400);
});
test("feature banner rotates, pauses for keyboard and honors reduced motion", async ({
  page,
}, info) => {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  const banner = page.getByRole("region", { name: "코드핏 핵심 기능" });
  await expect(page.locator(".workspace-avatar")).toHaveCount(0);
  await expect(page.getByLabel("현재 이용 상태")).toContainText("로그인 없이 이용 중");
  await expect(page.getByRole("button", { name: /배너 자동 전환/ })).toHaveCount(0);

  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "1 / 6");
  await expect(banner.locator(".feature-rotation-label")).toHaveCount(0);
  const progress = () =>
    banner
      .locator(".feature-time-track > span")
      .evaluate((el) => Number((el as HTMLElement).style.transform.match(/scaleX\(([^)]+)\)/)![1]));
  expect(await progress()).toBeLessThan(0.2);
  await expect(banner.locator(".feature-time-track")).toHaveCSS("height", "1px");
  await page.clock.fastForward(3000);
  expect(await progress()).toBeGreaterThanOrEqual(0.35);
  expect(await progress()).toBeLessThan(0.5);
  expect(await progress()).toBeGreaterThanOrEqual(0.35);
  await banner.hover();
  await page.clock.fastForward(10000);
  expect(await progress()).toBeGreaterThanOrEqual(0.35);
  await page.mouse.move(0, 0);
  await page.clock.fastForward(5100);
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "2 / 6");
  await banner.getByRole("button", { name: "다음 기능", exact: true }).focus();
  await page.clock.fastForward(20000);
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "2 / 6");
  await page.keyboard.press("Enter");
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "3 / 6");
  await expect(banner.locator(".feature-rotation-label")).toHaveCount(0);
  const activeStyle = await banner.getByRole("group").evaluate((el) => ({
    animation: getComputedStyle(el).animationName,
    duration: getComputedStyle(el).animationDuration,
    background: getComputedStyle(el).backgroundColor,
  }));
  expect(activeStyle).toEqual({
    animation: "feature-enter",
    duration: "1s",
    background: "rgb(16, 19, 24)",
  });
  const resumeRotation = banner.getByRole("button", {
    name: "배너 자동 넘김 시작하기",
    exact: true,
  });
  await resumeRotation.focus();
  await page.keyboard.press("Enter");
  await page.mouse.move(0, 0);
  await page.clock.fastForward(8100);
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "4 / 6");
  await banner.getByRole("button", { name: "배너 자동 넘김 멈추기", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.clock.fastForward(10000);
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "4 / 6");
  await banner.getByRole("button", { name: "1번 기능: 서비스 원리 배우기" }).click();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const heights: number[] = [];
    for (let i = 0; i < 6; i++) {
      await banner.locator(".feature-dots button").nth(i).click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await expect(banner.getByRole("group")).toHaveCount(1);
      const button = banner.getByRole("group").locator(".primary-button");
      await expect(button).toHaveCSS(
        "background-color",
        [
          "rgb(125, 211, 172)",
          "rgb(242, 200, 121)",
          "rgb(147, 197, 253)",
          "rgb(196, 181, 253)",
          "rgb(147, 197, 253)",
          "rgb(125, 211, 172)",
        ][i],
      );
      const art = banner.getByRole("group").locator(".feature-art img");
      await expect(art).toBeVisible();
      await expect
        .poll(() => art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
        .toBe(true);
      heights.push((await banner.boundingBox())!.height);
      if (width === 1440) await accessible(page);
    }
    expect(
      Math.max(...heights) - Math.min(...heights),
      `${width}px: ${heights.join(", ")}`,
    ).toBeLessThanOrEqual(1);
  }
  await banner.getByRole("button", { name: "1번 기능: 서비스 원리 배우기" }).click();
  await accessible(page);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/beginner-banner.png", fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload();
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "1 / 6");
  await page.clock.fastForward(30000);
  await expect(banner.getByRole("group")).toHaveAttribute("aria-label", "1 / 6");
  await expect(banner.getByRole("button", { name: /배너 자동 전환/ })).toHaveCount(0);
});

test("banner entrypoints open lessons, labs, code understanding and generation", async ({
  page,
}) => {
  const banner = page.getByRole("region", { name: "코드핏 핵심 기능" });
  for (const [index, title, url] of [
    [1, "서비스 원리 배우기", /\/learn$/],
    [2, "서비스 오류 해결 연습하기", /\/learn#labs$/],
    [3, "AI 코드 이해 훈련", /\/handoff$/],
  ] as const) {
    await page.goto("/");
    await banner.getByRole("button", { name: `${index}번 기능: ${title}`, exact: true }).click();
    await banner.getByRole("link", { name: title, exact: true }).click();
    await expect(page).toHaveURL(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
  await page.goto("/");
  await banner.getByRole("button", { name: "4번 기능: AI 문제 만들기", exact: true }).click();
  const create = banner.getByRole("button", { name: "AI 문제 만들기", exact: true });
  await create.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("link", { name: "간편 로그인하고 AI 기능 사용하기" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(create).toBeFocused();
});

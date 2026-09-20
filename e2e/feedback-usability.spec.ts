import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MISSIONS, actionLabel } from "../src/lib/learn/catalog";
import { simulate } from "../src/lib/learn/simulation";

async function accessible(page: Page) {
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
      .violations,
  ).toEqual([]);
}

test("first visit recommends one mission and previews project questions before login", async ({
  page,
}, info) => {
  await page.goto("/");
  const recommended = page.getByRole("region", { name: "추천 첫 학습" });
  await expect(recommended.getByRole("link")).toHaveAttribute("href", "/learn/where-data-lives");
  await expect(page.getByRole("region", { name: "코드핏 핵심 기능" })).toBeVisible();
  await page.getByRole("radio", { name: "내 서비스 이해", exact: true }).click();
  await expect(page.locator(".persona-project-resume")).toContainText(
    "로그인 필요 · 24시간에 프로젝트 2개까지",
  );
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/feedback-home-desktop.png", fullPage: true });
  await accessible(page);
  await page.locator(".persona-project-resume").getByRole("link").click();
  const sample = page.getByRole("region", { name: "어떤 질문과 피드백을 받나요?" });
  await expect(sample).toContainText("실제 AI 분석 결과나 사용자 답변이 아닙니다");
  await expect(sample).toContainText("서버에서 요청자와 메모 소유자를 비교하는지");
  await sample.getByText("데이터 저장에 관한 질문도 보기", { exact: true }).click();
  await expect(sample).toContainText("어느 저장소를 기준으로");
  await expect(page.getByRole("link", { name: "간편 로그인하고 AI 기능 사용하기" })).toBeVisible();
  for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await accessible(page);
  if (info.project.name === "chromium")
    await page.screenshot({ path: "artifacts/feedback-project-preview.png", fullPage: true });
  await sample.getByRole("link", { name: "접근 권한 실습으로 확인하기 →" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "비공개 글의 접근 권한 확인하기",
  );
});

test("observation draft preserves writing, is editable, and survives record save and reload", async ({
  page,
}) => {
  const mission = MISSIONS.find((m) => m.id === "private-board")!;
  await page.goto(`/learn/${mission.id}`);
  await page.getByRole("radio", { name: mission.choices[1], exact: true }).check();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  for (const action of mission.reproduce)
    await page.getByRole("button", { name: actionLabel(mission, action), exact: true }).click();
  await page.getByRole("button", { name: "수정 방법과 검사 살펴보기" }).click();
  await page
    .getByLabel("어디에서 문제가 생겼나요?", { exact: true })
    .fill("내가 직접 적은 관찰 위치");
  await page.getByRole("button", { name: "관찰 기록으로 빈칸 채우기" }).click();
  await expect(page.locator("#request-where")).toHaveValue("내가 직접 적은 관찰 위치");
  await expect(page.locator("#request-steps")).toHaveValue(
    mission.reproduce.map((a) => actionLabel(mission, a)).join(" → "),
  );
  await expect(page.locator("#request-actual")).toHaveValue(
    `현재 사용자: 민수. ${simulate(mission, mission.reproduce).message}`,
  );
  await expect(page.locator("#request-expected")).toHaveValue("");
  await expect(page.locator("#request-keep")).toHaveValue("");
  await expect(page.getByRole("button", { name: "다른 상황에 적용하기" })).toBeDisabled();
  await expect(
    page.getByText(/위에 쓴 요청문이 코드를 자동으로 수정하지는 않습니다/),
  ).toBeVisible();
  const edited = "민수 계정에서 지민의 비공개 글이 보였습니다.";
  await page.locator("#request-actual").fill(edited);
  await page.getByRole("button", { name: "학습 기록 저장", exact: true }).click();
  await expect
    .poll(async () => {
      const data = await (await page.request.get(`/api/learn/${mission.id}`)).json();
      return JSON.parse(data.progress?.code || "{}").request?.actual;
    })
    .toBe(edited);
  await page.reload();
  await expect(page.locator("#request-actual")).toHaveValue(edited);
  await expect(page.locator("#request-where")).toHaveValue("내가 직접 적은 관찰 위치");
  await page.setViewportSize({ width: 390, height: 844 });
  await accessible(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("storage mission distinguishes learning save and optional observation actions", async ({
  page,
}) => {
  await page.goto("/learn/where-data-lives");
  await expect(page.getByText(/게스트 학습 기록은 서버에 저장하고/)).toBeVisible();
  await expect(page.getByRole("button", { name: "학습 기록 저장", exact: true })).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  await expect(page.locator(".learn-observation-guide")).toContainText(
    "데이터 저장 (저장하기) → 새로고침 실험",
  );
  const next = page.getByRole("button", { name: "수정 방법과 검사 살펴보기" });
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "데이터 저장", exact: true }).click();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "새로고침 실험", exact: true }).click();
  await expect(next).toBeEnabled();
  await expect(page.locator(".learn-observation-guide")).toContainText(
    "나머지 조작은 이 단계에서 선택 사항",
  );
  await expect(page.getByRole("button", { name: "다른 기기에서 보기", exact: true })).toBeEnabled();
  await page.goto("/learn");
  await expect(page.locator(".learn-progress")).toContainText(
    "쿠키를 지우면 기존 기록에 접근할 수 없습니다",
  );
});

test("slow original execution shows elapsed time and cancellation preserves prediction", async ({
  page,
}) => {
  // Hold only the WASM fetch, leaving the real runner and cancellation logic intact.
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/quickjs/*.wasm", async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  await page.goto("/problems/handoff-cart");
  await page.getByRole("radio", { name: "원본 2, 반환값 3" }).check();
  await page.getByLabel("왜 그렇게 생각했나요?").fill("배열 복사와 객체 참조를 구분하겠습니다.");
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  const waiting = page.getByText(/실행 환경을 준비하고 브라우저에서 코드를 실행합니다/);
  await expect(waiting).toContainText("12초를 넘기면 중단합니다");
  await expect(waiting).toContainText(/[1-9]초 경과/);
  await page.getByRole("button", { name: "대기 취소", exact: true }).click();
  release();
  await expect(waiting).toHaveCount(0);
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toHaveValue(
    "배열 복사와 객체 참조를 구분하겠습니다.",
  );
  await expect(page.getByRole("button", { name: "원본 다시 실행", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "원본 다시 실행", exact: true }).click();
  await expect(page.locator(".lab-observation > .lab-comparison")).toContainText("[3,3]");
});

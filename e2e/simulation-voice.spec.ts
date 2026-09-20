import { waitForUiTransitions } from "./ui-helpers";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { MISSIONS } from "../src/lib/learn/catalog";
import { simulate } from "../src/lib/learn/simulation";

test("all missions explain their purpose before recording real experiment actions", async ({
  page,
}) => {
  test.setTimeout(240_000);
  for (const mission of MISSIONS) {
    await page.goto(`/learn/${mission.id}`);
    await expect(page.getByRole("region", { name: "실습 상황과 기준" })).toContainText(
      "지켜야 할 조건",
    );
    await expect(page.locator("[data-sim-action]")).toHaveCount(0);
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
    const app = page.getByRole("region", { name: "실습 서비스", exact: true });
    for (const action of mission.reproduce)
      await app.locator(`[data-sim-action="${action}"]`).click();
    await expect(app.getByRole("status")).toHaveText(simulate(mission, mission.reproduce).message);
    await page.getByRole("button", { name: "학습 기록 저장", exact: true }).click();
    await expect
      .poll(async () => {
        const body = await (await page.request.get(`/api/learn/${mission.id}`)).json();
        return body.progress ? JSON.parse(body.progress.code).actions : [];
      })
      .toEqual(mission.reproduce);
    await page.reload();
    await expect(page.getByRole("region", { name: "실험 결과 요약" })).toBeVisible();
  }
});

test("desktop answers sit on the right; all dark services remain readable and accessible on mobile", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/learn/where-data-lives");
  await expect(page.locator(".prediction-answer")).toBeVisible();
  const app = (await page.locator(".prediction-example").boundingBox())!;
  const answers = (await page.locator(".prediction-answer").boundingBox())!;
  expect(answers.x).toBeGreaterThan(app.x + app.width);
  for (const mission of MISSIONS.filter(
    (m, i, all) => all.findIndex((x) => x.app === m.app) === i,
  )) {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto(`/learn/${mission.id}`);
      await expect(page.getByRole("region", { name: "실습 상황과 기준" })).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true);
      if (width === 390) {
        await waitForUiTransitions(page);
        expect(
          (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze())
            .violations,
        ).toEqual([]);
      }
    }
  }
  if (info.project.name === "chromium") {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/learn/price-and-rules");
    await page.locator(".mission-brief").scrollIntoViewIfNeeded();
    const intro = page.getByRole("button", { name: "첫 방문 안내 숨기기" });
    if (await intro.isVisible()) await intro.click();
    await page.screenshot({ path: "artifacts/sample-shop-mobile.png" });
  }
});

test("voice appends finalized text, preserves typing, ignores repeats and late events, and handles permission denial", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: FakeSpeech[]; SpeechRecognition: typeof FakeSpeech };
    class FakeSpeech {
      onresult?: (event: unknown) => void;
      onerror?: (event: unknown) => void;
      onend?: () => void;
      aborted = false;
      constructor() {
        w.__speech.push(this);
      }
      start() {}
      stop() {
        this.onend?.();
      }
      abort() {
        this.aborted = true;
        this.onend?.();
      }
      result(text: string, index = 0, isFinal = true) {
        this.onresult?.({
          resultIndex: index,
          results: { length: index + 1, [index]: { isFinal, 0: { transcript: text } } },
        });
      }
    }
    w.__speech = [];
    w.SpeechRecognition = FakeSpeech;
  });
  const response = await page.goto("/learn/where-data-lives");
  expect(response?.headers()["permissions-policy"]).toContain("microphone=(self)");
  const input = page.getByLabel("왜 그렇게 생각했나요?");
  await input.fill("직접 쓴 내용");
  await page.getByRole("button", { name: "음성으로 입력", exact: true }).click();
  await input.fill("직접 고친 내용");
  await page.evaluate(() =>
    (
      window as unknown as { __speech: { result: (t: string, i?: number, f?: boolean) => void }[] }
    ).__speech[0].result("아직 인식 중", 0, false),
  );
  await expect(input).toHaveValue("직접 고친 내용");
  await page.evaluate(() => {
    const s = (window as unknown as { __speech: { result: (t: string, i?: number) => void }[] })
      .__speech[0];
    s.result("저장소를 확인합니다");
    s.result("저장소를 확인합니다");
  });
  await expect(input).toHaveValue("직접 고친 내용 저장소를 확인합니다");
  await page.getByRole("button", { name: "음성 입력 마치기" }).click();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "음성으로 입력", exact: true }).click();
  await page.evaluate(() =>
    (window as unknown as { __speech: { onerror: (e: unknown) => void }[] }).__speech[1].onerror({
      error: "not-allowed",
    }),
  );
  await expect(page.getByText(/마이크 사용이 허용되지 않았어요/)).toBeVisible();
  await expect(input).toHaveValue("직접 고친 내용 저장소를 확인합니다");
  await input.fill("");
  await page.getByRole("button", { name: "음성으로 입력", exact: true }).click();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "예상 남기고 직접 확인" }).click();
  await page.evaluate(() => {
    const s = (window as unknown as { __speech: { result: (t: string) => void }[] }).__speech[2];
    s.result("떠난 후 도착한 인식 결과");
  });
  expect(
    await page.evaluate(
      () => (window as unknown as { __speech: { aborted: boolean }[] }).__speech[2].aborted,
    ),
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "입문 미션 단계" })
    .getByRole("button")
    .first()
    .click();
  await expect(input).toHaveValue("");
  await expect(page.getByRole("button", { name: "음성으로 입력", exact: true })).toHaveCount(0);
});

test("unsupported voice keeps typing available; code understanding also accepts an empty reason", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto("/problems/handoff-cart");
  await expect(page.getByRole("button", { name: "음성으로 입력", exact: true })).toBeDisabled();
  await expect(page.getByLabel("왜 그렇게 생각했나요?")).toBeEditable();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "예측을 남기고 원본 실행" }).click();
  await expect(page.locator(".lab-comparison")).toContainText("[3,3]");
});

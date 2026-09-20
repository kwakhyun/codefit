import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { fixtureCheck, fixtureAssessment } from "../src/lib/project-check/fixtures";
import { publicCheck } from "../src/lib/server/project-check-store";
import type { CheckOverview } from "../src/lib/project-check/types";

const overview = (): CheckOverview => ({
  scope: "user:assistance-test",
  signedIn: true,
  aiReady: true,
  usage: {
    analysis: { limit: 2, remaining: 2, resetsAt: null },
    review: { limit: 4, remaining: 4, resetsAt: null },
  },
  checks: [],
  nextCursor: null,
});
async function enterProject(page: Page) {
  await page.getByLabel("서비스 링크", { exact: true }).fill("https://example.com/");
  await page.getByLabel("서비스와 구현 방식 설명").fill("직접 만든 예약 서비스입니다.");
  await page.getByRole("checkbox").check();
}

test("analysis drafts survive reload and retry the same request, with fresh consent and account isolation", async ({
  page,
}) => {
  let data = overview();
  const ids: string[] = [];
  await page.route("**/api/project-check", (route) => {
    if (route.request().method() === "POST") {
      ids.push(route.request().postDataJSON().requestId);
      return route.fulfill({ status: 502, json: { error: "테스트용 연결 오류" } });
    }
    return route.fulfill({ json: data });
  });
  await page.goto("/project-check");
  await enterProject(page);
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByRole("button", { name: "저장된 분석 결과 확인" })).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("서비스 링크", { exact: true })).toHaveValue("https://example.com/");
  await expect(page.getByLabel("서비스와 구현 방식 설명")).toHaveValue(
    "직접 만든 예약 서비스입니다.",
  );
  await expect(page.getByRole("checkbox")).not.toBeChecked();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect.poll(() => ids.length).toBe(2);
  expect(ids[1]).toBe(ids[0]);
  await expect(page.getByRole("button", { name: "저장된 분석 결과 확인" })).toBeVisible();
  await page.getByLabel("서비스와 구현 방식 설명").fill("새롭게 설명한 서비스입니다.");
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect.poll(() => ids.length).toBe(3);
  expect(ids[2]).not.toBe(ids[1]);
  data = { ...overview(), scope: "user:other-assistance-test" };
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByLabel("서비스와 구현 방식 설명")).toHaveValue("");
  await expect(page.getByLabel("서비스 링크", { exact: true })).toHaveValue("");
  await expect(page.getByRole("button", { name: "저장된 분석 결과 확인" })).toHaveCount(0);
});

test("lost analysis responses can be recovered without another AI request even at zero quota", async ({
  page,
}) => {
  let data = overview();
  let id = "";
  let posts = 0;
  await page.route("**/api/project-check", (route) => {
    if (route.request().method() === "POST") {
      posts++;
      id = route.request().postDataJSON().requestId;
      data = {
        ...data,
        aiReady: false,
        usage: { ...data.usage, analysis: { limit: 2, remaining: 0, resetsAt: null } },
      };
      return route.fulfill({ status: 502, json: { error: "응답이 끊겼습니다." } });
    }
    return route.fulfill({ json: data });
  });
  await page.route(/\/api\/project-check\/[^/?]+$/, (route) => {
    expect(route.request().method()).toBe("GET");
    expect(route.request().headers()["x-codefit-workspace"]).toBe(data.scope);
    expect(route.request().url()).toContain(id);
    return route.fulfill({ json: { ...publicCheck(fixtureCheck), id } });
  });
  await page.goto("/project-check");
  await enterProject(page);
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByRole("button", { name: "내 프로젝트 질문 받기" })).toBeDisabled();
  await page.reload();
  await page.getByRole("button", { name: "저장된 분석 결과 확인" }).click();
  await expect(page.getByRole("heading", { name: "예약 서비스 설계 점검" })).toBeVisible();
  expect(posts).toBe(1);
  expect(
    await page.evaluate(() => sessionStorage.getItem("codefit-project-input:user:assistance-test")),
  ).toBeNull();
});

test("successful AI output is not shown as failure when refreshing usage fails", async ({
  page,
}) => {
  let created = false;
  await page.route("**/api/project-check", (route) => {
    if (route.request().method() === "POST") {
      created = true;
      return route.fulfill({
        json: { ...publicCheck(fixtureCheck), id: route.request().postDataJSON().requestId },
      });
    }
    return created
      ? route.fulfill({ status: 503, json: { error: "이용 횟수 조회 실패" } })
      : route.fulfill({ json: overview() });
  });
  await page.goto("/project-check");
  await enterProject(page);
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByRole("heading", { name: "예약 서비스 설계 점검" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "결과는 저장됐지만" })).toBeVisible();
  await expect(page.locator("main [role=alert]")).toHaveCount(0);
});

test("review recovery keeps submitted answers and the current question without another paid request", async ({
  page,
}) => {
  const check = publicCheck(fixtureCheck);
  let data = { ...overview(), checks: [check] };
  let answers: string[] = [];
  let calls = 0;
  await page.route("**/api/project-check", (route) => {
    if (route.request().method() === "PATCH") {
      calls++;
      answers = route.request().postDataJSON().answers;
      data = {
        ...data,
        aiReady: false,
        usage: { ...data.usage, review: { limit: 4, remaining: 0, resetsAt: null } },
      };
      return route.fulfill({ status: 502, json: { error: "평가 응답이 끊겼습니다." } });
    }
    return route.fulfill({ json: data });
  });
  await page.route(`**/api/project-check/${check.id}`, (route) =>
    route.fulfill({ json: { ...check, review: { answers, assessment: fixtureAssessment } } }),
  );
  await page.goto(`/project-check?check=${check.id}`);
  await page.getByLabel("내 설계 설명").fill("계정에 따라 서버에서 접근 권한을 확인합니다.");
  await page.getByRole("button", { name: "5. 설계 선택" }).click();
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
  await expect(page.getByRole("button", { name: "저장된 평가 결과 확인" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "5. 설계 선택" })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page.getByLabel("내 설계 설명")).toHaveAttribute("readonly", "");
  await expect(page.getByRole("button", { name: "같은 답변으로 다시 요청" })).toBeDisabled();
  await page.getByRole("button", { name: "저장된 평가 결과 확인" }).click();
  await expect(page.getByRole("heading", { name: "설계 설명 점수 50 / 100" })).toBeVisible();
  expect(calls).toBe(1);
  expect(answers[0]).toBe("계정에 따라 서버에서 접근 권한을 확인합니다.");
});

test("voice appends to typed descriptions and stops at question boundaries and submission", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __speech: FakeSpeech[]; SpeechRecognition: typeof FakeSpeech };
    class FakeSpeech {
      onresult?: (event: unknown) => void;
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
      result(text: string, index = 0) {
        this.onresult?.({
          resultIndex: index,
          results: { length: index + 1, [index]: { isFinal: true, 0: { transcript: text } } },
        });
      }
    }
    w.__speech = [];
    w.SpeechRecognition = FakeSpeech;
  });
  const emit = (n: number, text: string, index = 0) =>
    page.evaluate(
      ({ n, text, index }) => {
        (
          window as unknown as { __speech: { result: (text: string, index: number) => void }[] }
        ).__speech[n].result(text, index);
      },
      { n, text, index },
    );
  let data = overview();
  await page.route("**/api/project-check", (route) => {
    if (route.request().method() === "POST") {
      const check = { ...publicCheck(fixtureCheck), id: route.request().postDataJSON().requestId };
      data = { ...data, checks: [check] };
      return route.fulfill({ json: check });
    }
    if (route.request().method() === "PATCH")
      return route.fulfill({ status: 502, json: { error: "연결 오류" } });
    return route.fulfill({ json: data });
  });
  await page.goto("/project-check");
  await enterProject(page);
  await page.getByRole("button", { name: "음성으로 입력", exact: true }).click();
  await emit(0, "중복 예약을 막습니다.");
  await expect(page.getByLabel("서비스와 구현 방식 설명")).toHaveValue(
    "직접 만든 예약 서비스입니다. 중복 예약을 막습니다.",
  );
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByLabel("내 설계 설명")).toBeVisible();
  await emit(0, "이전 설명의 늦은 결과");
  await page.getByLabel("내 설계 설명").fill("직접 쓴 설명");
  await page.getByRole("button", { name: "음성으로 입력", exact: true }).click();
  await page.evaluate(() => {
    const speech = (
      window as unknown as { __speech: { result: (text: string, index: number) => void }[] }
    ).__speech[1];
    speech.result("첫 문장", 0);
    speech.result("둘째 문장", 1);
  });
  await expect(page.getByLabel("내 설계 설명")).toHaveValue("직접 쓴 설명 첫 문장 둘째 문장");
  await page.getByRole("button", { name: "다음 질문 →" }).click();
  await emit(1, "다른 질문에 들어가면 안 됨", 2);
  await expect(page.getByLabel("내 설계 설명")).toHaveValue("");
  expect(
    await page.evaluate(
      () => (window as unknown as { __speech: { aborted: boolean }[] }).__speech[1].aborted,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "5. 설계 선택" }).click();
  await page.getByRole("button", { name: "음성으로 입력", exact: true }).click();
  await page.getByRole("button", { name: "이 답변으로 이해도 확인" }).click();
  await emit(2, "제출 후 늦은 결과");
  await expect(page.getByLabel("내 설계 설명")).toHaveValue("");
  await expect(page.getByRole("button", { name: "음성으로 입력", exact: true })).toHaveCount(0);
});

test("waiting feedback, unavailable speech, mobile layout and storage failures remain usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", { value: undefined, configurable: true });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Storage.prototype.setItem = () => {
      throw new DOMException("Storage unavailable", "QuotaExceededError");
    };
  });
  await page.clock.install();
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/project-check", async (route) => {
    if (route.request().method() === "POST") {
      await pending;
      return route.fulfill({ status: 502, json: { error: "연결 오류" } });
    }
    return route.fulfill({ json: overview() });
  });
  await page.goto("/project-check");
  await enterProject(page);
  await expect(page.getByRole("button", { name: "음성으로 입력", exact: true })).toBeDisabled();
  await expect(
    page.getByText("브라우저에 초안을 보관하지 못했습니다.", { exact: false }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .include(".project-form")
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "내 프로젝트 질문 받기" }).click();
  await expect(page.getByRole("complementary", { name: "AI 요청 상태" })).toContainText(
    "응답을 기다리고 있습니다",
  );
  await page.clock.fastForward(31_000);
  await expect(page.getByRole("complementary", { name: "AI 요청 상태" })).toContainText(
    "응답이 늦어지고 있습니다",
  );
  release();
  await expect(page.getByRole("button", { name: "저장된 분석 결과 확인" })).toBeVisible();
  await expect(page.getByLabel("서비스와 구현 방식 설명")).toHaveValue(
    "직접 만든 예약 서비스입니다.",
  );
});

test("metadata-backed analysis keeps the rendering limit visible after opening saved results", async ({
  page,
}) => {
  const check = publicCheck({
    ...fixtureCheck,
    page: { ...fixtureCheck.page, limited: true, source: "metadata" },
  });
  await page.route("**/api/project-check", (route) =>
    route.fulfill({ json: { ...overview(), checks: [check] } }),
  );
  await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
  await page.goto(`/project-check?check=${check.id}`);
  await expect(page.locator(".project-summary .project-help")).toContainText(
    "사이트에 등록된 공개 소개 정보를 참고했습니다",
  );
  await expect(page.locator(".project-summary .project-help")).toContainText(
    "자바스크립트 실행 후 나타나는 화면은 확인하지 않았습니다",
  );
  await expect(page.locator(".project-summary .project-help")).not.toContainText(
    "작성한 설명을 주로 참고했습니다",
  );
});

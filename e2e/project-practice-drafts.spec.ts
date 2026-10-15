import { expect, test, type Page } from "@playwright/test";
import { fixtureCheck } from "../src/lib/project-check/fixtures";
import { sourceLine } from "../src/lib/project-check/repository";
import type {
  GeneratedPractice,
  PracticeMode,
  ProjectExercise,
} from "../src/lib/project-check/generated-practice";

async function practiceFixture(page: Page, progress: GeneratedPractice["progress"]) {
  const file = {
    path: "src/reservations.ts",
    totalLines: 2,
    partial: false,
    lines: [
      { number: 1, text: "if (existing) return existing;" },
      { number: 2, text: "return createReservation();" },
    ],
  };
  const task: ProjectExercise = {
    title: "예약 처리 흐름",
    purpose: "같은 요청을 다시 보냈을 때의 처리 흐름을 비교합니다.",
    situation: "예약 응답이 늦어 같은 요청을 다시 보냈습니다.",
    assumptions: "existing에 기존 예약이 있습니다.",
    evidence: [sourceLine(file.path, 1, file.lines[0].text)],
    question: "두 번째 요청은 어떤 결과를 돌려줄까요?",
    choices: ["기존 예약을 돌려줍니다.", "예약을 하나 더 만듭니다."],
    answer: 0,
    walkthrough: [
      { action: "기존 예약 여부를 확인합니다.", result: "기존 예약이 있습니다." },
      { action: "반환문을 따라갑니다.", result: "기존 예약을 돌려줍니다." },
    ],
    explanation: "기존 예약을 반환하는 분기에서 처리를 마칩니다.",
    verification: "테스트 환경에서 같은 요청을 두 번 보내 예약 개수를 비교하세요.",
  };
  const check = {
    ...fixtureCheck,
    page: {
      ...fixtureCheck.page,
      source: "repository" as const,
      repository: {
        name: "example/reservations",
        commit: "a".repeat(40),
        totalFiles: 1,
        eligibleFiles: 1,
        omittedFiles: 0,
        truncatedTree: false,
        links: [],
        files: [file],
      },
    },
  };
  const saved: GeneratedPractice = {
    exercises: {
      code: Array.from({ length: 3 }, (_, i) => ({ ...task, title: `코드 상황 ${i + 1}` })),
      service: Array.from({ length: 3 }, (_, i) => ({ ...task, title: `서비스 상황 ${i + 1}` })),
    },
    progress,
    revision: 0,
    createdAt: check.createdAt,
  };
  let patchCount = 0;
  let pending: Promise<void> | undefined;
  await page.route("**/api/project-check", (route) =>
    route.fulfill({
      json: {
        scope: "visitor:practice-drafts",
        signedIn: false,
        aiReady: true,
        checks: [check],
        nextCursor: null,
        usage: {
          analysis: { limit: 3, remaining: 2, resetsAt: null },
          review: { limit: 2, remaining: 2, resetsAt: null },
        },
      },
    }),
  );
  await page.route(`**/api/project-check/${check.id}`, (route) => route.fulfill({ json: check }));
  await page.route(`**/api/project-check/${check.id}/practice**`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON();
      expect(body.revision).toBe(saved.revision);
      patchCount++;
      if (pending) {
        const wait = pending;
        pending = undefined;
        await wait;
      }
      saved.progress[body.mode as PracticeMode] = body.progress;
      saved.revision++;
      return route.fulfill({ json: saved });
    }
    expect(route.request().method()).toBe("GET");
    return route.fulfill({
      json: new URL(route.request().url()).searchParams.has("stepwise")
        ? { result: saved, completed: 2, canRecover: false }
        : saved,
    });
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/project-practice?check=${check.id}&mode=code`);
  return {
    saved,
    patches: () => patchCount,
    holdNextSave: () => {
      let release!: () => void;
      pending = new Promise<void>((resolve) => {
        release = resolve;
      });
      return release;
    },
  };
}

function completedResponse(note = "앞서 저장한 설명") {
  return { choice: 0, note, predictionReason: "반환 조건을 살펴봤습니다.", completed: true };
}

test("unsaved predictions remain separate across tracks, reloads and question changes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = await practiceFixture(page, { code: [completedResponse()], service: [] });
  const tracks = page.getByRole("navigation", { name: "프로젝트 연습 종류" });
  const questions = page.getByRole("navigation", { name: "실습 단계", exact: true });
  const reason = page.getByRole("textbox", { name: "왜 그렇게 생각했나요?" });
  await expect(page.getByRole("heading", { name: "코드 상황 2", exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "예약을 하나 더 만듭니다.", exact: true }).check();
  await reason.fill("코드 조건을 아직 비교하는 중입니다.");
  await tracks.getByRole("link", { name: "서비스 동작 실습", exact: true }).click();
  await page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }).check();
  await reason.fill("서비스에서 예약 수가 어떻게 바뀔지 예상했습니다.");
  await page.reload();
  await expect(reason).toHaveValue("서비스에서 예약 수가 어떻게 바뀔지 예상했습니다.");
  await expect(
    page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }),
  ).toBeChecked();
  await tracks.getByRole("link", { name: "코드 이해 훈련", exact: true }).click();
  await expect(reason).toHaveValue("코드 조건을 아직 비교하는 중입니다.");
  await expect(
    page.getByRole("radio", { name: "예약을 하나 더 만듭니다.", exact: true }),
  ).toBeChecked();
  await questions.getByRole("button", { name: "1. 코드 상황 1", exact: true }).click();
  await questions.getByRole("button", { name: "2. 코드 상황 2", exact: true }).click();
  await expect(reason).toHaveValue("코드 조건을 아직 비교하는 중입니다.");
  await page.reload();
  await expect(page.getByRole("heading", { name: "코드 상황 2", exact: true })).toBeVisible();
  await expect(reason).toHaveValue("코드 조건을 아직 비교하는 중입니다.");
  await expect(
    page.getByRole("radio", { name: "예약을 하나 더 만듭니다.", exact: true }),
  ).toBeChecked();
  expect(fixture.patches()).toBe(0);
});

test("unsaved explanations restore their question and learning stage", async ({ page }) => {
  const fixture = await practiceFixture(page, {
    code: [completedResponse(), { ...completedResponse(""), completed: false }],
    service: [],
  });
  const tracks = page.getByRole("navigation", { name: "프로젝트 연습 종류" });
  const questions = page.getByRole("navigation", { name: "실습 단계", exact: true });
  const note = page.getByRole("textbox", { name: /내 설명 또는 실제 확인 기록/ });
  await page.getByRole("button", { name: "내 말로 설명하기", exact: true }).click();
  await note.fill("두 번째 상황의 아직 저장하지 않은 확인 계획");
  await tracks.getByRole("link", { name: "서비스 동작 실습", exact: true }).click();
  await tracks.getByRole("link", { name: "코드 이해 훈련", exact: true }).click();
  await expect(note).toHaveValue("두 번째 상황의 아직 저장하지 않은 확인 계획");
  await page.reload();
  await expect(page.getByRole("heading", { name: "3. 설명하기", exact: true })).toBeVisible();
  await expect(note).toHaveValue("두 번째 상황의 아직 저장하지 않은 확인 계획");
  await questions.getByRole("button", { name: "1. 코드 상황 1", exact: true }).click();
  await page.getByRole("button", { name: "내 말로 설명하기", exact: true }).click();
  await note.fill("첫 번째 상황의 추가 메모");
  await questions.getByRole("button", { name: "2. 코드 상황 2", exact: true }).click();
  await expect(note).toHaveValue("두 번째 상황의 아직 저장하지 않은 확인 계획");
  await questions.getByRole("button", { name: "1. 코드 상황 1", exact: true }).click();
  await expect(note).toHaveValue("첫 번째 상황의 추가 메모");
  expect(fixture.saved.progress.code[0].note).toBe("앞서 저장한 설명");
  expect(fixture.saved.progress.code[1].note).toBe("");
  expect(fixture.patches()).toBe(0);
});

test("saving locks the note and completing all questions opens the next track", async ({
  page,
}) => {
  const fixture = await practiceFixture(page, { code: [], service: [] });
  const note = page.getByRole("textbox", { name: /내 설명 또는 실제 확인 기록/ });
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByRole("heading", { name: `코드 상황 ${i + 1}`, exact: true }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }).check();
    await page.getByRole("button", { name: "예상 저장하고 코드 흐름 비교", exact: true }).click();
    await page.getByRole("button", { name: "내 말로 설명하기", exact: true }).click();
    await note.fill(`${i + 1}번째 상황을 테스트 환경에서 확인할 계획입니다.`);
    if (i === 0) {
      const release = fixture.holdNextSave();
      await page.getByRole("button", { name: "기록 저장", exact: true }).click();
      await expect(note).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "이해했어요, 다음 상황으로", exact: true }),
      ).toBeDisabled();
      release();
      await expect(note).toBeEnabled();
      await expect
        .poll(() => fixture.saved.progress.code[0].note)
        .toBe("1번째 상황을 테스트 환경에서 확인할 계획입니다.");
    }
    await page
      .getByRole("button", {
        name: i < 2 ? "이해했어요, 다음 상황으로" : "연습 마치기",
        exact: true,
      })
      .click();
  }
  const completionHeading = page.getByRole("heading", {
    name: "내 프로젝트의 세 가지 상황을 살펴봤어요",
    exact: true,
  });
  await expect(completionHeading).toBeFocused();
  await expect(completionHeading).toBeInViewport();
  await expect(page.getByRole("progressbar", { name: "프로젝트 연습 진행률" })).toHaveAttribute(
    "value",
    "3",
  );
  expect(fixture.saved.progress.code.every((response) => response.completed)).toBe(true);
  expect(fixture.patches()).toBe(7);
  await page.reload();
  await expect(completionHeading).toBeVisible();
  await expect(completionHeading).not.toBeFocused();
  await page.getByRole("link", { name: /서비스 동작 실습 이어하기/ }).click();
  await expect(page).toHaveURL(/mode=service/);
  await expect(page.getByRole("heading", { name: "서비스 상황 1", exact: true })).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }),
  ).not.toBeChecked();
  await expect(page.getByRole("progressbar", { name: "프로젝트 연습 진행률" })).toHaveAttribute(
    "value",
    "0",
  );
});

test("a delayed save after switching tracks is recognized as the same draft", async ({ page }) => {
  const fixture = await practiceFixture(page, { code: [], service: [] });
  const tracks = page.getByRole("navigation", { name: "프로젝트 연습 종류" });
  await page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }).check();
  await page
    .getByRole("textbox", { name: "왜 그렇게 생각했나요?" })
    .fill("다른 실습도 보면서 답변을 저장합니다.");
  const release = fixture.holdNextSave();
  await page.getByRole("button", { name: "예상 저장하고 코드 흐름 비교", exact: true }).click();
  await expect.poll(fixture.patches).toBe(1);
  await tracks.getByRole("link", { name: "서비스 동작 실습", exact: true }).click();
  await expect(page.getByRole("heading", { name: "서비스 상황 1", exact: true })).toBeVisible();
  await tracks.getByRole("link", { name: "코드 이해 훈련", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "왜 그렇게 생각했나요?" })).toHaveValue(
    "다른 실습도 보면서 답변을 저장합니다.",
  );
  release();
  await expect(page.getByRole("heading", { name: "2. 비교하기", exact: true })).toBeVisible();
  await expect(
    page.getByText("내가 적은 이유: 다른 실습도 보면서 답변을 저장합니다.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "내 초안 불러오기", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "저장된 기록 유지", exact: true })).toHaveCount(0);
  expect(fixture.saved.progress.code[0].predictionReason).toBe(
    "다른 실습도 보면서 답변을 저장합니다.",
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "2. 비교하기", exact: true })).toBeVisible();
  expect(fixture.patches()).toBe(1);
});

test("unavailable browser storage keeps the answer visible and permits server saving", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("codefit-practice:")) throw new DOMException("Full", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const fixture = await practiceFixture(page, { code: [], service: [] });
  await page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }).check();
  const reason = page.getByRole("textbox", { name: "왜 그렇게 생각했나요?" });
  await reason.fill("초안 저장에 실패해도 서버로 보낼 설명");
  await expect(
    page.getByText(
      "이 브라우저에 초안을 보관하지 못했습니다. 화면을 떠나기 전에 예상이나 기록을 저장해 주세요.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(reason).toHaveValue("초안 저장에 실패해도 서버로 보낼 설명");
  await expect(
    page.getByRole("radio", { name: "기존 예약을 돌려줍니다.", exact: true }),
  ).toBeChecked();
  await page.getByRole("button", { name: "예상 저장하고 코드 흐름 비교", exact: true }).click();
  await expect(page.getByRole("heading", { name: "2. 비교하기", exact: true })).toBeVisible();
  await expect(
    page.getByText("내가 적은 이유: 초안 저장에 실패해도 서버로 보낼 설명", { exact: true }),
  ).toBeVisible();
  expect(fixture.saved.progress.code[0].predictionReason).toBe(
    "초안 저장에 실패해도 서버로 보낼 설명",
  );
  expect(fixture.patches()).toBe(1);
});

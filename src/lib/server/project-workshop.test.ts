import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("./ai-project-check", () => ({
  analyzeProject: vi.fn(),
  assessProject: vi.fn(),
  discussProjectCode: vi.fn(),
  generateProjectWorkshop: vi.fn(),
}));
import { generateProjectWorkshop } from "./ai-project-check";
import { SqliteStore } from "./sqlite-store";
import { ProjectCheckService } from "./project-check-service";
import { fixtureCheck } from "../project-check/fixtures";
import {
  validWorkshop,
  workshopPlanSchema,
  type WorkshopPlan,
} from "../ai-learning/project-workshop";
const id = randomUUID(),
  owner = "user:practice",
  commit = "a".repeat(40);
const repository = {
  name: "owner/repo",
  commit,
  files: [
    {
      path: "main.py",
      totalLines: 2,
      partial: false,
      lines: [
        { number: 1, text: "if not user: return 401" },
        { number: 2, text: "return 200" },
      ],
    },
  ],
  links: [],
  eligibleFiles: 1,
  totalFiles: 1,
  truncatedTree: false,
  omittedFiles: 0,
};
const plan: WorkshopPlan = {
  summary: "로그인 결과를 다루는 프로젝트입니다.",
  limitations: "두 줄의 코드만 확인했습니다.",
  topics: [
    {
      kind: "proposed",
      title: "AI 출력 검증 설계",
      tool: "출력 검증",
      purpose: "AI 결과를 인증 분기와 분리해서 다룹니다.",
      evidence: ["main.py:L1 if not user: return 401"],
      explanation: "이 코드는 AI 사용 근거가 아니며 새 설계의 기준입니다.",
      steps: [
        { action: "테스트 입력 정리", expected: "인증 성공과 실패 구분" },
        { action: "가짜 모델 결과 대입", expected: "인증 판단을 대체하지 않음" },
      ],
      tradeoff: "일반 조건문이 더 단순할 수 있습니다.",
      verification: "인증되지 않은 요청이 계속 거절되는지 확인",
      lessonIds: ["output-validation"],
      question: "인증 판단을 AI에 맡겨도 되나요?",
      choices: ["기존 인증을 유지한다", "AI 판단만 사용한다"],
      answer: 0,
      feedback: "AI는 인증 경계를 대체하지 않습니다.",
    },
  ],
};
let store: SqliteStore;
beforeEach(async () => {
  store = new SqliteStore(":memory:");
  const claim = await store.startJob(owner, id, "project-analysis", "source");
  if (claim.state !== "new") throw Error("lease");
  await store.queries.projectChecks.complete(claim.lease, {
    ...fixtureCheck,
    id,
    page: {
      ...fixtureCheck.page,
      url: "https://github.com/owner/repo",
      source: "repository",
      text: "main.py:L1 if not user: return 401\nmain.py:L2 return 200",
      repository,
    },
    analysis: {
      ...fixtureCheck.analysis,
      questions: fixtureCheck.analysis.questions.map((q) => ({
        ...q,
        evidence: "main.py:L1 if not user: return 401",
      })),
    },
  });
  vi.mocked(generateProjectWorkshop).mockReset().mockResolvedValue(plan);
});
afterEach(() => store.db.close());
const generate = () =>
  new ProjectCheckService(store).generateWorkshop(owner, "net", id, AbortSignal.timeout(5000));

it("generates a reusable plan without claiming AI exists and preserves quota", async () => {
  const saved = await generate();
  expect(saved.plan.topics[0].kind).toBe("proposed");
  expect(await generate()).toEqual(saved);
  expect(generateProjectWorkshop).toHaveBeenCalledTimes(1);
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(4);
  expect(await store.queries.projectChecks.workshop("user:other", id)).toBeNull();
  await expect(
    new ProjectCheckService(store).generateWorkshop(
      "user:other",
      "net",
      id,
      AbortSignal.timeout(1000),
    ),
  ).rejects.toMatchObject({ status: 404 });
});
it("validates learning references, options and code evidence", () => {
  expect(validWorkshop(plan, repository)).toBe(true);
  for (const patch of [{ answer: 3 }, { evidence: ["main.py:L99 fake"] }])
    expect(validWorkshop({ ...plan, topics: [{ ...plan.topics[0], ...patch }] }, repository)).toBe(
      false,
    );
  expect(validWorkshop({ ...plan, topics: [] }, repository)).toBe(true);
  expect(
    workshopPlanSchema.safeParse({
      ...plan,
      topics: [{ ...plan.topics[0], lessonIds: ["invented"] }],
    }).success,
  ).toBe(false);
});
it("persists answers with revision protection and restores them through backup", async () => {
  await generate();
  const input = {
    index: 0,
    revision: 0,
    response: { choice: 0, note: "테스트 환경에서 확인 예정" },
  };
  const saved = await store.queries.projectChecks.saveWorkshop(owner, id, input);
  expect(saved.revision).toBe(1);
  expect(await store.queries.projectChecks.saveWorkshop(owner, id, input)).toEqual(saved);
  await expect(
    store.queries.projectChecks.saveWorkshop(owner, id, {
      ...input,
      response: { choice: 1, note: "stale" },
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    store.queries.projectChecks.saveWorkshop(owner, id, { ...input, revision: 1, index: 5 }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    store.queries.projectChecks.saveWorkshop("user:other", id, input),
  ).rejects.toMatchObject({ status: 404 });
  const backup = store.exportBackup(owner);
  store.importBackup("user:restored", backup);
  const restored = (await store.queries.projectChecks.list("user:restored"))[0];
  expect(
    (await store.queries.projectChecks.workshop("user:restored", restored.id))?.responses[0]?.note,
  ).toBe(input.response.note);
  await store.queries.projectChecks.remove(owner, id);
  expect(await store.queries.projectChecks.workshop(owner, id)).toBeNull();
});
it("refunds failed preparation and guards deletion during generation", async () => {
  vi.mocked(generateProjectWorkshop).mockRejectedValueOnce(new Error("timeout"));
  await expect(generate()).rejects.toThrow("timeout");
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(5);
  vi.mocked(generateProjectWorkshop).mockImplementation(async () => {
    await store.queries.projectChecks.remove(owner, id);
    return plan;
  });
  await expect(generate()).rejects.toThrow();
  expect(await store.queries.projectChecks.workshop(owner, id)).toBeNull();
});

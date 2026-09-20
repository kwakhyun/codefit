import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
vi.mock("./ai-project-check", () => ({
  analyzeProject: vi.fn(),
  assessProject: vi.fn(),
  discussProjectCode: vi.fn(),
  generateProjectExercises: vi.fn(),
}));
import { generateProjectExercises } from "./ai-project-check";
import { SqliteStore } from "./sqlite-store";
import { ProjectCheckService } from "./project-check-service";
import { fixtureCheck } from "../project-check/fixtures";
import { validProjectExercises, type ProjectExercises } from "../project-check/generated-practice";
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
const task = {
  title: "사용자가 없는 요청 확인",
  purpose: "인증 분기가 요청을 어디서 멈추는지 읽습니다.",
  situation: "user가 없는 요청입니다.",
  assumptions: "이 함수의 user는 None입니다.",
  evidence: ["main.py:L1 if not user: return 401"],
  question: "어떤 상태를 반환하나요?",
  choices: ["401", "200"],
  answer: 0,
  walkthrough: [
    { action: "user 확인", result: "not user는 참" },
    { action: "분기 반환", result: "401 반환" },
  ],
  explanation: "첫 번째 분기에서 종료합니다.",
  verification: "로컬에서 user=None으로 호출하고 반환 상태를 확인하세요.",
};
const exercises: ProjectExercises = {
  code: Array.from({ length: 3 }, () => ({ ...task })),
  service: Array.from({ length: 3 }, () => ({ ...task })),
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
  vi.mocked(generateProjectExercises).mockReset().mockResolvedValue(exercises);
});
afterEach(() => store.db.close());
const generate = () =>
  new ProjectCheckService(store).generatePractice(owner, "net", id, AbortSignal.timeout(5000));
it("generates both tracks once, replays without quota and requires owner/source", async () => {
  const saved = await generate();
  expect(saved.exercises.code).toHaveLength(3);
  expect(saved.exercises.service).toHaveLength(3);
  expect(await generate()).toEqual(saved);
  expect(generateProjectExercises).toHaveBeenCalledTimes(1);
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(4);
  expect((await store.queries.projectChecks.usage(owner)).review.remaining).toBe(12);
  await expect(
    new ProjectCheckService(store).generatePractice(
      "user:other",
      "net",
      id,
      AbortSignal.timeout(1000),
    ),
  ).rejects.toMatchObject({ status: 404 });
  expect(await store.queries.projectChecks.generatedPractice("user:other", id)).toBeNull();
});
it("persists progress and notes, rejects invalid sequence/options and stale updates", async () => {
  await generate();
  const progress = [{ choice: 0, note: "확인 예정", completed: false }];
  const saved = await store.queries.projectChecks.saveGeneratedPractice(owner, id, {
    mode: "code",
    revision: 0,
    progress,
  });
  expect(saved.revision).toBe(1);
  expect(
    await store.queries.projectChecks.saveGeneratedPractice(owner, id, {
      mode: "code",
      revision: 0,
      progress,
    }),
  ).toEqual(saved);
  await expect(
    store.queries.projectChecks.saveGeneratedPractice(owner, id, {
      mode: "code",
      revision: 1,
      progress: [...progress, ...progress],
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    store.queries.projectChecks.saveGeneratedPractice(owner, id, {
      mode: "code",
      revision: 1,
      progress: [{ ...progress[0], choice: 3 }],
    }),
  ).rejects.toMatchObject({ status: 400 });
  await expect(
    store.queries.projectChecks.saveGeneratedPractice(owner, id, {
      mode: "service",
      revision: 0,
      progress,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(
    (await store.queries.projectChecks.generatedPractice(owner, id))?.progress.code[0].note,
  ).toBe("확인 예정");
});
it("exports/imports grounded exercises with progress and removes them with their parent", async () => {
  await generate();
  await store.queries.projectChecks.saveGeneratedPractice(owner, id, {
    mode: "service",
    revision: 0,
    progress: [{ choice: 1, note: "실패 상황도 확인해야 한다", completed: true }],
  });
  const backup = store.exportBackup(owner);
  store.importBackup("user:restored", backup);
  const restored = (await store.queries.projectChecks.list("user:restored"))[0];
  expect(
    (await store.queries.projectChecks.generatedPractice("user:restored", restored.id))?.progress
      .service[0].completed,
  ).toBe(true);
  await store.queries.projectChecks.remove(owner, id);
  expect(await store.queries.projectChecks.generatedPractice(owner, id)).toBeNull();
});
it("does not resurrect exercises after the owner deletes the project mid-generation", async () => {
  vi.mocked(generateProjectExercises).mockImplementation(async () => {
    await store.queries.projectChecks.remove(owner, id);
    return exercises;
  });
  await expect(generate()).rejects.toThrow();
  expect(await store.queries.projectChecks.generatedPractice(owner, id)).toBeNull();
});
it("rejects fabricated citations and answers outside the provided options", () => {
  expect(validProjectExercises(exercises, repository)).toBe(true);
  expect(
    validProjectExercises(
      { ...exercises, code: [{ ...task, evidence: ["main.py:L99 return 200"] }] },
      repository,
    ),
  ).toBe(false);
  expect(validProjectExercises({ ...exercises, code: [{ ...task, answer: 3 }] }, repository)).toBe(
    false,
  );
});
it("does not double-generate parallel requests", async () => {
  let finish!: (value: ProjectExercises) => void;
  vi.mocked(generateProjectExercises).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const pending = generate();
  await vi.waitFor(() => expect(finish).toBeDefined());
  await expect(generate()).rejects.toMatchObject({ status: 409 });
  finish(exercises);
  await pending;
  expect(generateProjectExercises).toHaveBeenCalledTimes(1);
});
it("restores the personal analysis credit after provider failure and can retry the same project", async () => {
  vi.mocked(generateProjectExercises).mockRejectedValueOnce(new Error("timeout"));
  await expect(generate()).rejects.toThrow("timeout");
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(5);
  await generate();
  expect((await store.queries.projectChecks.usage(owner)).analysis.remaining).toBe(4);
});

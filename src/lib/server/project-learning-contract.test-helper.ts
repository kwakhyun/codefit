import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { ProblemStore } from "./store-contract";
import type { TrainingInput } from "../project-learning/types";
import { fixtureCheck, fixtureAssessment } from "../project-check/fixtures";
import { missionById } from "../learn/catalog";
import { emptyLearning } from "../learn/progress";
import { verification } from "../learn/simulation";
import { learningModules } from "./project-learning-content";
export async function learningFixture(store: ProblemStore) {
  const owner = `user:${randomUUID()}`,
    id = randomUUID();
  for (const phase of ["analysis", "review"] as const) {
    const claim = await store.startJob(
      owner,
      phase === "analysis" ? id : `project-review-${id}`,
      phase === "analysis" ? "project-analysis" : `project-review:${id}`,
      "fixture",
    );
    if (claim.state !== "new") throw new Error();
    await store.queries.projectChecks.complete(
      claim.lease,
      phase === "analysis"
        ? { ...fixtureCheck, id }
        : { answers: Array(5).fill("설명"), assessment: fixtureAssessment },
    );
  }
  return { owner, id };
}
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
export function projectLearningContract(getStore: () => ProblemStore) {
  it("project learning: concurrent first reads issue one stable curriculum without exposing keys", async () => {
    const store = getStore(),
      { owner, id } = await learningFixture(store);
    const views = await Promise.all(
      Array.from({ length: 3 }, () => store.queries.projectLearning.get(owner, id)),
    );
    expect(new Set(views.map((v) => v.contentId)).size).toBe(1);
    expect(views[0].contentId).toMatch(/^[a-f0-9]{64}$/);
    expect(views.every((v) => v.revision === 0)).toBe(true);
    expect(JSON.stringify(views)).not.toMatch(/"answer":|"explanation":|"curriculum":/);
  });
  it("project learning: orders recommendations by matching area, protects keys and isolates owners", async () => {
    const store = getStore(),
      { owner, id } = await learningFixture(store);
    const plan = await store.queries.projectLearning.get(owner, id);
    expect(plan.modules).toHaveLength(5);
    expect(plan.modules.every((m) => m.phase === "baseline" && m.probes.length === 2)).toBe(true);
    expect(JSON.stringify(plan)).not.toMatch(/"answer":|"explanation":|"correct":/);
    await expect(store.queries.projectLearning.get("user:other", id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("project learning: locks first submissions, requires valid practice, grades server-side and hides early results", async () => {
    const store = getStore(),
      { owner, id } = await learningFixture(store);
    const usageBefore = await store.queries.projectChecks.usage(owner);
    const input: TrainingInput = {
      id,
      moduleId: "storage",
      phase: "baseline",
      revision: 0,
      answers: [0, 0],
      confidence: "certain",
      assisted: false,
    };
    const before = await store.queries.projectLearning.submit(owner, input);
    expect(before.revision).toBe(1);
    const m = before.modules.find((m) => m.id === "storage")!;
    expect(m.phase).toBe("practice");
    expect(m.baseline).not.toHaveProperty("correct");
    expect(await store.queries.projectLearning.submit(owner, input)).toEqual(before);
    await expect(
      store.queries.projectLearning.submit(owner, { ...input, answers: [1, 2] }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      store.queries.projectLearning.submit(owner, { ...input, revision: 1, phase: "transfer" }),
    ).rejects.toMatchObject({ status: 409 });
    await store.queries.learning.save(
      owner,
      "where-data-lives",
      JSON.stringify({ ...emptyLearning(), completed: true }),
      0,
    );
    await expect(
      store.queries.projectLearning.submit(owner, { ...input, revision: 1, phase: "transfer" }),
    ).rejects.toMatchObject({ status: 409 });
    await store.queries.learning.save(
      owner,
      "where-data-lives",
      JSON.stringify(completedPractice("where-data-lives")),
      1,
    );
    const result = await store.queries.projectLearning.submit(owner, {
      ...input,
      revision: 1,
      phase: "transfer",
      answers: [2, 0],
      assisted: true,
    });
    const stored = result.modules.find((m) => m.id === "storage")!.result!;
    expect(stored.baseline.correct).toBe(0);
    expect(stored.transfer.correct).toBe(2);
    expect(stored.transfer.assisted).toBe(true);
    expect(stored.baseline.priorPractice).toBe(false);
    expect(stored.transfer.practiceRevision).toBe(2);
    expect(await store.queries.projectChecks.review(owner, id)).not.toHaveProperty("training");
    expect((await store.queries.projectChecks.list(owner))[0].review).not.toHaveProperty(
      "training",
    );
    expect(await store.queries.projectChecks.usage(owner)).toEqual(usageBefore);
  });
  it("project learning: concurrent writes have one winner, conflicts preserve both modules and deletion removes training", async () => {
    const store = getStore(),
      { owner, id } = await learningFixture(store);
    const input: TrainingInput = {
      id,
      moduleId: "storage",
      phase: "baseline",
      revision: 0,
      answers: [1, 2],
      confidence: "likely",
      assisted: false,
    };
    const results = await Promise.allSettled(
      ["storage", "access", "rules"].map((moduleId) =>
        store.queries.projectLearning.submit(owner, {
          ...input,
          moduleId: moduleId as TrainingInput["moduleId"],
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const state = await store.queries.projectLearning.get(owner, id);
    const untouched = state.modules.find((m) => m.phase === "baseline")!;
    const next = await store.queries.projectLearning.submit(owner, {
      ...input,
      moduleId: untouched.id,
      revision: state.revision,
    });
    expect(next.modules.filter((m) => m.baseline)).toHaveLength(2);
    await store.queries.projectChecks.remove("user:other", id);
    expect((await store.queries.projectLearning.get(owner, id)).revision).toBe(2);
    await store.queries.projectChecks.remove(owner, id);
    await expect(store.queries.projectLearning.get(owner, id)).rejects.toMatchObject({
      status: 404,
    });
    await expect(
      store.queries.projectLearning.submit(owner, { ...input, revision: 2 }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("project learning: records previous practice and all five curricula support a complete path", async () => {
    const store = getStore(),
      { owner, id } = await learningFixture(store);
    let revision = 0;
    for (const m of learningModules) {
      await store.queries.learning.save(
        owner,
        m.missionId,
        JSON.stringify(completedPractice(m.missionId)),
        0,
      );
      for (const phase of ["baseline", "transfer"] as const) {
        const view = await store.queries.projectLearning.submit(owner, {
          id,
          moduleId: m.id,
          phase,
          revision,
          answers: m[phase].map((p) => p.answer) as [number, number],
          confidence: "likely",
          assisted: false,
        });
        revision = view.revision;
        expect(view.modules.find((n) => n.id === m.id)?.baseline?.priorPractice).toBe(true);
      }
    }
    const view = await store.queries.projectLearning.get(owner, id);
    expect(view.revision).toBe(10);
    expect(
      view.modules.every((m) => m.phase === "complete" && m.result?.transfer.correct === 2),
    ).toBe(true);
  });
}

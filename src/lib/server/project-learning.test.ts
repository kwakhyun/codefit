import { afterEach, beforeEach, expect, it } from "vitest";
import { SqliteStore } from "./sqlite-store";
import { projectLearningContract, learningFixture } from "./project-learning-contract.test-helper";
import { learningModules } from "./project-learning-content";
import { trainingInput } from "../project-learning/types";
let store: SqliteStore;
beforeEach(() => {
  store = new SqliteStore(":memory:");
});
afterEach(() => store.db.close());
projectLearningContract(() => store);
it("rejects grade injection and sorts shuffled AI feedback by area, not array index", async () => {
  const { owner, id } = await learningFixture(store);
  const row = store.db
    .prepare("SELECT result FROM jobs WHERE id=?")
    .get(`project-review-${id}`) as { result: string };
  const review = JSON.parse(row.result);
  review.assessment.feedback.reverse();
  review.assessment.feedback.find((f: { questionIndex: number }) => f.questionIndex === 2).level =
    0;
  store.db
    .prepare("UPDATE jobs SET result=? WHERE id=?")
    .run(JSON.stringify(review), `project-review-${id}`);
  const plan = await store.queries.projectLearning.get(owner, id);
  expect(plan.modules[0].id).toBe("access");
  expect(
    trainingInput.safeParse({
      id,
      moduleId: "access",
      phase: "transfer",
      revision: 0,
      answers: [0, 1],
      confidence: "certain",
      assisted: false,
      correct: 2,
    }).success,
  ).toBe(false);
  for (const m of learningModules) {
    expect(m.baseline.map((p) => p.scenario)).not.toEqual(m.transfer.map((p) => p.scenario));
    expect(
      m.baseline.concat(m.transfer).every((p) => p.choices.length === 3 && p.choices[p.answer]),
    ).toBe(true);
  }
});
it("pins viewed questions before submission and preserves scoring after curriculum changes", async () => {
  const { owner, id } = await learningFixture(store);
  const original = structuredClone(learningModules[0]);
  const before = await store.queries.projectLearning.get(owner, id);
  try {
    learningModules[0].baseline[0].scenario = "改訂版の別の問題";
    learningModules[0].baseline[0].answer = (original.baseline[0].answer + 1) % 3;
    const after = await store.queries.projectLearning.get(owner, id);
    expect(after.contentId).toBe(before.contentId);
    expect(after.modules[0].probes).toEqual(before.modules[0].probes);
    await store.queries.projectLearning.submit(owner, {
      id,
      moduleId: "flow",
      phase: "baseline",
      revision: 0,
      answers: original.baseline.map((p) => p.answer) as [number, number],
      confidence: "certain",
      assisted: false,
    });
    const row = store.db
      .prepare("SELECT result FROM jobs WHERE id=?")
      .get(`project-review-${id}`) as { result: string };
    expect(JSON.parse(row.result).training.modules.flow.baseline.correct).toBe(2);
    const other = await learningFixture(store);
    const newer = await store.queries.projectLearning.get(other.owner, other.id);
    expect(newer.contentId).not.toBe(before.contentId);
    expect(newer.modules[0].probes[0].scenario).toBe("改訂版の別の問題");
  } finally {
    learningModules[0] = original;
  }
});
it("rejects damaged snapshots without changing saved answers or silently issuing new questions", async () => {
  const { owner, id } = await learningFixture(store);
  await store.queries.projectLearning.get(owner, id);
  const read = () =>
    String(
      (
        store.db.prepare("SELECT result FROM jobs WHERE id=?").get(`project-review-${id}`) as {
          result: string;
        }
      ).result,
    );
  const review = JSON.parse(read());
  for (const curriculum of [null, { ...review.training.curriculum, contentId: "0".repeat(64) }]) {
    const damaged = JSON.stringify({ ...review, training: { ...review.training, curriculum } });
    store.db.prepare("UPDATE jobs SET result=? WHERE id=?").run(damaged, `project-review-${id}`);
    await expect(store.queries.projectLearning.get(owner, id)).rejects.toMatchObject({
      status: 409,
    });
    expect(read()).toBe(damaged);
  }
});
it("upgrades legacy v1 records only against their original curriculum", async () => {
  const { owner, id } = await learningFixture(store);
  await store.queries.projectLearning.submit(owner, {
    id,
    moduleId: "flow",
    phase: "baseline",
    revision: 0,
    answers: [1, 2],
    confidence: "likely",
    assisted: false,
  });
  const row = store.db
    .prepare("SELECT result FROM jobs WHERE id=?")
    .get(`project-review-${id}`) as { result: string };
  const legacy = JSON.parse(row.result);
  delete legacy.training.curriculum;
  const raw = JSON.stringify(legacy);
  store.db.prepare("UPDATE jobs SET result=? WHERE id=?").run(raw, `project-review-${id}`);
  const original = learningModules[0].title;
  try {
    learningModules[0].title = "changed";
    await expect(store.queries.projectLearning.get(owner, id)).rejects.toMatchObject({
      status: 409,
    });
  } finally {
    learningModules[0].title = original;
  }
  const migrated = await store.queries.projectLearning.get(owner, id);
  expect(migrated.revision).toBe(1);
  expect(migrated.modules[0].baseline?.answers).toEqual([1, 2]);
});

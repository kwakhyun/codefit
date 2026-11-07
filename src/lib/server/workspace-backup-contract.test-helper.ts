import { expect, it } from "vitest";
import { backupTransferContract } from "./backup-transfer-contract.test-helper";
import { randomUUID } from "node:crypto";
import { backupSchema } from "../backup";
import { seedProblems } from "../../data/problems";
import { emptyLearning } from "../learn/progress";
import { learningFixture } from "./project-learning-contract.test-helper";
import { restoredProjectId } from "./workspace-backup";
import type { ProblemStore } from "./store-contract";
import { validateReferencedAssessment } from "./project-assessment-references";
import type { Assessment } from "../project-check/types";
import { validateReview, type Problem } from "../problem";
import { exampleTestsFor } from "../example-tests";

const reviewOf = (problem: Problem) =>
  validateReview(
    {
      summary: "요구사항별로 코드를 검토했습니다.",
      criteria: problem.requirements.map((_, requirementIndex) => ({
        requirementIndex,
        passed: false,
        feedback: "코드의 동작을 확인했습니다.",
      })),
      strengths: [],
      improvements: [],
    },
    problem,
  );
const cart = seedProblems.find((p) => p.id === "fe-cart")!;
const cartTests = exampleTestsFor(cart)!.length;
// A built-in problem reviewed by AI only, where "직접 확인함" applies.
const plain = seedProblems.find((p) => !p.handoff && !exampleTestsFor(p))!;
const aiProblem = (name: string): Problem => ({
  ...plain,
  id: `ai-${name}-${randomUUID()}`,
  source: "ai",
});
const later = () => new Promise((resolve) => setTimeout(resolve, 5));

export function workspaceBackupContract(
  getStore: () => ProblemStore & { addProblem(p: Problem): unknown },
) {
  backupTransferContract(getStore);
  it("backup: carries checks, hidden AI problems and example-test results and keeps the newer check", async () => {
    const store = getStore();
    const owner = `user:${randomUUID()}`,
      target = `user:${randomUUID()}`;
    const checked = aiProblem("checked"),
      hidden = aiProblem("hidden");
    await store.addProblem(checked);
    await store.addProblem(hidden);
    const passed = await store.queries.saveProblemCheck(owner, cart.id, {
      kind: "tests",
      passed: cartTests,
      total: cartTests,
    });
    await store.queries.saveProblemCheck(owner, checked.id, { kind: "self", passed: 0, total: 0 });
    await store.queries.hideProblem(owner, hidden.id);
    const exampleTests = { passed: 2, total: cartTests };
    await store.saveAttempt(owner, cart.id, "function total() {}", {
      ...reviewOf(cart),
      exampleTests,
    });
    const file = backupSchema.parse(await store.exportBackup(owner));
    if (file.version !== 3) throw new Error();
    // A checked problem travels like one with progress; a hidden one is only referenced.
    expect(file.problems.map((p) => p.id).sort()).toEqual([checked.id, cart.id].sort());
    expect(file.problemChecks?.map((c) => [c.problemId, c.kind, c.passed, c.total])).toEqual(
      [
        [checked.id, "self", 0, 0],
        [cart.id, "tests", cartTests, cartTests],
      ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    );
    expect(file.problemChecks?.find((c) => c.problemId === cart.id)?.updatedAt).toBe(
      passed.updatedAt,
    );
    expect(file.hiddenProblems?.map((h) => h.problemId)).toEqual([hidden.id]);
    expect(file.attempts[0].review.exampleTests).toEqual(exampleTests);

    await store.importBackup(target, file);
    expect(await store.queries.problemCheck(target, cart.id)).toEqual(passed);
    expect(await store.queries.problemCheck(target, checked.id)).toMatchObject({ kind: "self" });
    expect(await store.queries.isHidden(target, hidden.id)).toBe(true);
    expect(await store.queries.isHidden(`user:${randomUUID()}`, hidden.id)).toBe(false);
    expect((await store.attempts(target))[0].review.exampleTests).toEqual(exampleTests);
    const roundtrip = await store.exportBackup(target);
    if (roundtrip.version !== 3) throw new Error();
    expect(roundtrip.problemChecks).toEqual(file.problemChecks);
    expect(roundtrip.hiddenProblems?.map((h) => h.problemId)).toEqual([hidden.id]);
    expect(roundtrip.attempts[0].review.exampleTests).toEqual(exampleTests);

    // A newer local check stays; a newer check in the file replaces an older local one.
    await later();
    const local = await store.queries.saveProblemCheck(target, cart.id, {
      kind: "tests",
      passed: cartTests,
      total: cartTests,
    });
    expect(await store.importBackup(target, file)).toMatchObject({ problems: 0, attempts: 0 });
    expect(await store.queries.problemCheck(target, cart.id)).toEqual(local);
    await later();
    const newer = structuredClone(file);
    const updatedAt = new Date().toISOString();
    newer.problemChecks = newer.problemChecks?.map((c) => ({ ...c, updatedAt }));
    await store.importBackup(target, newer);
    expect((await store.queries.problemCheck(target, cart.id))?.updatedAt).toBe(updatedAt);
    expect((await store.queries.problemCheck(target, checked.id))?.updatedAt).toBe(updatedAt);
    expect(await store.attempts(target)).toHaveLength(1);
  });
  it("backup: skips checks and hidden marks the live API would refuse and drops a malformed example-test result", async () => {
    const store = getStore();
    const owner = `user:${randomUUID()}`,
      target = `user:${randomUUID()}`;
    const visible = aiProblem("visible"),
      foreign = aiProblem("foreign");
    await store.addProblem(visible);
    // Restored privately by another account, so the target cannot see or hide it.
    await store.importBackup(owner, {
      version: 2,
      problems: [foreign],
      progress: {},
      attempts: [],
    });
    const empty = await store.exportBackup(`user:${randomUUID()}`);
    if (empty.version !== 3) throw new Error();
    expect(Object.keys(empty)).not.toContain("problemChecks");
    expect(Object.keys(empty)).not.toContain("hiddenProblems");
    const handoff = seedProblems.find((p) => p.handoff)!;
    const other = seedProblems.find((p) => p !== plain && !p.handoff && !exampleTestsFor(p))!;
    const updatedAt = "2026-11-01T00:00:00.000Z";
    const attempt = (id: string, problem: Problem, exampleTests: unknown) => ({
      id,
      problemId: problem.id,
      code: "function total() {}",
      review: { ...reviewOf(problem), exampleTests },
      assisted: false,
      createdAt: updatedAt,
    });
    const file = {
      ...empty,
      problemChecks: [
        { problemId: cart.id, kind: "tests" as const, passed: 1, total: cartTests, updatedAt },
        { problemId: plain.id, kind: "tests" as const, passed: 1, total: 1, updatedAt },
        { problemId: handoff.id, kind: "self" as const, passed: 0, total: 0, updatedAt },
        {
          problemId: `absent-${randomUUID()}`,
          kind: "self" as const,
          passed: 0,
          total: 0,
          updatedAt,
        },
        // A self-check records no counts, like the check API.
        { problemId: other.id, kind: "self" as const, passed: 3, total: 3, updatedAt },
      ],
      hiddenProblems: [
        { problemId: cart.id, createdAt: updatedAt },
        { problemId: foreign.id, createdAt: updatedAt },
        { problemId: `absent-${randomUUID()}`, createdAt: updatedAt },
        { problemId: visible.id, createdAt: "2999-01-01T00:00:00.000Z" },
      ],
      attempts: [
        attempt("bad-type", cart, { passed: "all", total: cartTests }),
        attempt("bad-count", cart, { passed: 1, total: cartTests + 1 }),
        attempt("bad-pass", cart, { passed: cartTests + 1, total: cartTests }),
        attempt("no-tests", plain, { passed: 1, total: 1 }),
      ],
    };
    expect(await store.importBackup(target, file)).toMatchObject({ attempts: 4 });
    for (const id of [cart.id, plain.id, handoff.id])
      expect(await store.queries.problemCheck(target, id)).toBeNull();
    expect(await store.queries.problemCheck(target, other.id)).toEqual({
      kind: "self",
      passed: 0,
      total: 0,
      updatedAt,
    });
    expect(await store.queries.isHidden(target, cart.id)).toBe(false);
    expect(await store.queries.isHidden(target, foreign.id)).toBe(false);
    expect(await store.queries.isHidden(target, visible.id)).toBe(true);
    const restored = await store.exportBackup(target);
    if (restored.version !== 3) throw new Error();
    // A future time is lowered to the import time.
    expect(Date.parse(restored.hiddenProblems![0].createdAt)).toBeLessThanOrEqual(Date.now());
    const attempts = await store.attempts(target);
    expect(attempts).toHaveLength(4);
    for (const a of attempts) expect(a.review).not.toHaveProperty("exampleTests");
    // Two records for one problem are a broken file, not a choice to make on import.
    for (const duplicate of [
      { ...file, problemChecks: [file.problemChecks[4], file.problemChecks[4]] },
      { ...file, hiddenProblems: [file.hiddenProblems[3], file.hiddenProblems[3]] },
    ]) {
      const rejected = `user:${randomUUID()}`;
      await expect(
        Promise.resolve().then(() => store.importBackup(rejected, duplicate)),
      ).rejects.toThrow();
      expect(await store.attempts(rejected)).toEqual([]);
    }
  });
  it("backup: imports files made before checks, hidden problems and example-test results were exported", async () => {
    const store = getStore();
    const owner = `user:${randomUUID()}`,
      target = `user:${randomUUID()}`;
    const hidden = aiProblem("old-hidden");
    await store.addProblem(hidden);
    await store.queries.saveProblemCheck(owner, cart.id, {
      kind: "tests",
      passed: cartTests,
      total: cartTests,
    });
    await store.queries.hideProblem(owner, hidden.id);
    await store.saveAttempt(owner, cart.id, "function total() {}", {
      ...reviewOf(cart),
      exampleTests: { passed: cartTests, total: cartTests },
    });
    const file = await store.exportBackup(owner);
    if (file.version !== 3) throw new Error();
    expect(file.problemChecks).toHaveLength(1);
    expect(file.hiddenProblems).toHaveLength(1);
    const older = structuredClone(file);
    delete older.problemChecks;
    delete older.hiddenProblems;
    delete older.attempts[0].review.exampleTests;
    expect(await store.importBackup(target, backupSchema.parse(older))).toMatchObject({
      attempts: 1,
    });
    expect(await store.queries.problemCheck(target, cart.id)).toBeNull();
    expect(await store.queries.isHidden(target, hidden.id)).toBe(false);
    expect((await store.attempts(target))[0].review).not.toHaveProperty("exampleTests");
    // A v2 file has no marks; a test run in its reviews is restored like in v3.
    const legacyTarget = `user:${randomUUID()}`;
    const v2 = {
      version: 2 as const,
      problems: file.problems,
      progress: file.progress,
      attempts: file.attempts,
    };
    expect(await store.importBackup(legacyTarget, backupSchema.parse(v2))).toMatchObject({
      attempts: 1,
    });
    expect((await store.attempts(legacyTarget))[0].review.exampleTests).toEqual({
      passed: cartTests,
      total: cartTests,
    });
  });
  it("backup: preserves v3 issue evidence and rejects missing decisions, forged quotes or uncapped scores", async () => {
    const store = getStore();
    const { owner, id } = await learningFixture(store);
    const file = await store.exportBackup(owner);
    if (file.version !== 3) throw new Error();
    const answers = ["本人以外も許可します。", "", "", "", ""];
    const assessment = validateReferencedAssessment(
      {
        summary: "권한 설명을 확인했습니다.",
        feedback: Array.from({ length: 5 }, (_, questionIndex) => ({
          questionIndex,
          feedback: "설명에 모순이 있습니다.",
          nextStep: "권한 검사를 확인해 보세요.",
          blockingIssue:
            questionIndex === 0
              ? { evidence: ["q0s0"], explanation: "타인의 요청도 허용한다는 설명입니다." }
              : null,
          evidence: Object.fromEntries(
            ["feature", "flow", "reason", "failure", "verification", "tradeoff"].map((key) => [
              key,
              questionIndex === 0 ? "q0s0" : null,
            ]),
          ),
        })),
      },
      answers,
    );
    file.projects[0].review = { answers, assessment };
    const target = randomUUID();
    await store.importBackup(target, file);
    const restored = await store.queries.projectChecks.detail(
      target,
      restoredProjectId(target, id),
    );
    expect(restored?.review).toEqual({ answers, assessment });
    const roundtrip = await store.exportBackup(target);
    if (roundtrip.version !== 3) throw new Error();
    expect(roundtrip.projects[0].review).toEqual({ answers, assessment });
    const mutate = [
      (a: Assessment) => {
        a.feedback[0].blockingIssue!.evidence = ["없는 인용문"];
      },
      (a: Assessment) => {
        delete a.feedback[0].blockingIssue;
      },
      (a: Assessment) => {
        a.feedback[0].level = 4;
        a.score = 20;
      },
      (a: Assessment) => {
        a.rubricVersion = "evidence-v2";
      },
      (a: Assessment) => {
        delete a.rubricVersion;
      },
    ];
    for (const change of mutate) {
      const bad = structuredClone(file);
      change((bad.projects[0].review as { assessment: Assessment }).assessment);
      const rejectedOwner = randomUUID();
      await expect(
        Promise.resolve().then(() => store.importBackup(rejectedOwner, bad)),
      ).rejects.toThrow();
      expect(await store.queries.projectChecks.list(rejectedOwner)).toEqual([]);
    }
  });
  it("backup: restores owned coding, lessons and pinned project training, without overwrites or duplicates", async () => {
    const store = getStore();
    const { owner, id } = await learningFixture(store);
    const target = `user:${randomUUID()}`;
    const other = `user:${randomUUID()}`;
    const lessonId = "where-data-lives";
    const content = JSON.stringify({ ...emptyLearning(), reason: "원본 설명" });
    await store.queries.learning.save(owner, lessonId, content, 0);
    await store.saveProgress(owner, seedProblems[0].id, {
      code: "original draft",
      baseRevision: 0,
    });
    await store.queries.projectLearning.submit(owner, {
      id,
      moduleId: "storage",
      phase: "baseline",
      revision: 0,
      answers: [0, 1],
      confidence: "unsure",
      assisted: false,
    });
    const originalTraining = await store.queries.projectLearning.get(owner, id);
    const file = backupSchema.parse(await store.exportBackup(owner));
    expect(file.version).toBe(3);
    if (file.version !== 3) throw new Error();
    expect(file.problems.map((p) => p.id)).toEqual([seedProblems[0].id]);
    expect(file.learning).toHaveLength(1);
    expect(file.projects).toHaveLength(1);
    expect(JSON.stringify(file)).not.toMatch(/"owner":|"token":|"fingerprint":/);
    expect((await store.exportBackup(other)).problems).toEqual([]);
    expect(await store.importBackup(target, file)).toMatchObject({ learning: 1, projects: 1 });
    const restored = restoredProjectId(target, id);
    expect((await store.queries.projectChecks.get(target, restored))?.id).toBe(restored);
    expect(await store.queries.projectChecks.get(other, restored)).toBeNull();
    expect(await store.queries.projectLearning.get(target, restored)).toEqual(originalTraining);
    expect((await store.queries.learning.get(target, lessonId))?.code).toBe(content);
    expect((await store.progressFor(target, seedProblems[0].id))?.code).toBe("original draft");
    await store.queries.learning.save(
      target,
      lessonId,
      JSON.stringify({ ...emptyLearning(), reason: "keep my newer explanation" }),
      1,
    );
    await store.saveProgress(target, seedProblems[0].id, {
      code: "keep newer draft",
      baseRevision: 1,
    });
    await store.queries.projectLearning.submit(target, {
      id: restored,
      moduleId: "flow",
      phase: "baseline",
      revision: 1,
      answers: [1, 2],
      confidence: "likely",
      assisted: true,
    });
    expect(await store.importBackup(target, file)).toMatchObject({ learning: 0, projects: 0 });
    expect((await store.progressFor(target, seedProblems[0].id))?.code).toBe("keep newer draft");
    expect((await store.queries.learning.get(target, lessonId))?.code).toContain("keep my newer");
    expect((await store.queries.projectLearning.get(target, restored)).revision).toBe(2);
    // Same-account restore preserves original IDs and does not clone the project.
    expect((await store.importBackup(owner, file)).projects).toBe(0);
    expect(await store.queries.projectChecks.list(owner)).toHaveLength(1);
  });
  it("backup: keeps generated-but-unopened problems portable through a second export", async () => {
    const store = getStore();
    const owner = randomUUID(),
      target = randomUUID();
    const claim = await store.startJob(owner, randomUUID(), "generate", "fixture");
    if (claim.state !== "new") throw new Error();
    const problem = { ...seedProblems[0], id: `backup-${randomUUID()}`, source: "ai" as const };
    await store.reserveGeneration(claim.lease);
    await store.completeGeneration(problem, claim.lease);
    const backup = await store.exportBackup(owner);
    expect(backup.problems.map((p) => p.id)).toEqual([problem.id]);
    await store.importBackup(target, backup);
    expect((await store.exportBackup(target)).problems.map((p) => p.id)).toEqual([problem.id]);
  });
  it("backup: rejects invalid lesson/assessment/curriculum relationships without partial writes", async () => {
    const store = getStore();
    const { owner, id } = await learningFixture(store);
    await store.queries.projectLearning.get(owner, id);
    const backup = await store.exportBackup(owner);
    if (backup.version !== 3) throw new Error();
    const variants = [
      {
        ...backup,
        learning: [
          {
            id: "where-data-lives",
            content: JSON.stringify({ ...emptyLearning(), completed: true }),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
      { ...backup, projects: [...backup.projects, backup.projects[0]] },
      {
        ...backup,
        projects: [
          {
            ...backup.projects[0],
            review: { ...(backup.projects[0].review as object), answers: [] },
          },
        ],
      },
    ];
    for (const file of variants) {
      const target = randomUUID();
      await expect(
        Promise.resolve().then(() => store.importBackup(target, file)),
      ).rejects.toThrow();
      expect(await store.queries.projectChecks.list(target)).toEqual([]);
      expect(await store.queries.learning.all(target)).toEqual([]);
    }
    const bad = structuredClone(backup);
    const review = bad.projects[0].review as { training: { curriculum: { contentId: string } } };
    review.training.curriculum.contentId = "0".repeat(64);
    await expect(
      Promise.resolve().then(() => store.importBackup(randomUUID(), bad)),
    ).rejects.toThrow();
  });
  it("backup: concurrent duplicate restores insert one project and lesson", async () => {
    const store = getStore();
    const { owner } = await learningFixture(store);
    await store.queries.learning.save(
      owner,
      "where-data-lives",
      JSON.stringify(emptyLearning()),
      0,
    );
    const backup = await store.exportBackup(owner),
      target = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 3 }, () => store.importBackup(target, backup)),
    );
    expect(results.reduce((s, r) => s + (r.projects ?? 0), 0)).toBe(1);
    expect(results.reduce((s, r) => s + (r.learning ?? 0), 0)).toBe(1);
  });
}

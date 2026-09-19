import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { backupSchema } from "../backup";
import { seedProblems } from "../../data/problems";
import { emptyLearning } from "../learn/progress";
import { learningFixture } from "./project-learning-contract.test-helper";
import { restoredProjectId } from "./workspace-backup";
import type { ProblemStore } from "./store-contract";
import { validateReferencedAssessment } from "./project-assessment-references";
import type { Assessment } from "../project-check/types";

export function workspaceBackupContract(getStore: () => ProblemStore) {
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

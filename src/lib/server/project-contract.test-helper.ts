import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import type { ProblemStore } from "./store-contract";
import { fixtureCheck, fixtureAssessment } from "../project-check/fixtures";
/** The same private-result SQL and fencing contract runs against either adapter. */
export function projectContract(getStore: () => ProblemStore) {
  it("edits class metadata without changing source or answers, detects conflicts, and backs it up", async () => {
    const store = getStore(),
      owner = `user:${randomUUID()}`,
      id = randomUUID();
    const job = await store.startJob(owner, id, "project-analysis", "class");
    if (job.state !== "new") throw Error();
    await store.queries.projectChecks.complete(job.lease, { ...fixtureCheck, id });
    const meta = await store.queries.projectChecks.editClass(owner, id, {
      name: "내 예약 서비스",
      goal: "재시도와 중복 저장 확인",
      revision: 0,
    });
    expect(meta.revision).toBe(1);
    const saved = await store.queries.projectChecks.get(owner, id);
    expect(saved?.page).toEqual(fixtureCheck.page);
    expect(saved?.analysis).toEqual(fixtureCheck.analysis);
    await expect(
      store.queries.projectChecks.editClass(owner, id, { name: "덮어쓰기", goal: "", revision: 0 }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      store.queries.projectChecks.editClass("user:other", id, {
        name: "침범",
        goal: "",
        revision: 1,
      }),
    ).rejects.toMatchObject({ status: 404 });
    const restoredOwner = `user:${randomUUID()}`;
    await store.importBackup(restoredOwner, await store.exportBackup(owner));
    const restored = await store.queries.projectChecks.list(restoredOwner);
    expect(restored[0].classMetadata).toEqual(meta);
    await store.queries.projectChecks.remove(owner, id);
    expect(await store.queries.projectChecks.get(owner, id)).toBeNull();
    expect((await store.queries.projectChecks.list(restoredOwner))[0].classMetadata?.name).toBe(
      meta.name,
    );
  });
  it("stores only owned project results and removes the associated assessment", async () => {
    const store = getStore(),
      id = randomUUID(),
      owner = `user:${randomUUID()}`;
    const analysis = await store.startJob(owner, id, "project-analysis", "project-input");
    if (analysis.state !== "new") throw new Error();
    await store.queries.projectChecks.complete(analysis.lease, { ...fixtureCheck, id });
    const review = await store.startJob(
      owner,
      `project-review-${id}`,
      `project-review:${id}`,
      "answers",
    );
    if (review.state !== "new") throw new Error();
    await store.queries.projectChecks.complete(review.lease, {
      answers: Array(5).fill("答"),
      assessment: fixtureAssessment,
    });
    expect((await store.queries.projectChecks.list(owner))[0].review?.assessment.score).toBe(50);
    const detail = await store.queries.projectChecks.detail(owner, id);
    expect(detail?.review?.assessment.score).toBe(50);
    expect(detail?.page).not.toHaveProperty("text");
    expect(detail?.analysis.questions[0]).not.toHaveProperty("criteria");
    expect(detail?.review).not.toHaveProperty("training");
    expect(await store.queries.projectChecks.get("user:other", id)).toBeNull();
    await store.queries.projectChecks.remove(owner, id);
    expect(await store.queries.projectChecks.review(owner, id)).toBeUndefined();
  });
  it("pages all owned records across tied timestamps, insertions and a deleted cursor record", async () => {
    const store = getStore();
    const owner = `user:${randomUUID()}`;
    const now = vi.spyOn(Date, "now").mockReturnValue(1_900_000_000_000);
    try {
      const ids: string[] = [];
      for (let i = 0; i < 45; i++) {
        const id = randomUUID();
        ids.push(id);
        const claim = await store.startJob(owner, id, "project-analysis", "input");
        if (claim.state !== "new") throw new Error();
        await store.queries.projectChecks.complete(claim.lease, { ...fixtureCheck, id });
      }
      ids.sort().reverse();
      const first = await store.queries.projectChecks.page(owner);
      expect(first.checks.map((c) => c.id)).toEqual(ids.slice(0, 20));
      expect(first.nextCursor).toBeTruthy();
      // A saved deep link does not depend on the first page.
      expect((await store.queries.projectChecks.detail(owner, ids[44]))?.id).toBe(ids[44]);
      expect(await store.queries.projectChecks.detail("other", ids[44])).toBeNull();
      expect((await store.queries.projectChecks.page("other", first.nextCursor)).checks).toEqual(
        [],
      );
      await store.queries.projectChecks.remove(owner, ids[19]);
      now.mockReturnValue(1_900_000_001_000);
      const id = randomUUID();
      const inserted = await store.startJob(owner, id, "project-analysis", "input");
      if (inserted.state !== "new") throw new Error();
      await store.queries.projectChecks.complete(inserted.lease, { ...fixtureCheck, id });
      const second = await store.queries.projectChecks.page(owner, first.nextCursor);
      const third = await store.queries.projectChecks.page(owner, second.nextCursor);
      expect([...second.checks, ...third.checks].map((c) => c.id)).toEqual(ids.slice(20));
      expect(third.nextCursor).toBeNull();
      await expect(store.queries.projectChecks.page(owner, "not-a-cursor")).rejects.toMatchObject({
        status: 400,
      });
      await expect(store.queries.projectChecks.page(owner, "")).rejects.toMatchObject({
        status: 400,
      });
    } finally {
      now.mockRestore();
    }
  });
  it("allows one competing completion and rejects a stale or already-finished writer", async () => {
    const store = getStore(),
      id = randomUUID(),
      owner = `user:${randomUUID()}`;
    const claim = await store.startJob(owner, id, "project-analysis", "input");
    if (claim.state !== "new") throw new Error();
    const outcomes = await Promise.allSettled(
      Array.from({ length: 3 }, () =>
        store.queries.projectChecks.complete(claim.lease, { ...fixtureCheck, id }),
      ),
    );
    expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
    await expect(
      store.queries.projectChecks.complete(
        { ...claim.lease, token: "stale" },
        { ...fixtureCheck, id },
      ),
    ).rejects.toThrow();
  });
}

import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { seedProblems } from "../../data/problems";
import type { ProblemStore, JobLease } from "./store-contract";
import {
  CodeConflict,
  RevisionRequired,
  RequestMismatch,
  StaleJob,
  requestFingerprint,
} from "./write-conflicts";

export async function claim(
  store: ProblemStore,
  owner: string = `user:${randomUUID()}`,
  kind = "generate",
  id: string = randomUUID(),
  fingerprint = "same-input",
): Promise<JobLease> {
  const job = await store.startJob(owner, id, kind, fingerprint);
  if (job.state !== "new") throw new Error("Expected a fresh execution");
  return job.lease;
}
const review = {
  score: 0,
  passed: false,
  summary: "검토",
  criteria: [],
  strengths: [],
  improvements: [],
};
export function concurrencyContract(
  getStore: () => ProblemStore,
  expire: (id: string) => unknown | Promise<unknown>,
) {
  it("coaching is fenced, idempotent and records assistance without creating submissions", async () => {
    const store = getStore(),
      id = seedProblems[0].id;
    const old = await claim(store, randomUUID(), `coach:${id}`);
    await expire(old.id);
    const current = await claim(store, old.owner, old.kind, old.id);
    await expect(
      Promise.resolve().then(() => store.completeCoaching(old, id, "late")),
    ).rejects.toBeInstanceOf(StaleJob);
    expect(await store.failJob(old)).toBe(false);
    await expect(
      Promise.resolve().then(() => store.completeCoaching(current, "other", "wrong")),
    ).rejects.toBeInstanceOf(StaleJob);
    await store.completeCoaching(current, id, "coaching result");
    await expect(
      Promise.resolve().then(() => store.completeCoaching(current, id, "duplicate")),
    ).rejects.toBeInstanceOf(StaleJob);
    expect(await store.startJob(current.owner, current.id, current.kind, "same-input")).toEqual({
      state: "done",
      result: "coaching result",
    });
    await expect(
      Promise.resolve().then(() =>
        store.startJob(current.owner, current.id, current.kind, "other-input"),
      ),
    ).rejects.toBeInstanceOf(RequestMismatch);
    expect(await store.attempts(current.owner)).toHaveLength(0);
    expect((await store.saveAttempt(current.owner, id, "code", review)).assisted).toBe(true);
    expect((await store.saveAttempt("other-learner", id, "code", review)).assisted).toBe(false);
  }, 30000);
  it("rejects a stale tab/offline revision, isolates metadata, and acknowledges identical retries", async () => {
    const store = getStore(),
      owner = randomUUID(),
      id = seedProblems[0].id;
    const original = await store.saveProgress(owner, id, { code: "original", baseRevision: 0 });
    const b = await store.saveProgress(owner, id, {
      code: "B newer",
      baseRevision: original.codeRevision,
    });
    await expect(
      Promise.resolve().then(() =>
        store.saveProgress(owner, id, { code: "A offline", baseRevision: original.codeRevision }),
      ),
    ).rejects.toBeInstanceOf(CodeConflict);
    expect((await store.progressFor(owner, id))?.code).toBe("B newer");
    await store.saveProgress(owner, id, { bookmarked: true });
    await store.reveal(owner, seedProblems[0], "hint");
    expect((await store.progressFor(owner, id))?.codeRevision).toBe(b.codeRevision);
    const resolved = await store.saveProgress(owner, id, {
      code: "merged",
      baseRevision: b.codeRevision,
    });
    expect(resolved.codeRevision).toBe(b.codeRevision + 1);
    expect(
      (await store.saveProgress(owner, id, { code: "merged", baseRevision: b.codeRevision }))
        .codeRevision,
    ).toBe(resolved.codeRevision);
    await expect(
      Promise.resolve().then(() => store.saveProgress(owner, id, { code: "unguarded" })),
    ).rejects.toBeInstanceOf(RevisionRequired);
    expect(await store.progressFor("other", id)).toBeNull();
  }, 30000);
  it("fences expired generation cleanup, reservation and late success; commits exactly one result", async () => {
    const store = getStore(),
      old = await claim(store);
    await store.reserveGeneration(old);
    await expire(old.id);
    const current = await claim(store, old.owner, old.kind, old.id);
    expect(current.token).not.toBe(old.token);
    await store.reserveGeneration(current);
    expect(await store.failJob(old)).toBe(false);
    await expect(Promise.resolve().then(() => store.reserveGeneration(old))).rejects.toBeInstanceOf(
      StaleJob,
    );
    const late = { ...seedProblems[0], id: `late-${randomUUID()}`, source: "ai" as const };
    await expect(
      Promise.resolve().then(() => store.completeGeneration(late, old)),
    ).rejects.toBeInstanceOf(StaleJob);
    expect(await store.problem(late.id)).toBeNull();
    expect((await store.queries.usage(old.owner)).remaining.generate).toBe(5);
    // A failed insertion leaves job and reservation available for the current execution.
    await expect(
      Promise.resolve().then(() => store.completeGeneration(seedProblems[0], current)),
    ).rejects.toThrow();
    expect((await store.startJob(old.owner, old.id, old.kind, "same-input")).state).toBe("pending");
    const result = { ...late, id: `new-${randomUUID()}` };
    await store.completeGeneration(result, current);
    await expect(
      Promise.resolve().then(() => store.completeGeneration(late, current)),
    ).rejects.toBeInstanceOf(StaleJob);
    expect(await store.failJob(current)).toBe(false);
    expect(await store.startJob(old.owner, old.id, old.kind, "same-input")).toEqual({
      state: "done",
      result: result.id,
    });
    expect((await store.queries.usage(old.owner)).remaining.generate).toBe(5);
  }, 30000);
  it("fences late reviews and retains request identity through failure and completion", async () => {
    const store = getStore(),
      id = seedProblems[0].id,
      old = await claim(store, randomUUID(), `review:${id}`);
    await expire(old.id);
    const current = await claim(store, old.owner, old.kind, old.id);
    await expect(
      Promise.resolve().then(() => store.saveAttempt(old.owner, id, "old code", review, old)),
    ).rejects.toBeInstanceOf(StaleJob);
    const attempt = await store.saveAttempt(current.owner, id, "new code", review, current);
    await expect(
      Promise.resolve().then(() =>
        store.saveAttempt(current.owner, id, "new code", review, current),
      ),
    ).rejects.toBeInstanceOf(StaleJob);
    expect(await store.attempts(current.owner)).toHaveLength(1);
    expect(await store.startJob(current.owner, current.id, current.kind, "same-input")).toEqual({
      state: "done",
      result: attempt.id,
    });
    for (const [owner, kind, fingerprint] of [
      [current.owner, current.kind, "different-code"],
      ["other", current.kind, "same-input"],
      [current.owner, "generate", "same-input"],
    ])
      await expect(
        Promise.resolve().then(() => store.startJob(owner, current.id, kind, fingerprint)),
      ).rejects.toBeInstanceOf(RequestMismatch);
    const failed = await claim(store);
    expect(await store.failJob(failed)).toBe(true);
    await expect(
      Promise.resolve().then(() =>
        store.startJob(failed.owner, failed.id, failed.kind, "different-options"),
      ),
    ).rejects.toBeInstanceOf(RequestMismatch);
    expect((await store.startJob(failed.owner, failed.id, failed.kind, "same-input")).state).toBe(
      "new",
    );
    expect(requestFingerprint("ab", "c")).not.toBe(requestFingerprint("a", "bc"));
  }, 30000);
}

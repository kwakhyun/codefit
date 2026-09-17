import { expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import type { ProblemStore } from "./store-contract";
import { fixtureCheck, fixtureAssessment } from "../project-check/fixtures";
/** The same private-result SQL and fencing contract runs against either adapter. */
export function projectContract(getStore: () => ProblemStore) {
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
    expect(await store.queries.projectChecks.get("user:other", id)).toBeNull();
    await store.queries.projectChecks.remove(owner, id);
    expect(await store.queries.projectChecks.review(owner, id)).toBeUndefined();
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

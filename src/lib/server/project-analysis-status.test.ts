import { expect, it } from "vitest";
import { SqliteStore } from "./sqlite-store";
import { fixtureCheck } from "../project-check/fixtures";
it("reports only the owner's analysis state, including failure, expiry and completion", async () => {
  const store = new SqliteStore(":memory:");
  try {
    const id = fixtureCheck.id;
    const claim = store.startJob("user:a", id, "project-analysis", "input");
    if (claim.state !== "new") throw new Error();
    expect(await store.queries.projectChecks.analysisStatus("user:b", id)).toBeNull();
    expect(await store.queries.projectChecks.analysisStatus("user:a", id)).toEqual({
      status: "pending",
    });
    store.db.prepare("UPDATE jobs SET expires=? WHERE id=?").run(Date.now() - 1, id);
    expect(await store.queries.projectChecks.analysisStatus("user:a", id)).toEqual({
      status: "failed",
    });
    const retry = store.startJob("user:a", id, "project-analysis", "input");
    if (retry.state !== "new") throw new Error();
    await store.queries.projectChecks.complete(retry.lease, fixtureCheck);
    expect(await store.queries.projectChecks.analysisStatus("user:a", id)).toEqual({
      status: "done",
    });
    const second = store.startJob("user:a", "other", "project-analysis", "input");
    if (second.state !== "new") throw new Error();
    store.failJob(second.lease);
    expect(await store.queries.projectChecks.analysisStatus("user:a", "other")).toEqual({
      status: "failed",
    });
  } finally {
    store.db.close();
  }
});

it("cancels only owned pending work and rejects late completion without changing finished classes", async () => {
  const store = new SqliteStore(":memory:");
  try {
    const id = fixtureCheck.id;
    const claim = store.startJob("user:a", id, "project-analysis", "input");
    if (claim.state !== "new") throw new Error();
    await expect(store.queries.projectChecks.cancelAnalysis("user:b", id)).rejects.toThrow();
    expect(await store.queries.projectChecks.analysisStatus("user:a", id)).toEqual({
      status: "pending",
    });
    expect(await store.queries.projectChecks.cancelAnalysis("user:a", id)).toEqual({
      status: "cancelled",
    });
    expect(store.failJob(claim.lease)).toBe(false);
    await expect(store.queries.projectChecks.complete(claim.lease, fixtureCheck)).rejects.toThrow();
    expect(await store.queries.projectChecks.cancelAnalysis("user:a", id)).toEqual({
      status: "cancelled",
    });
    expect(await store.queries.projectChecks.get("user:a", id)).toBeNull();
    const retry = store.startJob("user:a", id, "project-analysis", "input");
    if (retry.state !== "new") throw new Error();
    await store.queries.projectChecks.complete(retry.lease, fixtureCheck);
    expect(await store.queries.projectChecks.cancelAnalysis("user:a", id)).toEqual({
      status: "done",
    });
    expect(await store.queries.projectChecks.get("user:a", id)).not.toBeNull();
  } finally {
    store.db.close();
  }
});

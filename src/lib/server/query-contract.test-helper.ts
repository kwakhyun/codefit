import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import type { ProblemStore } from "./store-contract";
import { seedProblems } from "../../data/problems";
import type { Problem, Review } from "../problem";
import type { AiRun } from "../ai-telemetry";

export function queryContract(getStore: () => ProblemStore & { addProblem(p: Problem): unknown }) {
  it("reserves three generations concurrently, refunds failures and isolates accounts", async () => {
    const store = getStore(),
      owner = `user:${randomUUID()}`,
      now = Date.now();
    const ids = Array.from({ length: 8 }, () => randomUUID());
    const claims = await Promise.all(ids.map((id) => store.reserveGeneration(owner, id, now)));
    expect(claims.filter(Boolean)).toHaveLength(3);
    expect((await store.queries.usage(owner, now)).remaining.generate).toBe(0);
    const first = ids[claims.indexOf(true)];
    expect(await store.reserveGeneration(owner, first, now)).toBe(true);
    expect(await store.reserveGeneration("user:someone-else", first, now)).toBe(false);
    await store.failJob(first);
    expect((await store.queries.usage(owner, now)).remaining.generate).toBe(1);
    expect(await store.reserveGeneration(owner, randomUUID(), now)).toBe(true);
    expect(await store.reserveGeneration(`user:${randomUUID()}`, randomUUID(), now)).toBe(true);
    expect((await store.queries.usage(owner, now + 150001)).remaining.generate).toBe(3);
  }, 30000);
  it("persists completed usage and resets at Korean midnight", async () => {
    const store = getStore(),
      owner = `user:${randomUUID()}`,
      now = Date.parse("2026-09-13T14:59:59Z");
    for (let i = 0; i < 3; i++) {
      const id = randomUUID();
      await store.startJob(owner, id, "generate");
      expect(await store.reserveGeneration(owner, id, now)).toBe(true);
      await store.completeGeneration(
        { ...seedProblems[0], id: `ai-${randomUUID()}`, source: "ai" },
        id,
      );
      expect(await store.reserveGeneration(owner, id, now + 200000)).toBe(true);
      await store.failJob(id);
    }
    const usage = await store.queries.usage(owner, now);
    expect(usage.remaining.generate).toBe(0);
    expect(usage.resetsAt.generate).toBe("2026-09-13T15:00:00.000Z");
    expect(await store.reserveGeneration(owner, randomUUID(), now)).toBe(false);
    expect((await store.queries.usage(owner, now + 1000)).remaining.generate).toBe(3);
    expect(await store.reserveGeneration(owner, randomUUID(), now + 1000)).toBe(true);
  }, 30000);
  it("filters and pages summaries on the server, with stable order and no answer/draft disclosure", async () => {
    const store = getStore();
    const prefix = `query-${randomUUID()}`;
    for (let i = 0; i < 19; i++)
      await store.addProblem({
        ...seedProblems[0],
        id: `${prefix}-${String(i).padStart(2, "0")}`,
        title: `Search literal 100%_! ${i}`,
        source: "ai",
      });
    const params = new URLSearchParams({
      q: "100%_!",
      sort: "newest",
      domain: "frontend",
      source: "ai",
    });
    const first = await store.queries.library("query-a", params);
    expect(first.total).toBe(19);
    expect(first.problems).toHaveLength(8);
    expect(first.problems[0]).not.toHaveProperty("solution");
    expect(first.problems[0]).not.toHaveProperty("starterCode");
    params.set("page", "2");
    const second = await store.queries.library("query-a", params);
    expect(second.problems).toHaveLength(8);
    expect(new Set([...first.problems, ...second.problems].map((p) => p.id)).size).toBe(16);
    params.set("page", "999");
    expect((await store.queries.library("query-a", params)).page).toBe(3);
    expect(
      (await store.queries.library("query-a", new URLSearchParams({ q: "' OR 1=1 --" }))).total,
    ).toBe(0);
    await store.saveProgress("query-a", first.problems[0].id, {
      bookmarked: true,
      code: "private draft",
    });
    const mine = await store.queries.library("query-a", new URLSearchParams({ view: "bookmarks" }));
    expect(mine.total).toBe(1);
    expect(mine.progress[first.problems[0].id]).not.toHaveProperty("code");
    expect(
      (await store.queries.library("query-b", new URLSearchParams({ view: "bookmarks" }))).total,
    ).toBe(0);
    expect(await store.progressFor("query-b", first.problems[0].id)).toBeNull();
  }, 30000);
  it("uses owner-scoped cursors and retains addressable old submissions", async () => {
    const store = getStore(),
      p = seedProblems[1],
      owner = `history-${randomUUID()}`;
    const review: Review = {
      score: 100,
      passed: true,
      summary: "모든 조건을 충족합니다.",
      criteria: p.requirements.map((_, i) => ({
        requirementIndex: i,
        passed: true,
        feedback: "요구 조건을 만족합니다.",
      })),
      strengths: [],
      improvements: [],
    };
    const attempts = Array.from({ length: 25 }, (_, i) => ({
      id: `fixture-${String(i).padStart(2, "0")}`,
      problemId: p.id,
      code: `private code ${i}`,
      review,
      assisted: false,
      createdAt: "2026-09-01T03:00:00.000Z",
    }));
    await store.importBackup(owner, {
      version: 2,
      problems: [],
      progress: {},
      attempts,
      legacy: null,
    });
    const first = await store.queries.history(owner);
    expect(first.attempts).toHaveLength(20);
    expect(first.nextCursor).toBeTruthy();
    expect(first.attempts[0]).not.toHaveProperty("code");
    const second = await store.queries.history(owner, first.nextCursor);
    expect(second.attempts).toHaveLength(5);
    expect(second.nextCursor).toBeNull();
    expect(new Set([...first.attempts, ...second.attempts].map((a) => a.id)).size).toBe(25);
    expect((await store.queries.history("nobody", first.nextCursor)).attempts).toEqual([]);
    expect(
      (await store.queries.recentAttempts(owner, p.id, second.attempts[4].id)).some(
        (a) => a.id === second.attempts[4].id,
      ),
    ).toBe(true);
    const workspace = await store.queries.workspace(owner);
    expect(workspace.stats.attempts).toBe(25);
    expect(workspace.training.independentSolved).toBe(1);
    await expect(store.queries.history(owner, "invalid")).rejects.toThrow();
  }, 30000);
  it("charges weighted limits atomically and does not spend other buckets on rejection", async () => {
    const store = getStore(),
      key = randomUUID();
    expect(await store.consumeLimits([{ key, max: 10, cost: 8, windowMs: 1000 }], 1000)).toBe(true);
    expect(
      await store.consumeLimits(
        [
          { key: `${key}-other`, max: 1, windowMs: 1000 },
          { key, max: 10, cost: 3, windowMs: 1000 },
        ],
        1000,
      ),
    ).toBe(false);
    expect(await store.consumeLimits([{ key: `${key}-other`, max: 1, windowMs: 1000 }], 1000)).toBe(
      true,
    );
    expect(await store.consumeLimits([{ key, max: 10, cost: 10, windowMs: 1000 }], 2001)).toBe(
      true,
    );
  });
  it("records measured AI usage without exposing another owner's metrics", async () => {
    const store = getStore(),
      owner = randomUUID();
    const run: AiRun = {
      id: randomUUID(),
      operation: "review",
      model: "gpt-5.4-mini",
      promptVersion: "test",
      outcome: "success",
      latencyMs: 1000,
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 200,
      estimatedCostUsd: 0.001,
      createdAt: new Date().toISOString(),
    };
    await store.queries.recordAiRun(owner, run);
    await store.queries.recordAiRun(owner, run);
    expect((await store.queries.usage(owner)).last30Days).toMatchObject({
      requests: 1,
      inputTokens: 100,
      outputTokens: 200,
      averageLatencyMs: 1000,
    });
    expect((await store.queries.usage("other-metrics")).last30Days.requests).toBe(0);
  });
}

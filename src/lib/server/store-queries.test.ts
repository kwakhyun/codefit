import { seedProblems } from "../../data/problems";
import { afterAll, describe, expect, it, vi } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SqliteStore } from "./sqlite-store";
import { queryContract } from "./query-contract.test-helper";
import { decodeCursor, StoreQueries } from "./store-queries";
import { networkIdentity, aiLimits, validateLimits } from "./usage-policy";

describe("SQLite read model contract", () => {
  const store = new SqliteStore(":memory:");
  afterAll(() => store.db.close());
  queryContract(() => store);
});
it("rejects malformed cursors and quota costs", () => {
  expect(() => decodeCursor("a".repeat(400))).toThrow();
  expect(() => validateLimits([{ key: "a", max: 1, cost: -1, windowMs: 10 }])).toThrow();
  expect(() =>
    validateLimits([
      { key: "a", max: 1, windowMs: 10 },
      { key: "a", max: 1, windowMs: 10 },
    ]),
  ).toThrow();
});
it("ignores untrusted IP headers outside Vercel and hashes trusted IPs", () => {
  const request = new Request("https://example.com", {
    headers: { "x-vercel-forwarded-for": "192.0.2.10" },
  });
  expect(networkIdentity(request, {})).toBe("local");
  const identity = networkIdentity(request, { VERCEL: "1", RATE_LIMIT_SALT: "test salt" });
  expect(identity).toMatch(/^[a-f0-9]{64}$/);
  expect(identity).not.toContain("192.0.2.10");
  expect(() => networkIdentity(request, { VERCEL: "1" })).toThrow();
  expect(aiLimits("new-cookie", identity, "review").map((l) => l.key)).toContain("ai:global:day");
});
it("reuses initialized SQLite connections after module reload", async () => {
  const original = new SqliteStore(":memory:");
  const reused = new SqliteStore(original.db as DatabaseSync);
  expect((await reused.queries.library("x", new URLSearchParams())).total).toBe(
    seedProblems.length,
  );
  original.db.close();
});

it("preflights 2500 backup IDs in five bounded queries without reading problem bodies", async () => {
  const query = vi.fn(async () => [{ count: "0" }]);
  const queries = new StoreQueries(query, "postgres");
  expect(
    await queries.countExistingProblems(Array.from({ length: 2500 }, (_, i) => `p-${i}`)),
  ).toBe(0);
  expect(query).toHaveBeenCalledTimes(5);
  for (const [sql, values] of query.mock.calls as unknown as [string, string[]][]) {
    expect(sql).toMatch(/^SELECT COUNT/);
    expect(values).toHaveLength(500);
  }
});

it("limits concurrent guest generation to two without affecting a member workspace", async () => {
  const store = new SqliteStore(":memory:");
  try {
    const { claim } = await import("./concurrency-contract.test-helper");
    const guest = "visitor:quota";
    const leases = await Promise.all(Array.from({ length: 4 }, () => claim(store, guest)));
    const results = await Promise.all(leases.map((lease) => store.reserveGeneration(lease)));
    expect(results.filter(Boolean)).toHaveLength(2);
    expect(await store.queries.usage(guest)).toMatchObject({
      canGenerate: true,
      allowance: { generate: 2 },
      remaining: { generate: 0 },
    });
    expect((await store.queries.usage("user:member")).remaining.generate).toBe(6);
    await store.failJob(leases[results.indexOf(true)]);
    expect((await store.queries.usage(guest)).remaining.generate).toBe(1);
  } finally {
    store.db.close();
  }
});
it("separates every AI feature quota and prevents guest cookie rotation on one network", async () => {
  const store = new SqliteStore(":memory:");
  try {
    expect(await store.consumeLimits(aiLimits("visitor:a", "wifi", "coach"))).toBe(true);
    expect(await store.consumeLimits(aiLimits("visitor:a", "wifi", "coach"))).toBe(true);
    expect(await store.consumeLimits(aiLimits("visitor:b", "wifi", "coach"))).toBe(false);
    expect(await store.consumeLimits(aiLimits("visitor:a", "wifi", "review"))).toBe(true);
    expect(await store.consumeLimits(aiLimits("visitor:a", "wifi", "learnCoach"))).toBe(true);
    expect(await store.consumeLimits(aiLimits("user:member", "wifi", "coach"))).toBe(true);
    expect(aiLimits("user:member", "wifi", "coach")).toContainEqual({
      key: "ai:coach:user:member",
      max: 30,
      windowMs: 86400000,
    });
  } finally {
    store.db.close();
  }
});

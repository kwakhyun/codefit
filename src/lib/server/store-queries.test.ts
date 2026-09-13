import { afterAll, describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { SqliteStore } from "./sqlite-store";
import { queryContract } from "./query-contract.test-helper";
import { decodeCursor } from "./store-queries";
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
  expect((await reused.queries.library("x", new URLSearchParams())).total).toBe(12);
  original.db.close();
});

import { expect, it } from "vitest";
import { appendPage, mergeFirstPage } from "./overview-merge";
import type { CheckOverview } from "./types";
const item = (id: string) => ({
  id,
  createdAt: "",
  page: { url: "https://example.com" },
  analysis: { title: id },
});
const page = (ids: string[], nextCursor: string | null, scope = "user:a"): CheckOverview => ({
  scope,
  signedIn: true,
  aiReady: true,
  usage: {
    analysis: { limit: 5, remaining: 5, resetsAt: null },
    review: { limit: 12, remaining: 12, resetsAt: null },
  },
  checks: ids.map(item),
  nextCursor,
});
it("refreshes only the first page while keeping older pages that were already shown", () => {
  const shown = page(["c", "b", "a", "z", "y"], "older");
  const merged = mergeFirstPage(shown, page(["new", "c", "b"], "next"));
  expect(merged.checks.map((c) => c.id)).toEqual(["new", "c", "b", "a", "z", "y"]);
  expect(merged.nextCursor).toBe("older");
});
it("replaces the list for a new scope, a complete first page or an unknown boundary", () => {
  const shown = page(["c", "b", "a"], "older");
  expect(mergeFirstPage(shown, page(["x"], "n", "user:b")).checks.map((c) => c.id)).toEqual(["x"]);
  expect(mergeFirstPage(shown, page(["c"], null)).checks.map((c) => c.id)).toEqual(["c"]);
  expect(mergeFirstPage(shown, page(["q", "r"], "n")).checks.map((c) => c.id)).toEqual(["q", "r"]);
});
it("appends an older page once", () => {
  const next = appendPage(page(["b", "a"], "c1"), page(["a", "z"], null));
  expect(next.checks.map((c) => c.id)).toEqual(["b", "a", "z"]);
  expect(next.nextCursor).toBeNull();
});

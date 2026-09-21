import { expect, it } from "vitest";
import { emptyReview, mergeReviewDraft } from "./review-draft";
it("keeps edits to separate questions from stale tabs", () => {
  const base = emptyReview();
  const first = mergeReviewDraft(base, base, "one", { note: "첫 번째 메모" });
  const second = mergeReviewDraft(first, base, "two", { note: "두 번째 메모" });
  expect(second.entries.one.note).toBe("첫 번째 메모");
  expect(second.entries.two.note).toBe("두 번째 메모");
});
it("retains the conflicting note while allowing ordinary typing without duplicates", () => {
  const base = emptyReview();
  const first = mergeReviewDraft(base, base, "one", { note: "다른 탭의 메모" });
  const second = mergeReviewDraft(first, base, "one", { note: "지금 작성한 메모" });
  expect(second.entries.one.alternatives).toEqual(["다른 탭의 메모"]);
  const third = mergeReviewDraft(second, second, "one", { note: "지금 작성한 메모 보완" });
  expect(third.entries.one.alternatives).toEqual(["다른 탭의 메모"]);
});

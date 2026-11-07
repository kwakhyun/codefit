import { expect, it, vi } from "vitest";
import { api, ApiError } from "../client-api";
import { pollReview, requestReview, reviewFailure } from "./review-request";
const review = { answers: ["a", "", "", "", ""], assessment: { score: 20 } };

it("unlocks answers only for a definite server failure", () => {
  expect(reviewFailure(new ApiError("한도", 429))).toEqual({ state: "failed", message: "한도" });
  expect(reviewFailure(new ApiError("입력", 400)).state).toBe("failed");
  expect(reviewFailure(new ApiError("검토 중", 409))).toEqual({ state: "pending" });
  expect(reviewFailure(new ApiError("게이트웨이", 504)).state).toBe("unknown");
  expect(reviewFailure(new TypeError("Failed to fetch")).state).toBe("unknown");
});

it("starts a background evaluation without the global generation wrapper", async () => {
  const request = vi.fn().mockResolvedValueOnce({ status: "pending", id: "c" });
  expect(await requestReview("c", review.answers, "user:a", request as typeof api)).toEqual({
    state: "pending",
  });
  expect(request.mock.calls[0][1]).toMatchObject({
    method: "PATCH",
    background: true,
    quietGeneration: true,
    body: { id: "c", answers: review.answers },
  });
  request.mockResolvedValueOnce(review);
  expect(await requestReview("c", review.answers, "user:a", request as typeof api)).toEqual({
    state: "done",
    review,
  });
});

it("polls quietly until the saved review or a reported failure, tolerating dropped reads", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ status: "pending" })
    .mockRejectedValueOnce(new TypeError("offline"))
    .mockResolvedValueOnce({ status: "done", review });
  const result = await pollReview("c", "user:a", {
    request: request as typeof api,
    intervalMs: 0,
  });
  expect(result).toEqual({ state: "done", review });
  expect(
    request.mock.calls.every(
      ([url, options]) => url === "/api/project-check/c/review" && options.track === false,
    ),
  ).toBe(true);
  const failed = vi.fn().mockResolvedValueOnce({ status: "failed", error: "근거 부족" });
  expect(await pollReview("c", "user:a", { request: failed as typeof api })).toEqual({
    state: "failed",
    message: "근거 부족",
  });
  const missing = vi.fn().mockRejectedValueOnce(new ApiError("없음", 404));
  expect((await pollReview("c", "user:a", { request: missing as typeof api })).state).toBe(
    "failed",
  );
});

it("reports an unknown outcome when the deadline passes", async () => {
  const request = vi.fn().mockResolvedValue({ status: "pending" });
  const result = await pollReview("c", "user:a", {
    request: request as typeof api,
    timeoutMs: 5,
    intervalMs: 10,
  });
  expect(result.state).toBe("unknown");
});

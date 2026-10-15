import OpenAI from "openai";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { failure, HttpError } from "./http";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

const providerError = (code: string, type?: string, retryAfter?: string) =>
  new OpenAI.RateLimitError(
    429,
    { code, type, message: "private provider request data" },
    undefined,
    new Headers(retryAfter ? { "Retry-After": retryAfter } : undefined),
  );

it.each([
  "insufficient_quota",
  "credit_balance_exhausted",
  "organization_spend_limit_exceeded",
  "project_spend_limit_exceeded",
  "organization_usage_limit_exceeded",
])("does not suggest a transient retry for %s", async (code) => {
  const response = failure(providerError(code, undefined, "30"));
  expect(response.status).toBe(503);
  expect(response.headers.get("Retry-After")).toBeNull();
  expect(await response.json()).toEqual({
    error: expect.stringContaining("서비스 운영자의 한도 조정이 필요합니다"),
  });
  expect(console.error).toHaveBeenCalledWith("AI request failed", {
    status: 429,
    category: code,
  });
});

it("recognizes a quota type without logging an unknown provider code or message", async () => {
  const response = failure(providerError("private-unknown-code", "insufficient_quota"));
  expect(response.status).toBe(503);
  expect(console.error).toHaveBeenCalledWith("AI request failed", {
    status: 429,
    category: "insufficient_quota",
  });
  expect(await response.text()).not.toContain("private");
});

it.each(["12.5", new Date(Date.now() + 60_000).toUTCString()])(
  "preserves the retry delay for a temporary rate limit (%s)",
  async (retryAfter) => {
    const response = failure(providerError("rate_limit_exceeded", "rate_limit_error", retryAfter));
    expect(response.status).toBe(429);
    expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await response.json()).toEqual({ error: expect.stringContaining("일시적으로 제한") });
  },
);

it.each([undefined, "invalid-private-header", "-5"])(
  "does not forward invalid retry headers (%s)",
  (retryAfter) => {
    const response = failure(providerError("private-unknown-code", undefined, retryAfter));
    expect(response.headers.get("Retry-After")).toBeNull();
    expect(console.error).toHaveBeenCalledWith("AI request failed", {
      status: 429,
      category: "rate_limit",
    });
  },
);

it("keeps the application's own allowance error distinct", async () => {
  const response = failure(new HttpError(429, "프로젝트 생성 횟수를 모두 사용했습니다.", 45));
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("45");
  expect(await response.json()).toEqual({ error: "프로젝트 생성 횟수를 모두 사용했습니다." });
  expect(console.error).not.toHaveBeenCalled();
});

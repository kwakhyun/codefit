import { api, ApiError } from "../client-api";
import type { Check } from "./types";

type Review = NonNullable<Check["review"]>;
/**
 * - done: the saved review.
 * - pending: the server accepted the evaluation and is still working (answers stay locked).
 * - unknown: the response was lost; the server may still finish (answers stay locked).
 * - failed: the server reported a definite failure; edited answers are accepted again.
 */
export type ReviewOutcome =
  | { state: "done"; review: Review }
  | { state: "pending" }
  | { state: "unknown"; message: string }
  | { state: "failed"; message: string };

const unknownMessage =
  "평가 결과를 아직 확인하지 못했습니다. 서버에서 처리 중일 수 있으니 ‘평가 상태 다시 확인’을 눌러 주세요. 확인은 AI를 다시 호출하거나 횟수를 차감하지 않습니다.";
const failedMessage =
  "평가를 완료하지 못했습니다. 답변을 수정하거나 같은 답변으로 다시 요청할 수 있습니다.";

/** Classifies a failed submit. Only a server-reported failure unlocks editing. */
export function reviewFailure(error: unknown): ReviewOutcome {
  if (error instanceof ApiError) {
    // In progress elsewhere (or the same answers already accepted): keep the lock and poll.
    if (error.status === 409) return { state: "pending" };
    // Gateways answer for a request whose outcome on the server is unknown.
    if ([502, 504].includes(error.status) || error.status === 0)
      return { state: "unknown", message: unknownMessage };
    return { state: "failed", message: error.message || failedMessage };
  }
  return { state: "unknown", message: unknownMessage };
}

/** Starts a background evaluation; the server accepts it before calling AI. */
export async function requestReview(
  id: string,
  answers: string[],
  scope: string,
  request: typeof api = api,
): Promise<ReviewOutcome> {
  try {
    const result = await request<Review | { status: "pending"; id: string }>("/api/project-check", {
      method: "PATCH",
      scope,
      body: { id, answers },
      background: true,
      quietGeneration: true,
      signal: AbortSignal.timeout(20_000),
    });
    return "status" in result ? { state: "pending" } : { state: "done", review: result };
  } catch (error) {
    return reviewFailure(error);
  }
}

/** Thrown through the global activity so a caller still knows whether editing may unlock. */
export class ReviewOutcomeError extends Error {
  constructor(public outcome: Exclude<ReviewOutcome, { state: "done" }>) {
    super(outcome.state === "pending" ? unknownMessage : outcome.message);
  }
}

/** One status read. `null` means the read itself failed and says nothing about the evaluation. */
export async function readReviewStatus(
  id: string,
  scope: string,
  request: typeof api = api,
  signal?: AbortSignal,
): Promise<ReviewOutcome | null> {
  try {
    const status = await request<
      | { status: "pending" }
      | { status: "done"; review: Review }
      | { status: "failed"; error?: string }
    >(`/api/project-check/${id}/review`, {
      scope,
      track: false,
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    });
    if (status.status === "done") return { state: "done", review: status.review };
    if (status.status === "failed")
      return { state: "failed", message: status.error || failedMessage };
    return { state: "pending" };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404)
      return {
        state: "failed",
        message:
          "접수된 평가 요청을 찾지 못했습니다. 답변을 확인한 뒤 다시 요청해 주세요. 평가 횟수는 차감되지 않았습니다.",
      };
    if (error instanceof ApiError && [401, 403].includes(error.status))
      return { state: "unknown", message: error.message };
    return null;
  }
}

/** Reads the evaluation status until it settles; never repeats the paid request. */
export async function pollReview(
  id: string,
  scope: string,
  options: {
    request?: typeof api;
    signal?: AbortSignal;
    timeoutMs?: number;
    intervalMs?: number;
  } = {},
): Promise<ReviewOutcome> {
  const { request = api, signal, timeoutMs = 150_000, intervalMs = 2500 } = options;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !signal?.aborted) {
    const outcome = await readReviewStatus(id, scope, request, signal);
    // A temporary network failure does not mean the server stopped evaluating.
    if (outcome && outcome.state !== "pending") return outcome;
    if (signal?.aborted) break;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return { state: "unknown", message: unknownMessage };
}

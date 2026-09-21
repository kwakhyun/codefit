import { expect, it, vi } from "vitest";
import { api, ApiError } from "../client-api";
import { prepareProjectLearning } from "./quick-start";
const input = { id: "check", url: "https://github.com/owner/repo", scope: "user:a" };
const overview = { scope: input.scope, aiReady: true, usage: { analysis: { remaining: 2 } } };
const check = { id: input.id };
it("one link creates analysis then both training tracks without a consent gate", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(overview)
    .mockRejectedValueOnce(new ApiError("missing", 404))
    .mockResolvedValueOnce(check)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ status: "done", result: {} });
  const progress = vi.fn();
  expect(await prepareProjectLearning(input, progress, request as typeof api)).toEqual(check);
  expect(progress).toHaveBeenCalledWith(check);
  expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toEqual([
    [
      "/api/project-check",
      {
        method: "POST",
        scope: input.scope,
        body: { requestId: input.id, url: input.url, description: "", source: "repository" },
      },
    ],
    [
      "/api/project-check/check/practice",
      { method: "POST", scope: input.scope, body: { stepwise: true } },
    ],
  ]);
});
it("recovers completed stages without new AI calls even when exhausted or AI is offline", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce({ ...overview, aiReady: false, usage: { analysis: { remaining: 0 } } })
    .mockResolvedValueOnce(check)
    .mockResolvedValueOnce({ status: "done", result: {} });
  await prepareProjectLearning(input, vi.fn(), request as typeof api);
  expect(request.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});
it("retries only practice when the earlier analysis was saved", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(overview)
    .mockResolvedValueOnce(check)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ status: "done", result: {} });
  await prepareProjectLearning(input, vi.fn(), request as typeof api);
  expect(request.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(1);
  expect(request.mock.calls.at(-1)?.[0]).toBe("/api/project-check/check/practice");
});
it("stops before paid requests on account changes or insufficient allowance", async () => {
  const changed = vi.fn().mockResolvedValueOnce({ ...overview, scope: "user:b" });
  await expect(prepareProjectLearning(input, vi.fn(), changed as typeof api)).rejects.toThrow(
    "계정이 바뀌었습니다",
  );
  const limited = vi
    .fn()
    .mockResolvedValueOnce({ ...overview, usage: { analysis: { remaining: 1 } } })
    .mockRejectedValueOnce(new ApiError("missing", 404));
  await expect(prepareProjectLearning(input, vi.fn(), limited as typeof api)).rejects.toThrow(
    "분석 2회",
  );
  expect(limited.mock.calls.some(([, options]) => options?.method === "POST")).toBe(false);
});

it("reports saved practice stages to the home while preserving the analysis", async () => {
  const request = vi
    .fn()
    .mockResolvedValueOnce(overview)
    .mockResolvedValueOnce(check)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({
      status: "pending",
      completed: 1,
      total: 2,
      label: "코드 이해 실습 저장 완료",
    })
    .mockResolvedValueOnce({ status: "done", result: {} });
  const stage = vi.fn();
  await prepareProjectLearning(input, vi.fn(), request as typeof api, stage);
  expect(stage).toHaveBeenCalledWith("1/2단계 완료 — 코드 이해 실습 저장 완료");
});

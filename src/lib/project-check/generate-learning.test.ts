import { expect, it, vi } from "vitest";
import { generateLearning } from "./generate-learning";
import { api } from "../client-api";
it("continues to the second durable stage and shares the in-flight generation", async () => {
  let release!: () => void;
  const request = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = () =>
            resolve({ status: "pending", completed: 1, total: 2, label: "코드 실습 저장" });
        }),
    )
    .mockResolvedValueOnce({ status: "done", result: { ready: true } });
  const stage = vi.fn();
  const first = generateLearning(
    "/api/project-check/one/practice",
    "user:a",
    stage,
    request as typeof api,
  );
  const second = generateLearning(
    "/api/project-check/one/practice",
    "user:a",
    vi.fn(),
    request as typeof api,
  );
  await Promise.resolve();
  release();
  expect(await first).toEqual({ ready: true });
  expect(await second).toEqual({ ready: true });
  expect(stage).toHaveBeenCalledWith("1/2단계 완료 — 코드 실습 저장");
  expect(request).toHaveBeenCalledTimes(2);
});

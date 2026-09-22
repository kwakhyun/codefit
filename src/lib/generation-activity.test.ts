import { beforeEach, expect, it, vi } from "vitest";
beforeEach(() => vi.resetModules());
it("deduplicates running work, updates stages, isolates scopes, and keeps completion visible", async () => {
  const m = await import("./generation-activity");
  let finish!: (value: number) => void;
  const operation = vi.fn(
    () =>
      new Promise<number>((resolve) => {
        finish = resolve;
      }),
  );
  const task = { id: "practice:1", scope: "user:a", label: "실습 생성", href: "/projects" };
  m.setGenerationScope(task.scope);
  const first = m.runGeneration(task, operation);
  const duplicate = m.runGeneration(task, operation);
  await Promise.resolve();
  expect(operation).toHaveBeenCalledTimes(1);
  m.updateGeneration(task.id, task.scope, "서비스 실습 생성 중");
  expect(m.generationSnapshot()[0].message).toBe("서비스 실습 생성 중");
  m.dismissGeneration(task.id);
  expect(m.generationSnapshot()).toHaveLength(1);
  m.setGenerationScope("user:b");
  expect(m.generationSnapshot()).toEqual([]);
  finish(42);
  expect(await first).toBe(42);
  expect(await duplicate).toBe(42);
  expect(m.generationSnapshot()).toEqual([]);
  m.setGenerationScope(task.scope);
  expect(m.generationSnapshot()[0].status).toBe("done");
  m.dismissGeneration(task.id);
  expect(m.generationSnapshot()).toEqual([]);
});
it("surfaces errors without retrying a paid operation", async () => {
  const m = await import("./generation-activity");
  m.setGenerationScope("user:a");
  const operation = vi.fn().mockRejectedValue(new Error("생성 실패"));
  await expect(
    m.runGeneration({ id: "failed", scope: "user:a", label: "실습", href: "/projects" }, operation),
  ).rejects.toThrow("생성 실패");
  expect(operation).toHaveBeenCalledTimes(1);
  expect(m.generationSnapshot()[0]).toMatchObject({ status: "failed", message: "생성 실패" });
});
it("tracks generation and review but excludes ordinary saves and reads", async () => {
  const { generationRequest: task } = await import("./generation-activity");
  expect(task("/api/project-check", "PATCH", { id: "one" })?.href).toBe("/project-check?check=one");
  expect(task("/api/generate", "POST", {})).not.toBeNull();
  expect(task("/api/project-check/one/dialogue", "POST", {})).not.toBeNull();
  expect(task("/api/project-check/one/practice", "PATCH", {})).toBeNull();
  expect(task("/api/project-check", "GET", {})).toBeNull();
});

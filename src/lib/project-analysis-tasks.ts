"use client";
import { z } from "zod";
import { api, ApiError, errorMessage } from "./client-api";
import type { Check, CheckOverview, createCheckSchema } from "./project-check/types";

const taskSchema = z.object({
  id: z.uuid(),
  scope: z.string().max(200),
  label: z.string().max(250),
  href: z
    .string()
    .max(300)
    .regex(/^\/(projects|project-check|project-practice|learn\/ai\/project)\?/),
  startedAt: z.number(),
  status: z.enum(["pending", "done", "failed", "disconnected"]),
  message: z.string().max(500).optional(),
});
export type AnalysisTask = z.infer<typeof taskSchema>;
const key = "codefit-analysis-tasks-v1";
const empty: AnalysisTask[] = [];
let tasks: AnalysisTask[] = empty;
let currentScope: string | null = null;
let visible: AnalysisTask[] = empty;
let loaded = false;
let sessionVersion = 0;
const listeners = new Set<() => void>();
const running = new Map<string, Promise<Check>>();
export const analysisSnapshot = () => visible;
export const analysisServerSnapshot = () => empty;
export function subscribeAnalysis(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish() {
  visible = tasks.filter((task) => task.scope === currentScope);
  try {
    sessionStorage.setItem(key, JSON.stringify(tasks));
  } catch {
    /* In-memory tracking still works. */
  }
  listeners.forEach((listener) => listener());
}
function update(id: string, scope: string, patch: Partial<AnalysisTask>) {
  tasks = tasks.map((task) =>
    task.id === id && task.scope === scope ? { ...task, ...patch } : task,
  );
  publish();
}
export function dismissAnalysis(id: string) {
  tasks = tasks.filter(
    (task) => task.id !== id || task.scope !== currentScope || task.status === "pending",
  );
  publish();
}
async function poll(task: AnalysisTask): Promise<Check> {
  const deadline = Date.now() + 150_000;
  while (Date.now() < deadline) {
    try {
      const result = await api<{ status: "pending" | "done" | "failed" }>(
        `/api/project-check/${task.id}/status`,
        { scope: task.scope, signal: AbortSignal.timeout(10_000) },
      );
      if (result.status === "done")
        return await api<Check>(`/api/project-check/${task.id}`, {
          scope: task.scope,
          signal: AbortSignal.timeout(10_000),
        });
      if (result.status === "failed")
        throw new ApiError(
          "분석을 완료하지 못했습니다. 입력한 주소와 이용 한도를 확인한 뒤 다시 시도해 주세요.",
          422,
        );
    } catch (error) {
      if (error instanceof ApiError && [401, 403, 404, 409, 422].includes(error.status))
        throw error;
      // A temporary network failure does not mean the server stopped its analysis.
    }
    await new Promise((resolve) => setTimeout(resolve, 2500));
  }
  throw new Error("분석 상태를 확인하지 못했습니다. 연결이 돌아오면 상태 확인을 눌러 주세요.");
}
function track(task: AnalysisTask, operation: () => Promise<Check>) {
  const identity = `${task.scope}:${task.id}`;
  const existing = running.get(identity);
  if (existing) return existing;
  const promise = operation()
    .then((result) => {
      update(task.id, task.scope, { status: "done", message: undefined });
      return result;
    })
    .catch((error) => {
      if (error instanceof ApiError && [401, 403, 409].includes(error.status)) {
        currentScope = null;
      }
      update(task.id, task.scope, {
        status: error instanceof ApiError ? "failed" : "disconnected",
        message: errorMessage(error),
      });
      throw error;
    })
    .finally(() => running.delete(identity));
  running.set(identity, promise);
  return promise;
}
export async function syncAnalysisSession() {
  const version = ++sessionVersion;
  if (!loaded) {
    loaded = true;
    try {
      const saved = z
        .array(taskSchema)
        .max(30)
        .safeParse(JSON.parse(sessionStorage.getItem(key) || "[]"));
      if (saved.success)
        tasks = saved.data.filter((task) => Date.now() - task.startedAt < 86_400_000);
    } catch {
      /* Ignore invalid browser records. */
    }
  }
  if (!tasks.length) return;
  try {
    const session = await api<CheckOverview>("/api/project-check", {
      scope: null,
      signal: AbortSignal.timeout(10_000),
    });
    if (version !== sessionVersion) return;
    currentScope = session.scope;
    publish();
    for (const task of visible.filter((task) => task.status === "pending")) {
      void track(task, () => poll(task)).catch(() => {});
    }
  } catch {
    if (version !== sessionVersion) return;
    currentScope = null;
    publish();
  }
}
export function refreshAnalysis(task: AnalysisTask) {
  update(task.id, task.scope, { status: "pending", message: undefined });
  void track(task, () => poll(task)).catch(() => {});
}
export function startProjectAnalysis(
  input: z.infer<typeof createCheckSchema>,
  scope: string,
  href = `/project-check?check=${input.requestId}`,
): Promise<Check> {
  const identity = `${scope}:${input.requestId}`;
  const existing = running.get(identity);
  if (existing) return existing;
  const task: AnalysisTask = {
    id: input.requestId,
    scope,
    label:
      `${new URL(input.url).hostname}${new URL(input.url).pathname === "/" ? "" : new URL(input.url).pathname}`.slice(
        0,
        250,
      ),
    href,
    startedAt: Date.now(),
    status: "pending",
  };
  sessionVersion++;
  currentScope = scope;
  tasks = [...tasks.filter((item) => !(item.id === task.id && item.scope === scope)), task];
  publish();
  return track(task, async () => {
    try {
      const response = await api<Check | { status: "pending"; id: string }>("/api/project-check", {
        method: "POST",
        scope,
        body: input,
        background: true,
        signal: AbortSignal.timeout(15_000),
      });
      if (!("status" in response)) return response;
    } catch (error) {
      if (error instanceof ApiError && (error.status < 500 || error.status === 503)) throw error;
      // The acceptance response may be lost. Read status, never repeat paid work automatically.
    }
    return poll(task);
  });
}

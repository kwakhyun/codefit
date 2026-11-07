"use client";
export type GenerationTask = {
  id: string;
  scope: string;
  label: string;
  href: string;
  status: "pending" | "done" | "failed";
  message?: string;
};
const empty: GenerationTask[] = [];
let tasks: GenerationTask[] = [];
let visible = empty;
let scope: string | undefined;
let revision = 0;
const listeners = new Set<() => void>();
const running = new Map<string, Promise<unknown>>();
export const generationSnapshot = () => visible;
export const generationServerSnapshot = () => empty;
export const generationRevision = () => revision;
export const generationServerRevision = () => 0;
/** Both practice tracks share one result; a different project still needs its notice. */
export function isGenerationResultPage(href: string, pathname: string, search: string) {
  const target = new URL(href, "https://codefit.local");
  if (target.pathname !== pathname) return false;
  const current = new URLSearchParams(search);
  return [...target.searchParams].every(
    ([key, value]) =>
      (pathname === "/project-practice" && key === "mode") || current.get(key) === value,
  );
}
export function subscribeGeneration(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish() {
  visible = tasks.filter((t) => t.scope === scope);
  listeners.forEach((l) => l());
}
export function setGenerationScope(next: string | undefined) {
  scope = next;
  publish();
}
export function dismissGeneration(id: string) {
  tasks = tasks.filter((t) => t.id !== id || t.scope !== scope || t.status === "pending");
  publish();
}
export function updateGeneration(id: string, owner: string, label: string) {
  tasks = tasks.map((t) => (t.id === id && t.scope === owner ? { ...t, message: label } : t));
  publish();
}
export function runGeneration<T>(
  task: Omit<GenerationTask, "status">,
  operation: () => Promise<T>,
  resultHref?: (value: T) => string | undefined,
): Promise<T> {
  const key = `${task.scope}:${task.id}`;
  const existing = running.get(key);
  if (existing) return existing as Promise<T>;
  tasks = [...tasks.filter((t) => `${t.scope}:${t.id}` !== key), { ...task, status: "pending" }];
  publish();
  const finish = (status: "done" | "failed", message?: string) => {
    tasks = tasks.map((t) => (`${t.scope}:${t.id}` === key ? { ...t, status, message } : t));
    revision++;
    publish();
    if (typeof window !== "undefined") window.dispatchEvent(new Event("codefit:analysis-changed"));
  };
  const result = Promise.resolve()
    .then(operation)
    .then(
      (value) => {
        const href = resultHref?.(value);
        if (href) tasks = tasks.map((t) => (`${t.scope}:${t.id}` === key ? { ...t, href } : t));
        finish("done");
        return value;
      },
      (error) => {
        finish(
          "failed",
          error instanceof Error ? error.message : "연결 상태를 확인한 뒤 다시 시도해 주세요.",
        );
        throw error;
      },
    )
    .finally(() => running.delete(key));
  running.set(key, result);
  return result;
}
/**
 * Only long-running AI requests are tracked; saves, the non-AI preparation of a 보완 답변 and
 * short checks (security headers, ownership files) stay quiet. Answer evaluation runs in the
 * background and is tracked by its screen with the label "답변 평가".
 */
export function generationRequest(url: string, method: string, body: unknown) {
  void body;
  if (method !== "POST") return null;
  const dialogue = url.match(/^\/api\/project-check\/([^/]+)\/dialogue$/);
  if (dialogue) return { label: "코드 대화", href: `/project-check?check=${dialogue[1]}` };
  if (url === "/api/generate") return { label: "맞춤 연습 문제 생성", href: "/?view=browse" };
  if (/^\/api\/(problems|learn)\/[^/]+\/(review|coach|lab)$/.test(url))
    return {
      label: "학습 피드백 생성",
      href: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
    };
  return null;
}

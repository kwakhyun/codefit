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
/** Only expensive generation requests are tracked; normal saves stay quiet. */
export function generationRequest(url: string, method: string, body: unknown) {
  const input = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const project = url.match(/^\/api\/project-check\/([^/]+)\/(dialogue|follow-up)$/);
  if (project && method === "POST")
    return {
      label: project[2] === "dialogue" ? "코드 설명 피드백 생성" : "프로젝트 후속 점검 생성",
      href: `/project-check?check=${project[1]}`,
    };
  if (url === "/api/project-check" && method === "PATCH" && typeof input.id === "string")
    return { label: "프로젝트 답변 피드백 생성", href: `/project-check?check=${input.id}` };
  if (method !== "POST") return null;
  if (url === "/api/generate") return { label: "맞춤 연습 문제 생성", href: "/?view=browse" };
  if (url.startsWith("/api/security-check"))
    return { label: "서비스 보안 점검", href: "/security-check" };
  if (/^\/api\/(problems|learn)\/[^/]+\/(review|coach|lab)$/.test(url))
    return {
      label: "학습 피드백 생성",
      href: typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
    };
  return null;
}

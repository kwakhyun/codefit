import { problemUrl } from "./library-state";
import { generationRequest, runGeneration, setGenerationScope } from "./generation-activity";
import { trackRequest } from "./request-progress";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: { kind?: string; current?: unknown },
  ) {
    super(message);
  }
}
let workspaceScope: string | undefined;
export function setWorkspaceScope(scope: string) {
  workspaceScope = scope;
  setGenerationScope(scope);
}
export async function api<T>(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    signal?: AbortSignal;
    keepalive?: boolean;
    background?: boolean;
    quietGeneration?: boolean;
    // null explicitly discovers the current session without a stale workspace header.
    scope?: string | null;
  },
): Promise<T> {
  const scope = options?.scope === null ? undefined : options?.scope || workspaceScope;
  const task =
    !options?.quietGeneration && generationRequest(url, options?.method || "GET", options?.body);
  if (task && scope && typeof window !== "undefined") {
    return runGeneration(
      { ...task, id: `${url}:${JSON.stringify(options?.body)}`, scope },
      () => api<T>(url, { ...options, scope, quietGeneration: true }),
      (value) => {
        const result = value as { id?: string; problem?: { id?: string } };
        if (url === "/api/generate" && typeof result?.problem?.id === "string")
          return problemUrl(result.problem.id, "/?view=browse");
        if (url.endsWith("/follow-up") && typeof result?.id === "string")
          return `/project-check?check=${encodeURIComponent(result.id)}`;
      },
    );
  }
  const finish = trackRequest();
  try {
    const response = await fetch(url, {
      method: options?.method || "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        ...(options?.body !== undefined && { "Content-Type": "application/json" }),
        ...(scope && { "X-Codefit-Workspace": scope }),
        ...(options?.background && { Prefer: "respond-async" }),
      },
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options?.signal || AbortSignal.timeout(115_000),
      keepalive: options?.keepalive,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new ApiError(
        "서버 응답을 읽지 못했습니다. 연결 상태를 확인해 주세요.",
        response.status,
      );
    }
    if (
      [401, 403].includes(response.status) ||
      (response.status === 409 &&
        (data?.kind === "workspace_changed" || String(data?.error).includes("계정 정보를")))
    )
      setGenerationScope(undefined);
    if (!response.ok)
      throw new ApiError(data.error || "요청에 실패했습니다.", response.status, data);
    if (typeof data?.scope === "string") setGenerationScope(data.scope);
    return data as T;
  } finally {
    finish();
  }
}
export function errorMessage(error: unknown) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return "응답 대기 시간이 지났습니다. 보관함이나 검토 이력을 새로고침한 뒤 다시 시도해 주세요.";
  return error instanceof Error ? error.message : "연결 상태를 확인하고 다시 시도해 주세요.";
}
export const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

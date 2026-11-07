import { problemUrl } from "./library-state";
import { generationRequest, runGeneration, setGenerationScope } from "./generation-activity";
import { trackRequest } from "./request-progress";
import { PRACTICE_REQUEST_TIMEOUT_MS } from "./project-check/practice-generation-policy";
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
    /** false keeps autosave, polling and other background calls out of the global progress bar. */
    track?: boolean;
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
  const finish = options?.track === false ? () => {} : trackRequest();
  let failed = false;
  try {
    const timeout =
      options?.method === "POST" && /^\/api\/project-check\/[^/?]+\/practice$/.test(url)
        ? PRACTICE_REQUEST_TIMEOUT_MS
        : 115_000;
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
      signal: options?.signal
        ? AbortSignal.any([options.signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
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
  } catch (error) {
    // Leaving a screen cancels its requests; only real failures count as failed.
    failed = !options?.signal?.aborted;
    throw error;
  } finally {
    finish(!failed);
  }
}
export const OFFLINE_MESSAGE = "인터넷 연결이 끊겼습니다. 연결을 확인한 뒤 다시 시도해 주세요.";
const CONNECTION_MESSAGE =
  "서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.";
// Chrome, Safari, Firefox and Node phrase the same fetch failure differently.
const NETWORK_FAILURE =
  /failed to fetch|load failed|networkerror|network request failed|fetch failed/i;
/** User-facing Korean copy for any thrown value; raw browser messages never reach the screen. */
export function errorMessage(error: unknown) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError"))
    return "응답 대기 시간이 지났습니다. 화면을 새로고침해 결과를 확인한 뒤 다시 시도해 주세요.";
  if (error instanceof TypeError) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return OFFLINE_MESSAGE;
    return NETWORK_FAILURE.test(error.message)
      ? CONNECTION_MESSAGE
      : "요청을 처리하지 못했습니다. 화면을 새로고침한 뒤 다시 시도해 주세요.";
  }
  return error instanceof Error ? error.message : "연결 상태를 확인하고 다시 시도해 주세요.";
}
export const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

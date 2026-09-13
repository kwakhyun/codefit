export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(url: string, options?: { method?: string; body?: unknown; signal?: AbortSignal; keepalive?: boolean }): Promise<T> {
  const response = await fetch(url, {
    method: options?.method || "GET", credentials: "same-origin", cache: "no-store",
    headers: options?.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options?.signal || AbortSignal.timeout(115_000), keepalive: options?.keepalive,
  });
  let data;
  try { data = await response.json(); }
  catch { throw new ApiError("서버 응답을 읽지 못했습니다. 연결 상태를 확인해 주세요.", response.status); }
  if (!response.ok) throw new ApiError(data.error || "요청에 실패했습니다.", response.status);
  return data as T;
}
export function errorMessage(error: unknown) {
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "응답 대기 시간이 지났습니다. 보관함이나 검토 이력을 새로고침한 뒤 다시 시도해 주세요.";
  return error instanceof Error ? error.message : "연결 상태를 확인하고 다시 시도해 주세요.";
}
export const dateLabel = (iso: string) => new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

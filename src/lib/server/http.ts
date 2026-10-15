import { CodeConflict, RevisionRequired, RequestMismatch, StaleJob } from "./write-conflicts";
import OpenAI from "openai";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
  }
}
export async function readBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  maxBytes = 100_000,
): Promise<T> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "JSON 형식으로 요청해 주세요.");
  if (Number(request.headers.get("content-length") || 0) > maxBytes)
    throw new HttpError(413, "입력 내용이 너무 큽니다.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "입력 내용을 확인해 주세요.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new HttpError(413, "입력 내용이 너무 큽니다.");
    }
    chunks.push(value);
  }
  try {
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const parsed = schema.safeParse(raw);
    if (!parsed.success)
      throw new HttpError(400, parsed.error.issues[0]?.message || "입력 내용을 확인해 주세요.");
    return parsed.data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "올바른 JSON 형식이 아닙니다.");
  }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
export function failure(error: unknown) {
  if (error instanceof CodeConflict)
    return json({ error: error.message, kind: "code_conflict", current: error.current }, 409);
  if (error instanceof RevisionRequired)
    return json(
      { error: "코드 기준 버전이 필요합니다. 초안을 보관한 뒤 화면을 새로고침해 주세요." },
      428,
    );
  if (error instanceof RequestMismatch)
    return json(
      { error: "이 요청 ID는 다른 내용에 사용되었습니다. 새 요청으로 다시 시도해 주세요." },
      409,
    );
  if (error instanceof StaleJob)
    return json(
      {
        error:
          "요청 처리 시간이 만료되었거나 새 요청으로 대체됐습니다. 보관함이나 검토 기록에서 결과를 확인해 주세요.",
      },
      409,
    );
  if (error instanceof HttpError) {
    const response = json({ error: error.message }, error.status);
    if (error.retryAfter) response.headers.set("Retry-After", String(error.retryAfter));
    return response;
  }
  if (error instanceof OpenAI.APIError) {
    const status = error.status;
    const quotaCodes = [
      "insufficient_quota",
      "credit_balance_exhausted",
      "organization_spend_limit_exceeded",
      "project_spend_limit_exceeded",
      "organization_usage_limit_exceeded",
    ];
    const quota =
      status === 429 &&
      (error.type === "insufficient_quota" || quotaCodes.includes(error.code ?? ""));
    // Log only known categories, never provider messages, bodies or credentials.
    const category = quota
      ? quotaCodes.includes(error.code ?? "")
        ? error.code
        : "insufficient_quota"
      : status === 429
        ? "rate_limit"
        : "provider_error";
    console.error("AI request failed", { status, category });
    if (quota)
      return json(
        {
          error:
            "AI 서비스 운영 한도에 도달해 요청을 처리하지 못했습니다. 서비스 운영자의 한도 조정이 필요합니다. 반복해서 요청하지 말고 복구 후 다시 시도해 주세요.",
        },
        503,
      );
    if (status === 429) {
      const response = json(
        {
          error: "AI 요청이 몰려 일시적으로 제한됐습니다. 잠시 기다린 뒤 다시 시도해 주세요.",
        },
        429,
      );
      const retryAfter = error.headers?.get("retry-after");
      // Copy only a valid delay or HTTP date, not arbitrary upstream header text.
      if (retryAfter) {
        const seconds = /^\d+(\.\d+)?$/.test(retryAfter)
          ? Math.ceil(Number(retryAfter))
          : Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000);
        if (Number.isFinite(seconds) && seconds > 0)
          response.headers.set("Retry-After", String(seconds));
      }
      return response;
    }
    if (status === 401 || status === 403)
      return json(
        {
          error:
            "AI 서비스 연결에 문제가 있어 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        },
        503,
      );
    if (status === 404)
      return json(
        { error: "현재 설정된 AI 모델을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요." },
        503,
      );
    return json({ error: "AI 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요." }, 502);
  }
  console.error("Workspace request failed", {
    type: error instanceof Error ? error.constructor.name : "unknown",
  });
  return json(
    { error: "요청을 완료하지 못했습니다. 작성 내용은 그대로 두고 다시 시도해 주세요." },
    500,
  );
}

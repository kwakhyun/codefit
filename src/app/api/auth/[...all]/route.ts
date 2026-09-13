import { getAuth } from "@/lib/server/auth";
import { failure, HttpError } from "@/lib/server/http";
import { isAllowedOrigin } from "@/lib/server/request-origin";
export const runtime = "nodejs";
async function handle(request: Request) {
  try {
    if (!isAllowedOrigin(request, process.env.AUTH_BASE_URL))
      throw new HttpError(403, "다른 사이트에서 시작된 로그인 요청은 허용하지 않습니다.");
    const auth = await getAuth();
    if (!auth)
      throw new HttpError(503, "로그인 연결을 준비 중입니다. 문제 풀이는 바로 이용할 수 있습니다.");
    const response = await auth.handler(request);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return failure(error);
  }
}
export const GET = handle;
export const POST = handle;

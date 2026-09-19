import { session } from "./session";
import { HttpError } from "./http";
export async function projectMember(request: Request) {
  const current = await session(request);
  if (!current.user)
    throw new HttpError(401, "프로젝트 이해도 점검은 로그인 후 이용할 수 있습니다.");
  if (request.headers.get("x-codefit-workspace") !== current.scope)
    throw new HttpError(409, "계정 정보를 새로 확인한 뒤 다시 시도해 주세요.");
  return current;
}

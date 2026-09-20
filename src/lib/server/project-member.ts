import { session } from "./session";
import { HttpError } from "./http";
export async function projectMember(request: Request) {
  const current = await session(request);
  if (request.headers.get("x-codefit-workspace") !== current.scope)
    throw new HttpError(409, "계정 정보를 새로 확인한 뒤 다시 시도해 주세요.");
  return current;
}

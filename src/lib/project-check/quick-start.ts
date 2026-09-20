import { api, ApiError } from "../client-api";
import type { Check, CheckOverview } from "./types";
import type { GeneratedPractice } from "./generated-practice";
export async function prepareProjectLearning(
  input: { id: string; url: string; scope: string },
  onAnalyzed: (check: Check) => void,
  request: typeof api = api,
) {
  const { id, url, scope } = input;
  const overview = await request<CheckOverview>("/api/project-check", { scope });
  if (overview.scope !== scope)
    throw new Error("계정이 바뀌었습니다. 화면을 새로고침한 뒤 다시 시작해 주세요.");
  let check: Check | undefined;
  // Restore a completed stage first so a retry never spends another analysis credit.
  try {
    check = await request<Check>(`/api/project-check/${id}`, { scope });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  if (!check) {
    if (!overview.aiReady)
      throw new Error("AI 연결을 준비 중입니다. 기존 기록이나 샘플로 먼저 연습해 주세요.");
    if (overview.usage.analysis.remaining < 2)
      throw new Error(
        "점검과 두 가지 연습을 함께 준비하려면 분석 2회가 필요합니다. 기존 프로젝트 기록에서 이어가거나 한도 초기화 후 다시 이용해 주세요.",
      );
    check = await request<Check>("/api/project-check", {
      method: "POST",
      scope,
      body: { requestId: id, url, description: "", source: "repository" },
    });
  }
  onAnalyzed(check);
  const saved = await request<GeneratedPractice | null>(`/api/project-check/${check.id}/practice`, {
    scope,
  });
  if (!saved)
    await request<GeneratedPractice>(`/api/project-check/${check.id}/practice`, {
      method: "POST",
      scope,
      body: {},
    });
  return check;
}

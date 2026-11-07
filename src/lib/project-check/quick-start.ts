import { generateLearning } from "./generate-learning";
import { api, ApiError } from "../client-api";
import { startProjectAnalysis } from "../project-analysis-tasks";
import type { Check, CheckOverview } from "./types";
import type { GeneratedPractice } from "./generated-practice";
/** One analysis plus one generation of both practice tracks. */
export const QUICK_START_COST = 2;
type Analyze = (
  input: { requestId: string; url: string; description: string; source: "repository" },
  scope: string,
) => Promise<Check>;
export async function prepareProjectLearning(
  input: { id: string; url: string; scope: string },
  onAnalyzed: (check: Check) => void,
  request: typeof api = api,
  onStage: (label: string) => void = () => {},
  // The same background job and global activity as /project-check; leaving the home keeps it running.
  analyze: Analyze = (body, scope) => startProjectAnalysis(body, scope),
) {
  const { id, url, scope } = input;
  const overview = await request<CheckOverview>("/api/project-check", { scope, track: false });
  if (overview.scope !== scope)
    throw new Error("계정이 바뀌었습니다. 화면을 새로고침한 뒤 다시 시작해 주세요.");
  let check: Check | undefined;
  // Restore a completed stage first so a retry never spends another analysis credit.
  try {
    check = await request<Check>(`/api/project-check/${id}`, { scope, track: false });
  } catch (e) {
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  if (!check) {
    if (!overview.aiReady)
      throw new Error("AI 연결을 준비 중입니다. 기존 기록이나 샘플로 먼저 연습해 주세요.");
    if (overview.usage.analysis.remaining < QUICK_START_COST)
      throw new Error(
        `점검과 두 가지 연습을 함께 준비하려면 분석 횟수 ${QUICK_START_COST}회가 필요합니다. 기존 프로젝트에서 이어가거나 분석 횟수가 다시 채워진 뒤 이용해 주세요.`,
      );
    check = await analyze({ requestId: id, url, description: "", source: "repository" }, scope);
  }
  onAnalyzed(check);
  const saved = await request<GeneratedPractice | null>(`/api/project-check/${check.id}/practice`, {
    scope,
    track: false,
  });
  if (!saved)
    await generateLearning<GeneratedPractice>(
      `/api/project-check/${check.id}/practice`,
      scope,
      onStage,
      request,
    );
  return check;
}

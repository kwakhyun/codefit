import { runGeneration, updateGeneration, setGenerationScope } from "../generation-activity";
import { api } from "../client-api";
import type { LearningGeneration } from "./learning-generation";

/** Each completed request is durably saved. Calling again resumes the missing stage. */
export async function generateLearning<T>(
  endpoint: string,
  scope: string,
  onStage: (label: string) => void,
  request: typeof api = api,
): Promise<T> {
  const match = endpoint.match(/\/project-check\/([^/]+)\/(practice|workshop)$/);
  const label =
    match?.[2] === "workshop" ? "프로젝트 AI 학습 생성" : "코드 이해 훈련과 서비스 동작 실습 생성";
  const href =
    match?.[2] === "workshop"
      ? `/learn/ai/project?check=${match[1]}`
      : `/project-practice?check=${match?.[1]}&mode=code`;
  if (typeof window !== "undefined") setGenerationScope(scope);
  return runGeneration({ id: endpoint, scope, label, href }, async () => {
    for (let step = 0; step < 2; step++) {
      const response = await request<LearningGeneration<T>>(endpoint, {
        method: "POST",
        scope,
        body: { stepwise: true },
      });
      if (response.status === "done") return response.result;
      const message = `1/2단계 완료 — ${response.label}`;
      updateGeneration(endpoint, scope, message);
      onStage(message);
    }
    throw new Error("완료한 단계는 저장됐습니다. 이어서 생성 버튼으로 남은 단계를 진행해 주세요.");
  });
}

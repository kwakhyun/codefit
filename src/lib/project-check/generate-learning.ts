import { api } from "../client-api";
import type { LearningGeneration } from "./learning-generation";

/** Each completed request is durably saved. Calling again resumes the missing stage. */
export async function generateLearning<T>(
  endpoint: string,
  scope: string,
  onStage: (label: string) => void,
  request: typeof api = api,
): Promise<T> {
  for (let step = 0; step < 2; step++) {
    const response = await request<LearningGeneration<T>>(endpoint, {
      method: "POST",
      scope,
      body: { stepwise: true },
    });
    if (response.status === "done") return response.result;
    onStage(`1/2단계 완료 — ${response.label}`);
  }
  throw new Error("완료한 단계는 저장됐습니다. 이어서 생성 버튼으로 남은 단계를 진행해 주세요.");
}

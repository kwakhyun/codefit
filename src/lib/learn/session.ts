import type { Progress } from "../problem";

/** Private response returned by GET /api/learn/[id]. */
export type LearningSession = {
  scope: string;
  signedIn: boolean;
  aiReady: boolean;
  progress: Progress | null;
};

export function learningStorageDescription(signedIn: boolean) {
  return signedIn
    ? "학습 기록은 계정에 저장됩니다. 같은 계정으로 로그인하면 다른 기기에서도 이어서 볼 수 있습니다."
    : "게스트 학습 기록은 서버에 저장하고, 이 브라우저의 쿠키로 찾습니다. 다른 브라우저를 쓰거나 쿠키를 지우면 기존 기록에 접근할 수 없습니다.";
}

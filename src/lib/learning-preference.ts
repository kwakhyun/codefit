export type LearningPreference = {
  experience: "beginner" | "developer";
  purpose: "learn" | "project";
};
export const defaultPreference: LearningPreference = { experience: "beginner", purpose: "learn" };
export function parsePreference(raw: string | null): LearningPreference {
  try {
    const value = JSON.parse(raw || "null");
    if (
      ["beginner", "developer"].includes(value?.experience) &&
      ["learn", "project"].includes(value?.purpose)
    )
      return { experience: value.experience, purpose: value.purpose };
  } catch {}
  return defaultPreference;
}
const destinations = {
  learn: {
    href: "/learn",
    label: "서비스 원리 배우기",
    description:
      "버튼을 눌러 저장과 접근 권한의 작동 원리를 확인하세요. 로그인 없이 5분부터 시작합니다.",
  },
  handoff: {
    href: "/handoff",
    label: "AI 코드 이해 훈련",
    description: "실행 결과를 예상하고 코드를 수정해 검증하세요. 로그인 없이 이용할 수 있습니다.",
  },
  project: {
    href: "/project-check",
    label: "내 프로젝트 점검",
    description:
      "내 서비스로 질문받고 설계 설명을 보완하세요. 예시는 로그인 없이, 실제 분석은 로그인 후 24시간에 2개까지 가능합니다.",
  },
  security: {
    href: "/security-check",
    label: "서비스 보안 점검",
    description: "공개 링크의 보안 설정을 확인하고 내 서비스에서 검증할 항목을 정리하세요.",
  },
};
export function preferredDestinations(preference: LearningPreference) {
  const order: (keyof typeof destinations)[] =
    preference.purpose === "project"
      ? [
          "project",
          "security",
          preference.experience === "developer" ? "handoff" : "learn",
          preference.experience === "developer" ? "learn" : "handoff",
        ]
      : preference.experience === "developer"
        ? ["handoff", "project", "security", "learn"]
        : ["learn", "handoff", "project", "security"];
  return order.map((key) => destinations[key]);
}

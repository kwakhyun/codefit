import { allowanceSummary } from "./ai-access";
import { learnerTypes } from "./learner-types";
export type LearningPreference = {
  experience: "beginner" | "developer";
  purpose: "learn" | "project" | "ai";
};
export const defaultPreference: LearningPreference = { experience: "beginner", purpose: "project" };
export function parsePreference(raw: string | null): LearningPreference {
  try {
    const value = JSON.parse(raw || "null");
    if (value?.version === 3) {
      const type = learnerTypes.find((item) => item.id === value.type);
      if (type) return { experience: type.experience, purpose: type.purpose };
      return defaultPreference;
    }
    // Existing project-oriented modes merge into the service workspace.
    if (value?.version === 2) {
      if (value.type === "coder") return { experience: "developer", purpose: "learn" };
      if (value.type === "starter") return { experience: "beginner", purpose: "ai" };
      return defaultPreference;
    }
    if (
      ["beginner", "developer"].includes(value?.experience) &&
      ["learn", "project"].includes(value?.purpose)
    ) {
      if (value.purpose === "project") return defaultPreference;
      return {
        experience: value.experience,
        purpose: value.experience === "beginner" ? "ai" : "learn",
      };
    }
  } catch {}
  return defaultPreference;
}
const destinations = {
  browse: {
    href: "/?view=browse",
    label: "분야별 코딩 연습",
    description: "분야와 난이도를 골라 직접 코드를 작성하세요.",
  },
  ai: {
    href: "/learn/ai",
    label: "AI 실무 배우기",
    description: "AI 도구의 개념을 익히고 모의 실습으로 활용 방법을 확인하세요.",
  },
  aiProject: {
    href: "/learn/ai/project",
    label: "내 프로젝트 AI 워크숍",
    description: "저장소 코드에서 AI를 적용할 곳을 찾고 작은 실험으로 확인하세요.",
  },
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
    description: `내 서비스로 질문받고 설계 설명을 보완하세요. 분석 횟수는 ${allowanceSummary("analysis")}입니다.`,
  },
  security: {
    href: "/security-check",
    label: "서비스 보안 점검",
    description: "공개 링크의 보안 설정을 확인하고 내 서비스에서 검증할 항목을 정리하세요.",
  },
};
type DestinationKey = keyof typeof destinations;
/** Menu groups follow what the tools do; the chosen workspace only decides which group leads. */
const groups = {
  service: { caption: "내 서비스 점검", items: ["project", "security"] },
  ai: { caption: "AI 활용", items: ["ai", "aiProject"] },
  code: { caption: "코드와 원리", items: ["handoff", "browse", "learn"] },
} satisfies Record<string, { caption: string; items: DestinationKey[] }>;
export function navigationGroups(preference: LearningPreference) {
  const order: (keyof typeof groups)[] =
    preference.purpose === "ai"
      ? ["ai", "code", "service"]
      : preference.purpose === "learn"
        ? ["code", "ai", "service"]
        : ["service", "ai", "code"];
  return order.map((id) => {
    const items: DestinationKey[] =
      id === "code" && preference.purpose === "learn"
        ? ["browse", "handoff", "learn"]
        : groups[id].items;
    return { id, caption: groups[id].caption, items: items.map((key) => destinations[key]) };
  });
}
export function preferredDestinations(preference: LearningPreference) {
  return navigationGroups(preference).flatMap((group) => group.items);
}
/** Mirrors the browser choice so the server renders the same menu order on the first paint. */
export const WORKSPACE_COOKIE = "codefit-workspace";
export function preferenceSeed(cookieValue: string | undefined) {
  const type = learnerTypes.find((item) => item.id === cookieValue);
  return type ? JSON.stringify({ version: 3, type: type.id }) : null;
}

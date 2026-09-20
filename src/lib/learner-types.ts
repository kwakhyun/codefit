import type { LearningPreference } from "./learning-preference";
export const learnerTypes = [
  {
    id: "service",
    name: "서비스 점검실",
    audience: "만든 서비스가 있다면",
    description: "내 프로젝트의 설계와 보안을 점검하고, 직접 확인할 일을 정리해요.",
    experience: "beginner",
    purpose: "project",
    image: "persona-service",
    title: "내 서비스의 설계와 동작을 점검해 보세요",
    group: "내 서비스 점검",
    secondary: "배우며 보완하기",
  },
  {
    id: "ai",
    name: "AI 워크숍",
    audience: "AI를 일에 활용하고 싶다면",
    description: "AI 도구의 쓰임새를 익히고, 내 업무에 맞는 활용 방법을 연습해요.",
    experience: "beginner",
    purpose: "ai",
    image: "persona-ai",
    title: "내 업무에 맞는 AI 활용법을 배워보세요",
    group: "AI 실무 학습",
    secondary: "프로젝트로 확장하기",
  },
  {
    id: "code",
    name: "코딩 트레이닝",
    audience: "직접 코드를 읽고 고친다면",
    description: "분야별 문제를 풀고, 실행 결과를 비교하며 코드를 개선해요.",
    experience: "developer",
    purpose: "learn",
    image: "persona-code",
    title: "문제를 풀며 코딩 실력을 키워보세요",
    group: "코딩 연습",
    secondary: "실제 서비스에 적용하기",
  },
] as const;
export type LearnerType = (typeof learnerTypes)[number]["id"];
export function learnerType(preference: LearningPreference) {
  return learnerTypes.find((item) => item.purpose === preference.purpose) || learnerTypes[0];
}
export function preferenceForType(id: LearnerType): LearningPreference {
  const item = learnerTypes.find((item) => item.id === id)!;
  return { experience: item.experience, purpose: item.purpose };
}

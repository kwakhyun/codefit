import type { LearningPreference } from "./learning-preference";
export const learnerTypes = [
  {
    id: "starter",
    name: "원리 입문",
    audience: "코딩이 처음이라면",
    description: "직접 눌러보며 저장과 권한의 원리를 배워요.",
    experience: "beginner",
    purpose: "learn",
    image: "app-foundations",
    title: "작동 원리를 직접 확인해 보세요",
    group: "기초부터 차근차근",
    secondary: "다음에 도전하기",
  },
  {
    id: "coder",
    name: "코드 훈련",
    audience: "코드를 읽고 고친다면",
    description: "AI 코드의 결과를 예상하고 수정해 검증해요.",
    experience: "developer",
    purpose: "learn",
    image: "read-code",
    title: "예상하고, 실행하고, 코드를 고쳐보세요",
    group: "코드로 연습하기",
    secondary: "함께 쓰는 도구",
  },
  {
    id: "maker",
    name: "내 서비스 이해",
    audience: "AI로 첫 서비스를 만들었다면",
    description: "내 서비스의 빈틈을 찾고 수정 요청을 연습해요.",
    experience: "beginner",
    purpose: "project",
    image: "debug-lab",
    title: "내 서비스가 어떻게 작동하는지 설명해 보세요",
    group: "내 서비스를 이해하기",
    secondary: "코드와 보안 더 살펴보기",
  },
  {
    id: "builder",
    name: "배포 전 점검",
    audience: "직접 구현하고 배포한다면",
    description: "설계와 보안 설정을 점검하고 확인 결과를 남겨요.",
    experience: "developer",
    purpose: "project",
    image: "container",
    title: "배포 전에 설계와 검증 근거를 점검하세요",
    group: "설계와 배포 점검",
    secondary: "코드와 원리 보완하기",
  },
] as const;
export type LearnerType = (typeof learnerTypes)[number]["id"];
export function learnerType(preference: LearningPreference) {
  return learnerTypes.find(
    (item) => item.experience === preference.experience && item.purpose === preference.purpose,
  )!;
}
export function preferenceForType(id: LearnerType): LearningPreference {
  const item = learnerTypes.find((item) => item.id === id)!;
  return { experience: item.experience, purpose: item.purpose };
}

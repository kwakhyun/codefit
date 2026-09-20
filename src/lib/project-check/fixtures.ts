import { AREAS, type Analysis, type Assessment, type StoredCheck } from "./types";
/** Synthetic examples shared by isolated tests; never substituted for an AI response in the service. */
export const fixtureAnalysis: Analysis = {
  title: "예약 서비스 설계 점검",
  summary:
    "공개 페이지에서 회의실 예약과 예약 취소 안내를 확인했습니다. 실제 저장 방식과 접근 권한은 화면만으로 알 수 없습니다.",
  questions: AREAS.map((area) => ({
    area,
    question: `${area} 관점에서 회의실을 예약할 때 어떤 처리가 필요한가요? 이유와 확인 방법을 설명해 주세요.`,
    basis: "page",
    evidence: "회의실 예약",
    criteria: ["처리 흐름을 설명한다", "실패 시 확인 방법을 제시한다"],
  })),
};
export const fixtureAssessment: Assessment = {
  summary:
    "예약 처리 순서를 설명했습니다. 동시 예약과 권한 검증을 확인하는 방법을 더 구체화해 보세요.",
  score: 50,
  feedback: AREAS.map((_, questionIndex) => ({
    questionIndex,
    level: 2,
    feedback: "예약 요청과 저장 과정을 연결해 설명했습니다.",
    nextStep: "두 브라우저에서 같은 시간대를 예약하고 중복 여부를 확인해 보세요.",
  })),
};
export const fixtureCheck: StoredCheck = {
  id: "b9b6c81e-28e0-456f-9a05-2fbc19f2c864",
  createdAt: "2026-09-18T00:00:00.000Z",
  description: "회의실 예약을 관리하는 서비스입니다.",
  page: {
    url: "https://example.com/",
    title: "회의실 예약",
    text: "회의실 예약과 취소를 할 수 있습니다. ".repeat(25),
    fetchedAt: "2026-09-18T00:00:00.000Z",
    limited: false,
  },
  analysis: fixtureAnalysis,
};

export const fixtureVerificationPlan = {
  goal: "테스트 예약의 중복 실행 확인",
  preparation: "테스트 환경과 빈 시간대, 폐기 가능한 예약 자료를 준비합니다.",
  steps: [
    {
      action: "같은 예약 작업을 두 번 요청합니다.",
      expected: "같은 작업의 예약은 한 건만 남습니다.",
    },
    {
      action: "다른 작업 번호로 새 예약을 요청합니다.",
      expected: "정상적인 새 예약은 별도로 처리됩니다.",
    },
  ],
  completion: "요청별 작업 번호와 예약 개수를 비밀 정보 없이 기록합니다.",
};

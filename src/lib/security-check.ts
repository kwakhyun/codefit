export type SecurityFinding = {
  id: string;
  title: string;
  status: "observed" | "review" | "unknown";
  evidence: string;
  action: string;
};
export type SecurityReport = {
  url: string;
  checkedAt: string;
  findings: SecurityFinding[];
};
export const securityStatus = {
  observed: "설정 관찰",
  review: "보완 검토",
  unknown: "추가 확인 필요",
};
export const securityExercises = [
  {
    title: "다른 사람의 자료에 접근할 수 있나요?",
    steps:
      "테스트 환경에 소유자 A와 비참여자 B를 준비하세요. A의 테스트 자료를 B와 로그아웃 상태로 읽고 수정할 수 없는지 확인하세요. 실제 고객 자료를 사용하지 마세요.",
    expected: "권한 없는 요청은 서버에서 거절되고 자료가 바뀌지 않아야 합니다.",
    href: "/learn/private-board",
    linkLabel: "관련 연습으로 확인하기",
  },
  {
    title: "권한을 회수한 뒤에도 접근할 수 있나요?",
    steps:
      "테스트 계정을 공유 대상에서 제거한 뒤 기존 세션으로 같은 테스트 자료에 접근하세요. 화면의 버튼 유무와 서버의 거절 결과를 구별하세요.",
    expected: "회수된 권한이 서버의 읽기와 쓰기 요청에 반영되어야 합니다.",
    href: "/project-check",
    linkLabel: "내 프로젝트의 권한 설계 설명 점검하기",
  },
  {
    title: "한 작업이 두 번 실행되나요?",
    steps:
      "결제나 예약은 별도 테스트 환경에서 같은 작업의 재시도를 비교하세요. 정상적인 새 작업과 같은 작업의 재시도를 나누어 기록하세요.",
    expected: "동일 작업의 중복 실행을 막으면서 정상적인 새 요청은 처리해야 합니다.",
    href: "/learn/double-booking",
    linkLabel: "관련 연습으로 확인하기",
  },
];
export function securityReportText(report: SecurityReport) {
  return [
    `공개 페이지 보안 설정 점검`,
    report.url,
    report.checkedAt,
    "범위: 최종 HTML 응답의 헤더와 메타 태그. 공격, 로그인, API 권한 검증은 수행하지 않았습니다. 취약점이 없다는 증명이 아닙니다.",
    ...report.findings.map(
      (f) =>
        `\n[${securityStatus[f.status]}] ${f.title}\n근거: ${f.evidence}\n다음 행동: ${f.action}`,
    ),
    "\nAI 코딩 도구에 요청할 때: 위 관찰을 구현과 대조하고 필요한 설정만 수정하세요. 기존 인증과 외부 연동을 유지하고 변경 전후 테스트를 제시하세요. 관찰되지 않은 취약점을 단정하지 마세요.",
  ].join("\n");
}

export function securityNotesText(notes: string[], url: string, report: SecurityReport | null) {
  return [
    report
      ? securityReportText(report)
      : "공개 페이지 보안 점검 결과 없음 (자동 점검을 실행하지 않았거나 결과를 비웠습니다.)",
    "\n수동 확인 기록 — 사용자가 작성한 메모이며 자동 검증 결과가 아닙니다.",
    `작성 중인 서비스 링크: ${url || "미입력"}`,
    ...securityExercises.map(
      (item, index) =>
        `\n${index + 1}. ${item.title}\n기대 결과: ${item.expected}\n내 확인 결과: ${notes[index]?.trim() || "미작성"}`,
    ),
  ].join("\n");
}

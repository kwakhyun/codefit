/** Public curriculum metadata only. Reference implementations stay in src/data. */
export const HANDOFF_TRACKS = [
  {
    key: "latest",
    domain: "frontend",
    title: "검색 요청 인수인계",
    skill: "비동기 수명 관리",
    variantTitle: "주소 자동완성으로 다시 도전",
    brief: "느린 검색 응답이 최신 화면을 덮습니다. 화면이 사라진 뒤의 응답도 처리하세요.",
  },
  {
    key: "cart",
    domain: "frontend",
    title: "장바구니 상태 인수인계",
    skill: "불변 상태와 경계 조건",
    variantTitle: "예약 인원 변경으로 다시 도전",
    brief: "수량을 바꾸면 이전 화면의 상태까지 변합니다. 항목 삭제까지 안전하게 확장하세요.",
  },
  {
    key: "page",
    domain: "frontend",
    title: "목록 페이지 인수인계",
    skill: "입력 정규화와 페이지 경계",
    variantTitle: "활동 내역 목록으로 다시 도전",
    brief: "빈 목록과 마지막 페이지가 불안정합니다. 잘못된 페이지 요청도 처리하세요.",
  },
  {
    key: "config",
    domain: "backend",
    title: "환경 설정 인수인계",
    skill: "엄격한 입력 검증",
    variantTitle: "작업자 설정으로 다시 도전",
    brief: "문자열 false가 참으로 처리됩니다. 포트 검증과 기본값을 명시하세요.",
  },
  {
    key: "dedupe",
    domain: "backend",
    title: "이벤트 처리 인수인계",
    skill: "멱등성과 실패 복구",
    variantTitle: "알림 작업으로 다시 도전",
    brief: "실패한 이벤트의 재시도가 차단됩니다. 동시에 들어오는 중복 요청도 합치세요.",
  },
  {
    key: "total",
    domain: "backend",
    title: "주문 집계 인수인계",
    skill: "동작 보존과 책임 분리",
    variantTitle: "청구 내역으로 다시 도전",
    brief: "현재 집계 결과를 유지하면서 중복 계산을 정리하고 취소 건을 구분하세요.",
  },
] as const;
export const handoffId = (key: string, variant = false) =>
  `handoff-${key}${variant ? "-transfer" : ""}`;
export const HANDOFF_CRITERIA = [
  "구조 이해",
  "문제 판단",
  "기존 계약",
  "요구사항 확장",
  "검증 설계",
  "인수인계 판단",
] as const;

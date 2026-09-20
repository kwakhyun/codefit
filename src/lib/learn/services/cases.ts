import type { ServiceCase, ServiceSample } from "./types";
function sample(
  label: string,
  values: number[],
  fields: [string, string][],
  allowed: boolean,
  amount?: number,
): ServiceSample {
  return {
    label,
    values,
    fields,
    expected: { allowed, ...(amount === undefined ? {} : { amount }) },
  };
}
export const SERVICE_CASES: ServiceCase[] = [
  {
    id: "shop-coupon",
    domain: "commerce",
    title: "쿠폰 조건을 못 채웠는데 할인돼요",
    concept: "조건과 계산",
    summary: "주문 금액과 쿠폰 적용 대상 금액을 구분합니다.",
    policy:
      "정가 상품을 30,000원 이상 구매하면 5,000원 쿠폰을 사용할 수 있습니다. 할인 상품은 기준 금액에서 제외합니다.",
    fault: "할인 상품까지 합산해 쿠폰 사용 조건을 검사하고 있습니다.",
    repair: "쿠폰 적용 대상 상품만 합산한 뒤 최소 구매 금액을 검사합니다.",
    operation: "쿠폰 적용",
    entity: "주문서",
    samples: [
      sample(
        "정가 상품 40,000원",
        [40000, 0],
        [
          ["정가 상품", "40,000원"],
          ["할인 상품", "0원"],
        ],
        true,
        35000,
      ),
      sample(
        "정가 20,000원 + 할인 20,000원",
        [20000, 20000],
        [
          ["정가 상품", "20,000원"],
          ["할인 상품", "20,000원"],
        ],
        false,
      ),
      sample(
        "정가 상품 30,000원",
        [30000, 0],
        [
          ["정가 상품", "30,000원"],
          ["할인 상품", "0원"],
        ],
        true,
        25000,
      ),
    ],
    transfer: {
      question: "무료배송 쿠폰도 같은 기준 금액을 사용해도 될까요?",
      choices: [
        "쿠폰별 약관에 따라 대상 금액을 따로 확인한다",
        "모든 쿠폰은 주문 합계를 사용한다",
        "할인된 주문은 전부 차단한다",
      ],
      explanation: "혜택마다 적용 대상과 계산 순서를 명시해야 합니다.",
    },
    code: "const eligible = items.filter(x => !x.onSale).reduce((sum, x) => sum + x.price, 0);\nif (eligible < 30000) return rejectCoupon();",
  },
  {
    id: "shop-shipping",
    domain: "commerce",
    title: "쿠폰을 쓰니 배송비가 달라져야 해요",
    concept: "조건과 계산",
    summary: "할인 후 결제 금액으로 무료배송 조건을 확인합니다.",
    policy: "할인 후 상품 금액이 50,000원 이상이면 무료배송, 미만이면 배송비 3,000원입니다.",
    fault: "할인 전 금액을 기준으로 무료배송을 적용합니다.",
    repair: "상품 할인 금액을 먼저 차감하고 배송비를 계산합니다.",
    operation: "결제 금액 확인",
    entity: "결제 예정 주문",
    samples: [
      sample(
        "60,000원 주문",
        [60000, 5000],
        [
          ["상품 금액", "60,000원"],
          ["쿠폰 할인", "5,000원"],
        ],
        true,
        55000,
      ),
      sample(
        "50,000원 주문 + 쿠폰",
        [50000, 5000],
        [
          ["상품 금액", "50,000원"],
          ["쿠폰 할인", "5,000원"],
        ],
        true,
        48000,
      ),
      sample(
        "할인 후 정확히 50,000원",
        [55000, 5000],
        [
          ["상품 금액", "55,000원"],
          ["쿠폰 할인", "5,000원"],
        ],
        true,
        50000,
      ),
    ],
    transfer: {
      question: "배송비까지 쿠폰 할인 대상에 포함하려면?",
      choices: [
        "할인 범위와 계산 순서를 새 정책에 맞게 명시한다",
        "화면의 합계만 바꾼다",
        "무료배송 조건을 없앤다",
      ],
      explanation: "상품, 할인, 배송비는 별도 항목으로 관리해야 계산을 검증할 수 있습니다.",
    },
    code: "const subtotal = price - discount;\nconst shipping = subtotal >= 50000 ? 0 : 3000;\nreturn subtotal + shipping;",
  },
  {
    id: "shop-stock",
    domain: "commerce",
    title: "결제 대기 중인 상품이 또 판매돼요",
    concept: "재고와 정원",
    summary: "전체 재고에서 결제 대기 수량을 빼고 주문을 받습니다.",
    policy: "창고 재고는 5개입니다. 결제 중인 고객이 확보한 수량은 새 주문에 판매할 수 없습니다.",
    fault: "결제 대기 수량을 제외하지 않아 같은 재고를 여러 고객에게 판매합니다.",
    repair: "판매 가능한 재고를 계산하고 서버에서 재고 확보와 주문 접수를 함께 처리합니다.",
    operation: "주문 접수",
    entity: "재고 예약",
    samples: [
      sample(
        "확보 2개 / 신규 주문 2개",
        [2, 2],
        [
          ["결제 대기", "2개"],
          ["신규 주문", "2개"],
        ],
        true,
      ),
      sample(
        "확보 4개 / 신규 주문 2개",
        [4, 2],
        [
          ["결제 대기", "4개"],
          ["신규 주문", "2개"],
        ],
        false,
      ),
      sample(
        "확보 4개 / 신규 주문 1개",
        [4, 1],
        [
          ["결제 대기", "4개"],
          ["신규 주문", "1개"],
        ],
        true,
      ),
    ],
    transfer: {
      question: "여러 고객이 마지막 상품을 동시에 주문한다면?",
      choices: [
        "재고 검사와 확보를 하나의 원자적 작업으로 처리한다",
        "모든 화면을 1초마다 새로고침한다",
        "품절 안내만 추가한다",
      ],
      explanation: "재고 계산이 맞아도 동시 요청이 같은 재고를 확보하지 못하도록 보호해야 합니다.",
    },
    code: "// 실제 서비스는 트랜잭션과 조건부 갱신이 필요합니다.\nconst available = stock - reserved;\nif (quantity > available) return soldOut();",
  },
  {
    id: "shop-points",
    domain: "commerce",
    title: "잔액보다 많은 포인트가 사용돼요",
    concept: "입력 검증",
    summary: "포인트 잔액과 주문 금액을 함께 검사합니다.",
    policy:
      "포인트는 0 이상의 정수로 사용하며, 보유 포인트와 주문 금액을 모두 넘을 수 없습니다. 주문 금액은 20,000원입니다.",
    fault: "주문 금액만 확인하고 실제 보유 포인트를 검사하지 않습니다.",
    repair: "사용 포인트가 잔액과 주문 금액 중 작은 값 이하인지 서버에서 확인합니다.",
    operation: "포인트 사용",
    entity: "포인트 결제",
    samples: [
      sample(
        "3,000P 사용",
        [5000, 3000],
        [
          ["보유 포인트", "5,000P"],
          ["사용 포인트", "3,000P"],
        ],
        true,
        17000,
      ),
      sample(
        "잔액보다 많은 8,000P 사용",
        [5000, 8000],
        [
          ["보유 포인트", "5,000P"],
          ["사용 포인트", "8,000P"],
        ],
        false,
      ),
      sample(
        "포인트 전액 5,000P 사용",
        [5000, 5000],
        [
          ["보유 포인트", "5,000P"],
          ["사용 포인트", "5,000P"],
        ],
        true,
        15000,
      ),
    ],
    transfer: {
      question: "두 주문에서 같은 포인트를 동시에 사용하면?",
      choices: [
        "서버에서 잔액 검사와 차감을 함께 처리한다",
        "버튼 색을 바꾼다",
        "고객이 잔액을 직접 입력하게 한다",
      ],
      explanation: "잔액은 사용자 입력을 신뢰하지 않고 서버의 원장으로 확인해야 합니다.",
    },
    code: "if (!Number.isInteger(points) || points < 0 || points > Math.min(balance, total)) return reject();",
  },
  {
    id: "booking-capacity",
    domain: "booking",
    title: "남은 자리보다 많은 인원이 예약돼요",
    concept: "재고와 정원",
    summary: "이미 예약된 인원까지 합쳐 정원을 넘지 않는지 확인합니다.",
    policy: "클래스 정원은 8명입니다. 기존 예약 인원과 새 참가 인원의 합이 8명을 넘을 수 없습니다.",
    fault:
      "현재 구현은 새 참가자 2명만 정원 8명과 비교해 예약을 받습니다. 기존 7명까지 합치면 9명입니다.",
    repair: "확정 인원에 신규 참가 인원을 더해 정원을 검사합니다.",
    operation: "참가 예약",
    entity: "도예 클래스",
    samples: [
      sample(
        "기존 4명 + 신규 2명",
        [4, 2],
        [
          ["확정 인원", "4명"],
          ["신규 참가", "2명"],
        ],
        true,
      ),
      sample(
        "기존 7명 + 신규 2명",
        [7, 2],
        [
          ["확정 인원", "7명"],
          ["신규 참가", "2명"],
        ],
        false,
      ),
      sample(
        "기존 7명 + 신규 1명",
        [7, 1],
        [
          ["확정 인원", "7명"],
          ["신규 참가", "1명"],
        ],
        true,
      ),
    ],
    transfer: {
      question: "취소된 예약도 정원 계산에 포함할까요?",
      choices: [
        "실제로 자리를 차지하는 예약 상태만 합산한다",
        "모든 예약 기록을 합산한다",
        "취소 버튼만 숨긴다",
      ],
      explanation: "예약 상태와 참가 인원을 함께 기준으로 삼아야 합니다.",
    },
    code: "if (confirmedGuests + newGuests > capacity) return full();",
  },
  {
    id: "booking-overlap",
    domain: "booking",
    title: "일부 시간이 겹치는 예약이 들어왔어요",
    concept: "시간과 일정",
    summary: "시작 시각만 비교하면 놓치는 겹침을 찾습니다.",
    policy:
      "Room A는 14:00부터 16:00까지 예약돼 있습니다. 이용 시간이 조금이라도 겹치면 예약할 수 없고, 16:00부터는 예약할 수 있습니다.",
    fault: "시작 시각이 똑같은 예약만 차단합니다.",
    repair: "새 시작이 기존 종료보다 이르고 새 종료가 기존 시작보다 늦으면 겹치는 예약입니다.",
    operation: "시간 예약",
    entity: "Room A 대관",
    samples: [
      sample(
        "16:00–17:00",
        [16, 17],
        [
          ["시작", "16:00"],
          ["종료", "17:00"],
        ],
        true,
      ),
      sample(
        "15:00–17:00",
        [15, 17],
        [
          ["시작", "15:00"],
          ["종료", "17:00"],
        ],
        false,
      ),
      sample(
        "13:00–14:00",
        [13, 14],
        [
          ["시작", "13:00"],
          ["종료", "14:00"],
        ],
        true,
      ),
    ],
    transfer: {
      question: "예약 사이에 30분 청소 시간이 필요하다면?",
      choices: [
        "청소 시간을 포함한 점유 구간끼리 비교한다",
        "예약 제목에 청소라고 쓴다",
        "시작 시각만 30분 늦춘다",
      ],
      explanation: "이용 시간 외에 공간을 사용할 수 없는 시간도 점유 구간에 포함합니다.",
    },
    code: "const overlaps = start < existing.end && end > existing.start;\nif (overlaps) return unavailable();",
  },
  {
    id: "booking-cancel",
    domain: "booking",
    title: "무료 취소 마감 시각인데 수수료가 나와요",
    concept: "시간과 일정",
    summary: "취소 정책의 경계 시각을 정확히 구현합니다.",
    policy:
      "이용 시작까지 24시간 이상 남았으면 무료 취소입니다. 24시간 미만이면 예약금 60,000원의 50%를 수수료로 부과합니다.",
    fault: "24시간 초과일 때만 무료로 처리합니다.",
    repair: "24시간 이상을 포함해 무료 취소를 판정합니다.",
    operation: "취소 수수료 조회",
    entity: "예약 RM-2409",
    samples: [
      sample(
        "이용 48시간 전",
        [48],
        [
          ["남은 시간", "48시간"],
          ["예약금", "60,000원"],
        ],
        true,
        0,
      ),
      sample(
        "이용 24시간 전",
        [24],
        [
          ["남은 시간", "24시간"],
          ["예약금", "60,000원"],
        ],
        true,
        0,
      ),
      sample(
        "이용 23시간 전",
        [23],
        [
          ["남은 시간", "23시간"],
          ["예약금", "60,000원"],
        ],
        true,
        30000,
      ),
    ],
    transfer: {
      question: "고객의 휴대전화 시계가 틀렸다면?",
      choices: [
        "서버의 기준 시각으로 수수료를 확정한다",
        "기기 시각을 그대로 신뢰한다",
        "가장 먼저 도착한 문의를 기준으로 한다",
      ],
      explanation: "정책을 확정하는 기준 시각은 일관돼야 합니다.",
    },
    code: "const fee = hoursUntilStart >= 24 ? 0 : deposit * 0.5;",
  },
  {
    id: "booking-guests",
    domain: "booking",
    title: "추가 인원 요금이 한 번만 붙어요",
    concept: "조건과 계산",
    summary: "기본 인원을 초과한 만큼 대관 요금을 계산합니다.",
    policy:
      "기본 2시간 대관료는 60,000원이며 2인까지 포함합니다. 추가 인원은 1인당 10,000원, 최대 6인까지 이용할 수 있습니다.",
    fault: "인원 수와 관계없이 추가 요금을 한 번만 부과합니다.",
    repair: "초과 인원 수에 1인 요금을 곱하고 최대 인원을 검사합니다.",
    operation: "대관료 확인",
    entity: "자연광 스튜디오",
    samples: [
      sample(
        "2인 이용",
        [2],
        [
          ["이용 인원", "2명"],
          ["대관 시간", "2시간"],
        ],
        true,
        60000,
      ),
      sample(
        "5인 이용",
        [5],
        [
          ["이용 인원", "5명"],
          ["대관 시간", "2시간"],
        ],
        true,
        90000,
      ),
      sample(
        "7인 이용",
        [7],
        [
          ["이용 인원", "7명"],
          ["최대 인원", "6명"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "대관 시간이 늘면 추가 인원 요금도 늘어날까요?",
      choices: [
        "시간당 요금인지 회당 요금인지 정책에서 확인한다",
        "모든 요금을 두 배로 한다",
        "총 인원만 보면 된다",
      ],
      explanation: "요금의 단위를 명확히 구분해야 합니다.",
    },
    code: "if (guests > 6) return reject();\nreturn 60000 + Math.max(0, guests - 2) * 10000;",
  },
  {
    id: "work-permission",
    domain: "work",
    title: "열람 권한인데 문서를 수정할 수 있어요",
    concept: "접근 권한",
    summary: "문서 열람과 편집 권한을 구분합니다.",
    policy:
      "프로젝트 멤버 중 편집자만 문서를 수정할 수 있습니다. 열람자와 외부 사용자는 수정할 수 없습니다.",
    fault: "프로젝트 멤버인지 확인하고 편집 권한은 확인하지 않습니다.",
    repair: "프로젝트 소속과 편집 역할을 모두 서버에서 검사합니다.",
    operation: "변경 내용 저장",
    entity: "출시 계획서",
    samples: [
      sample(
        "지민 / 편집자",
        [1, 1],
        [
          ["사용자", "지민"],
          ["프로젝트 역할", "편집자"],
        ],
        true,
      ),
      sample(
        "서연 / 열람자",
        [1, 0],
        [
          ["사용자", "서연"],
          ["프로젝트 역할", "열람자"],
        ],
        false,
      ),
      sample(
        "민수 / 외부 사용자",
        [0, 0],
        [
          ["사용자", "민수"],
          ["프로젝트 역할", "참여하지 않음"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "편집 권한을 회수한 뒤 열려 있던 화면에서 저장하면?",
      choices: [
        "저장 요청 때 최신 권한을 다시 확인한다",
        "화면을 연 시점의 권한으로 저장한다",
        "새로고침할 때까지 허용한다",
      ],
      explanation: "권한은 화면 진입 시점뿐 아니라 각 요청에서도 검사해야 합니다.",
    },
    code: "if (!member || role !== 'editor') return forbidden();",
  },
  {
    id: "work-budget",
    domain: "work",
    title: "결재 중인 비용이 예산에 반영되지 않아요",
    concept: "재고와 정원",
    summary: "이미 집행한 비용과 결재 중인 비용을 함께 계산합니다.",
    policy:
      "프로젝트 예산은 1,000,000원입니다. 집행 금액, 결재 대기 금액, 새 신청 금액의 합이 예산을 넘으면 신청을 보류합니다.",
    fault: "아직 집행되지 않은 결재 대기 금액을 제외합니다.",
    repair: "집행 금액과 승인 대기 중인 예약 예산을 모두 차감합니다.",
    operation: "비용 신청",
    entity: "브랜드 리뉴얼 예산",
    samples: [
      sample(
        "인쇄비 100,000원",
        [500000, 200000, 100000],
        [
          ["집행 / 결재 대기", "500,000원 / 200,000원"],
          ["신청 금액", "100,000원"],
        ],
        true,
      ),
      sample(
        "촬영비 400,000원",
        [500000, 200000, 400000],
        [
          ["집행 / 결재 대기", "500,000원 / 200,000원"],
          ["신청 금액", "400,000원"],
        ],
        false,
      ),
      sample(
        "디자인비 300,000원",
        [500000, 200000, 300000],
        [
          ["집행 / 결재 대기", "500,000원 / 200,000원"],
          ["신청 금액", "300,000원"],
        ],
        true,
      ),
    ],
    transfer: {
      question: "대기 중이던 결재가 반려되면?",
      choices: [
        "확보한 예산을 반환해 새 신청에 사용할 수 있게 한다",
        "예산을 영구 차감한다",
        "화면의 숫자만 바꾼다",
      ],
      explanation: "상태 전환에 맞춰 예산 확보와 반환을 관리해야 합니다.",
    },
    code: "if (spent + pending + requested > budget) return hold();",
  },
  {
    id: "work-revision",
    domain: "work",
    title: "오래 열린 결재 화면에서 승인이 처리돼요",
    concept: "변경 충돌",
    summary: "결재자가 읽은 문서와 승인 시점의 문서가 같은지 확인합니다.",
    policy:
      "현재 비용 신청서는 4차 수정본입니다. 검토한 버전과 현재 버전이 같을 때만 승인할 수 있습니다.",
    fault: "문서 번호만 비교하고 수정 버전을 확인하지 않습니다.",
    repair: "승인 요청에 검토한 버전을 함께 보내 조건부로 갱신합니다.",
    operation: "결재 승인",
    entity: "비용 신청 AP-1042",
    samples: [
      sample(
        "현재 4차 수정본 검토",
        [4],
        [
          ["검토한 버전", "4차 수정본"],
          ["서버 최신 버전", "4차 수정본"],
        ],
        true,
      ),
      sample(
        "예전 3차 수정본 검토",
        [3],
        [
          ["검토한 버전", "3차 수정본"],
          ["서버 최신 버전", "4차 수정본"],
        ],
        false,
      ),
      sample(
        "예전 2차 수정본 검토",
        [2],
        [
          ["검토한 버전", "2차 수정본"],
          ["서버 최신 버전", "4차 수정본"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "최신 문서를 다시 읽는 동안 또 수정됐다면?",
      choices: [
        "새 승인 요청의 기준 버전도 다시 검사한다",
        "이번에는 무조건 승인한다",
        "브라우저 시계로 최신 여부를 판단한다",
      ],
      explanation: "매 요청마다 조건부 갱신을 해야 늦은 요청이 새 내용을 덮지 않습니다.",
    },
    code: "UPDATE approvals SET status = 'approved'\nWHERE id = :id AND revision = :reviewedRevision;",
  },
  {
    id: "work-dependency",
    domain: "work",
    title: "검수가 끝나지 않았는데 배포할 수 있어요",
    concept: "상태와 절차",
    summary: "작업 단계에 필요한 선행 조건을 확인합니다.",
    policy: "디자인 검수와 보안 검수가 모두 완료돼야 배포 승인으로 넘길 수 있습니다.",
    fault: "둘 중 한 가지 검수만 완료돼도 배포를 허용합니다.",
    repair: "두 선행 작업이 모두 완료인지 확인합니다.",
    operation: "배포 승인 요청",
    entity: "가을 업데이트",
    samples: [
      sample(
        "두 검수 모두 완료",
        [1, 1],
        [
          ["디자인 검수", "완료"],
          ["보안 검수", "완료"],
        ],
        true,
      ),
      sample(
        "보안 검수 대기",
        [1, 0],
        [
          ["디자인 검수", "완료"],
          ["보안 검수", "대기"],
        ],
        false,
      ),
      sample(
        "디자인 검수 대기",
        [0, 1],
        [
          ["디자인 검수", "대기"],
          ["보안 검수", "완료"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "선행 작업이 다시 진행 중으로 바뀌면?",
      choices: [
        "다음 단계로 전환할 때 선행 상태를 다시 검사한다",
        "처음 검사한 결과를 계속 사용한다",
        "담당자 이름만 확인한다",
      ],
      explanation: "절차의 제약은 실제 상태 변경 시점에 적용해야 합니다.",
    },
    code: "if (!designApproved || !securityApproved) return pending();",
  },
  {
    id: "content-expiry",
    domain: "content",
    title: "이용권이 끝났는데 유료 글이 열려요",
    concept: "접근 권한",
    summary: "과거 결제 이력과 현재 이용 자격을 구분합니다.",
    policy:
      "이용권 종료 시각 전까지만 유료 글을 읽을 수 있습니다. 종료 시각과 같거나 늦으면 이용권이 만료됩니다.",
    fault: "결제 이력이 있으면 종료 시각과 관계없이 접근을 허용합니다.",
    repair: "활성 이용권의 만료 시각을 서버 기준 시각과 비교합니다.",
    operation: "전문 읽기",
    entity: "도시를 기록하는 사람들",
    samples: [
      sample(
        "이용권 종료 2시간 전",
        [2],
        [
          ["이용권", "스탠더드"],
          ["남은 시간", "2시간"],
        ],
        true,
      ),
      sample(
        "이용권 종료 시각",
        [0],
        [
          ["이용권", "스탠더드"],
          ["남은 시간", "0시간"],
        ],
        false,
      ),
      sample(
        "이용권 종료 1시간 후",
        [-1],
        [
          ["이용권", "스탠더드"],
          ["경과 시간", "1시간"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "자동 결제를 취소하면 남은 이용 기간도 바로 끝나나요?",
      choices: [
        "자동 갱신 여부와 현재 이용권의 유효 기간을 따로 관리한다",
        "항상 즉시 이용을 중단한다",
        "결제 이력만 있으면 영구 허용한다",
      ],
      explanation: "갱신 예약과 현재 접근 자격은 서로 다른 상태입니다.",
    },
    code: "if (serverNow >= subscription.expiresAt) return paywall();",
  },
  {
    id: "content-unsubscribe",
    domain: "content",
    title: "예약 후 구독을 취소했는데 메일이 와요",
    concept: "상태와 절차",
    summary: "예약 시점의 명단과 발송 시점의 수신 동의를 비교합니다.",
    policy: "예약 명단에 있어도 발송 시점에 수신을 거부한 구독자에게는 메일을 보내지 않습니다.",
    fault: "예약 당시의 수신 동의만 확인합니다.",
    repair: "실제 발송 직전에 최신 수신 동의를 확인합니다.",
    operation: "발송 대상 확인",
    entity: "금요일의 편지 #42",
    samples: [
      sample(
        "현재도 수신 동의",
        [1, 1],
        [
          ["예약 당시", "수신 동의"],
          ["현재 상태", "수신 동의"],
        ],
        true,
      ),
      sample(
        "예약 후 수신 거부",
        [1, 0],
        [
          ["예약 당시", "수신 동의"],
          ["현재 상태", "수신 거부"],
        ],
        false,
      ),
      sample(
        "처음부터 수신 거부",
        [0, 0],
        [
          ["예약 당시", "수신 거부"],
          ["현재 상태", "수신 거부"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "예약과 발송 사이에 탈퇴한 고객은?",
      choices: [
        "발송 직전에 계정과 수신 자격을 다시 확인한다",
        "예약 명단에 있으므로 발송한다",
        "제목만 바꿔 발송한다",
      ],
      explanation: "시간이 지나며 달라질 수 있는 자격은 실행 시점에 재검증해야 합니다.",
    },
    code: "const current = await getSubscriber(id);\nif (!current?.consented) return skip();",
  },
  {
    id: "content-schedule",
    domain: "content",
    title: "예약 발행 시간이 9시간 어긋나요",
    concept: "시간과 일정",
    summary: "한국 시각과 UTC 사이의 변환을 확인합니다.",
    policy:
      "한국 시각(KST)은 UTC보다 9시간 빠릅니다. 9월 20일 오전 9시 발행은 UTC 9월 20일 0시로 저장해야 합니다.",
    fault: "한국 시각을 UTC로 간주해 그대로 저장합니다.",
    repair: "입력한 시간대 정보를 포함해 UTC 시각으로 변환합니다.",
    operation: "예약 시각 확인",
    entity: "주말 에디션 발행",
    samples: [
      sample(
        "한국 시각 18:00",
        [18],
        [
          ["입력 시간대", "한국 KST"],
          ["9월 20일 발행 시각", "18:00"],
        ],
        true,
        9,
      ),
      sample(
        "한국 시각 09:00",
        [9],
        [
          ["입력 시간대", "한국 KST"],
          ["9월 20일 발행 시각", "09:00"],
        ],
        true,
        0,
      ),
      sample(
        "한국 시각 08:00",
        [8],
        [
          ["입력 시간대", "한국 KST"],
          ["9월 20일 발행 시각", "08:00"],
        ],
        true,
        -1,
      ),
    ],
    transfer: {
      question: "여름에 시계가 바뀌는 지역도 단순히 9시간을 빼면 될까요?",
      choices: [
        "해당 지역의 시간대와 날짜를 지원하는 변환을 사용한다",
        "모든 지역에서 9시간을 뺀다",
        "사용자 기기 언어만 확인한다",
      ],
      explanation:
        "이 실습은 KST만 다룹니다. 실제 서비스는 날짜와 시간대 규칙을 함께 처리해야 합니다.",
    },
    code: "const scheduledAt = new Date('2026-09-20T09:00:00+09:00');\n// 2026-09-20T00:00:00.000Z",
  },
  {
    id: "content-segment",
    domain: "content",
    title: "조건과 다른 독자에게 안내가 발송돼요",
    concept: "조건과 계산",
    summary: "대상 조건에서 ‘그리고’와 ‘또는’의 차이를 확인합니다.",
    policy:
      "유료 구독자이면서 최근 30일 이내에 읽은 기록이 있는 독자에게만 행사 초대장을 보냅니다.",
    fault: "유료 구독자이거나 최근 열람자이면 대상으로 포함합니다.",
    repair: "구독 등급과 최근 열람 조건을 모두 충족하는 대상을 고릅니다.",
    operation: "대상에 포함하기",
    entity: "독자 모임 초대장",
    samples: [
      sample(
        "유료 / 7일 전 열람",
        [1, 7],
        [
          ["구독 등급", "유료"],
          ["최근 열람", "7일 전"],
        ],
        true,
      ),
      sample(
        "무료 / 7일 전 열람",
        [0, 7],
        [
          ["구독 등급", "무료"],
          ["최근 열람", "7일 전"],
        ],
        false,
      ),
      sample(
        "유료 / 30일 전 열람",
        [1, 30],
        [
          ["구독 등급", "유료"],
          ["최근 열람", "30일 전"],
        ],
        true,
      ),
    ],
    transfer: {
      question: "행사 지역 조건까지 추가하면?",
      choices: [
        "필수 조건끼리는 AND로 묶고 경계값을 검사한다",
        "모든 조건을 OR로 연결한다",
        "대상 수가 많으면 맞다고 판단한다",
      ],
      explanation: "대상 수뿐 아니라 포함되면 안 되는 개별 사례도 확인해야 합니다.",
    },
    code: "return subscriber.paid && daysSinceRead <= 30;",
  },
  {
    id: "support-refund",
    domain: "support",
    title: "이미 환불한 금액이 다시 환불돼요",
    concept: "조건과 계산",
    summary: "전체 결제액 대신 남은 환불 가능 금액을 계산합니다.",
    policy: "총 결제액은 50,000원입니다. 기존 환불액과 새 환불액의 합이 결제액을 넘을 수 없습니다.",
    fault: "새 환불액만 최초 결제액과 비교합니다.",
    repair: "기존 환불을 차감한 잔액 범위에서만 환불을 처리합니다.",
    operation: "환불 접수",
    entity: "주문 OR-2051 문의",
    samples: [
      sample(
        "기존 10,000원 / 추가 20,000원",
        [10000, 20000],
        [
          ["기존 환불", "10,000원"],
          ["추가 환불", "20,000원"],
        ],
        true,
      ),
      sample(
        "기존 40,000원 / 추가 20,000원",
        [40000, 20000],
        [
          ["기존 환불", "40,000원"],
          ["추가 환불", "20,000원"],
        ],
        false,
      ),
      sample(
        "남은 10,000원 전액 환불",
        [40000, 10000],
        [
          ["기존 환불", "40,000원"],
          ["추가 환불", "10,000원"],
        ],
        true,
      ),
    ],
    transfer: {
      question: "환불 처리 응답을 받지 못했다면?",
      choices: [
        "결제사가 지원하는 조회 또는 동일 요청 번호 재시도로 기존 결과를 확인한다",
        "새 요청으로 환불을 반복한다",
        "화면 잔액을 임의로 차감한다",
      ],
      explanation: "금액 검증과 중복 요청 방지는 모두 필요합니다.",
    },
    code: "const refundable = paid - refunded;\nif (requested > refundable) return reject();",
  },
  {
    id: "support-attachment",
    domain: "support",
    title: "첨부 파일 용량 제한이 제대로 안 돼요",
    concept: "입력 검증",
    summary: "확장자와 파일 크기를 함께 검사합니다.",
    policy:
      "이미지 첨부는 JPG 또는 PNG이며 5MB 이하만 허용합니다. 이 실습의 1MB는 1,000,000바이트입니다.",
    fault: "확장자가 이미지이면 용량 제한을 건너뜁니다.",
    repair: "허용 형식과 파일 크기 조건을 모두 서버에서 확인합니다.",
    operation: "첨부 확인",
    entity: "불량 상품 접수",
    samples: [
      sample(
        "product.jpg / 2MB",
        [1, 2],
        [
          ["파일", "product.jpg"],
          ["크기", "2MB"],
        ],
        true,
      ),
      sample(
        "product.png / 8MB",
        [1, 8],
        [
          ["파일", "product.png"],
          ["크기", "8MB"],
        ],
        false,
      ),
      sample(
        "invoice.exe / 1MB",
        [0, 1],
        [
          ["파일", "invoice.exe"],
          ["크기", "1MB"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "실행 파일의 이름을 photo.jpg로 바꾸면?",
      choices: [
        "서버에서 실제 파일 형식도 검증한다",
        "확장자가 JPG니까 허용한다",
        "파일 이름 길이만 확인한다",
      ],
      explanation:
        "이 실습은 크기와 허용 형식 조건에 집중합니다. 실제 업로드에는 콘텐츠 검사와 안전한 저장 경로도 필요합니다.",
    },
    code: "if (!allowedType || bytes > 5_000_000) return reject();",
  },
  {
    id: "support-export",
    domain: "support",
    title: "다른 팀의 고객 정보까지 내려받아져요",
    concept: "접근 권한",
    summary: "고객 정보 내보내기 권한의 범위를 확인합니다.",
    policy:
      "내보내기 권한이 있고 해당 고객을 담당하는 팀에 속한 상담원만 고객 정보를 내려받을 수 있습니다.",
    fault: "내보내기 권한만 확인하고 담당 팀을 검사하지 않습니다.",
    repair: "내보내기 권한과 데이터의 팀 소속을 모두 확인합니다.",
    operation: "내보내기 요청",
    entity: "고객 정보 CSV",
    samples: [
      sample(
        "담당 팀 / 내보내기 허용",
        [1, 1],
        [
          ["상담원 소속", "고객 담당 팀"],
          ["내보내기 권한", "있음"],
        ],
        true,
      ),
      sample(
        "다른 팀 / 내보내기 허용",
        [0, 1],
        [
          ["상담원 소속", "다른 팀"],
          ["내보내기 권한", "있음"],
        ],
        false,
      ),
      sample(
        "담당 팀 / 내보내기 불가",
        [1, 0],
        [
          ["상담원 소속", "고객 담당 팀"],
          ["내보내기 권한", "없음"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "CSV 주소를 다른 상담원에게 전달하면?",
      choices: [
        "다운로드 요청에서도 접근 권한을 검사한다",
        "주소를 알면 누구나 허용한다",
        "파일 이름에 비공개라고 적는다",
      ],
      explanation: "파일 생성과 파일 다운로드 양쪽에서 범위가 유지돼야 합니다.",
    },
    code: "if (!canExport || customer.teamId !== agent.teamId) return forbidden();",
  },
  {
    id: "support-close",
    domain: "support",
    title: "답변이 없는 문의가 해결 완료로 바뀌어요",
    concept: "상태와 절차",
    summary: "답변 초안과 실제 발송 완료를 구분합니다.",
    policy:
      "고객에게 답변을 발송한 뒤에만 문의를 해결 완료로 바꿀 수 있습니다. 답변 초안은 발송한 답변이 아닙니다.",
    fault: "초안이 작성돼 있으면 답변이 발송됐다고 판단합니다.",
    repair: "메시지의 실제 발송 완료 상태를 확인한 뒤 문의를 닫습니다.",
    operation: "해결 완료로 변경",
    entity: "배송 일정 문의 #1048",
    samples: [
      sample(
        "답변 발송 완료",
        [1, 1],
        [
          ["답변 초안", "작성됨"],
          ["발송 상태", "발송 완료"],
        ],
        true,
      ),
      sample(
        "초안만 작성됨",
        [1, 0],
        [
          ["답변 초안", "작성됨"],
          ["발송 상태", "미발송"],
        ],
        false,
      ),
      sample(
        "아직 답변 없음",
        [0, 0],
        [
          ["답변 초안", "없음"],
          ["발송 상태", "미발송"],
        ],
        false,
      ),
    ],
    transfer: {
      question: "발송 요청이 시간 초과됐다면?",
      choices: [
        "발송 결과를 확인한 뒤 문의 상태를 바꾼다",
        "일단 해결 완료로 바꾼다",
        "고객 메시지를 삭제한다",
      ],
      explanation: "요청을 보낸 사실과 작업이 끝난 사실은 다릅니다.",
    },
    code: "if (reply.status !== 'sent') return keepOpen();",
  },
];

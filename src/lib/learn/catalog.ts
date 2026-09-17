export type Action =
  | "save"
  | "refresh"
  | "other-device"
  | "offline"
  | "online"
  | "switch-user"
  | "open-private"
  | "quantity"
  | "invalid-quantity"
  | "filter"
  | "search-old"
  | "search-new"
  | "respond-new"
  | "respond-old"
  | "book"
  | "repeat-book"
  | "new-booking";
export type Mission = {
  id: string;
  title: string;
  summary: string;
  kind: "foundation" | "lab";
  concept: string;
  minutes: number;
  app: "memo" | "request" | "access" | "price" | "filter" | "search" | "booking";
  task: string;
  prediction: string;
  choices: string[];
  answer: number;
  actions: Action[];
  reproduce: Action[];
  lesson: string;
  hint: string[];
  fixes: { id: string; title: string; detail: string }[];
  transfer: { question: string; choices: string[]; answer: number; explanation: string };
  code: string;
};
const memoFixes = [
  {
    id: "label",
    title: "저장 안내를 더 크게 표시",
    detail: "화면에서 완료 메시지를 쉽게 읽을 수 있게 합니다.",
  },
  {
    id: "browser",
    title: "이 브라우저 안에 저장",
    detail: "같은 브라우저에서는 다시 읽을 수 있도록 저장합니다.",
  },
  {
    id: "server",
    title: "서버 저장 결과를 확인",
    detail: "서버가 저장을 마친 경우에만 완료를 안내하고, 실패하면 재시도를 제공합니다.",
  },
];
const accessFixes = [
  {
    id: "hide",
    title: "다른 사람의 글 버튼 숨기기",
    detail: "목록에서 남의 비공개 글을 표시하지 않습니다.",
  },
  {
    id: "owner",
    title: "서버에서 글 주인 확인",
    detail: "각 조회 요청에서 로그인 사용자와 글 주인을 비교합니다.",
  },
  { id: "login", title: "로그인 여부만 확인", detail: "로그인한 사용자라면 글을 보여 줍니다." },
];
export const MISSIONS: Mission[] = [
  {
    id: "where-data-lives",
    kind: "foundation",
    title: "메모는 어디에 저장될까요?",
    summary: "새로고침하거나 다른 기기로 접속해 메모가 어디에 저장되는지 확인합니다.",
    concept: "화면 상태와 저장소",
    minutes: 5,
    app: "memo",
    task: "이 메모를 저장한 뒤 새로고침하고, 다른 기기에서도 읽을 수 있게 만들어 보세요.",
    prediction: "지금 앱에서 저장한 뒤 새로고침하면 메모가 남을까요?",
    choices: [
      "저장 완료라고 했으니 남는다",
      "화면에만 있어 사라질 수 있다",
      "로그인하면 무조건 남는다",
    ],
    answer: 1,
    actions: ["save", "refresh", "other-device"],
    reproduce: ["save", "refresh"],
    lesson:
      "화면에 보이는 값은 임시로 보관된 상태일 수 있습니다. 브라우저에 저장한 데이터는 같은 브라우저에서 다시 읽을 수 있고, 여러 기기에서 공유하려면 서버 같은 공용 저장소가 필요합니다. 새로고침 후 데이터가 남아 있다고 해서 서버에 저장된 것은 아닙니다.",
    hint: [
      "저장 후 새로고침을 눌러 보세요.",
      "같은 브라우저에 남는 것과 다른 기기에서 읽는 것은 다릅니다.",
      "서버 저장을 선택한 뒤 새로고침과 다른 기기 검사를 모두 해보세요.",
    ],
    fixes: memoFixes,
    transfer: {
      question: "공용 게시판을 만들 때 브라우저 저장만으로 충분할까요?",
      choices: [
        "다른 사람이 읽어야 하므로 공용 저장소와 접근 규칙이 필요하다",
        "내 화면에 보이면 모두에게 보인다",
        "버튼 이름을 게시로 바꾸면 된다",
      ],
      answer: 0,
      explanation: "기기 간 공유와 누가 읽거나 쓸 수 있는지는 함께 설계해야 합니다.",
    },
    code: "// 화면 상태\nlet memo = '';\n// 서버 응답을 확인한 뒤 완료 안내\nconst result = await saveMemo(memo);\nif (result.ok) showSaved();",
  },
  {
    id: "follow-a-request",
    kind: "foundation",
    title: "저장 요청은 어디에서 멈췄을까요?",
    summary: "화면, 요청, 서버 응답의 흐름을 따라갑니다.",
    concept: "요청과 응답",
    minutes: 5,
    app: "request",
    task: "네트워크를 끊고 저장해 보세요. 실패를 성공으로 알리지 않고, 연결 복구 뒤 다시 저장해야 합니다.",
    prediction: "연결이 끊긴 상태에서 버튼을 누르면 서버에 저장될까요?",
    choices: [
      "클릭했으니 저장된다",
      "화면이 바뀌면 저장된다",
      "서버 응답을 확인하기 전에는 알 수 없다",
    ],
    answer: 2,
    actions: ["offline", "online", "save"],
    reproduce: ["offline", "save"],
    lesson:
      "클릭은 요청의 시작입니다. 연결 문제나 서버 오류로 저장이 실패할 수 있습니다. 화면은 실제 응답에 맞춰 대기, 성공, 실패를 구분해야 합니다.",
    hint: [
      "연결 끊기를 누른 다음 저장해 보세요.",
      "앱 안내와 서버 저장 수를 비교하세요.",
      "서버 응답을 확인하는 안을 선택하고 연결 복구도 검사하세요.",
    ],
    fixes: memoFixes,
    transfer: {
      question: "요청이 오래 걸릴 때 적절한 안내는 무엇일까요?",
      choices: [
        "일단 저장 완료 표시",
        "진행 중임을 알리고 결과가 오면 성공 또는 재시도 안내",
        "아무 표시 없이 버튼 제거",
      ],
      answer: 1,
      explanation:
        "대기와 성공은 서로 다른 상태입니다. 기다리는 동안도 사용자가 상황을 알 수 있어야 합니다.",
    },
    code: "try {\n  await saveMemo(text);\n  showSaved();\n} catch {\n  showRetry();\n}",
  },
  {
    id: "who-can-read",
    kind: "foundation",
    title: "로그인만 하면 안전할까요?",
    summary: "로그인한 사용자를 바꿔 다른 사람의 비공개 글이 보이는지 확인합니다.",
    concept: "로그인과 접근 권한",
    minutes: 6,
    app: "access",
    task: "지민의 비공개 글입니다. 민수로 전환한 뒤 직접 주소로 열어 보고, 글 주인만 읽도록 바꾸세요.",
    prediction: "민수가 로그인하면 지민의 비공개 글을 읽어도 될까요?",
    choices: [
      "로그인했으니 읽어도 된다",
      "글 주인이 아니므로 서버가 거절해야 한다",
      "목록에 버튼이 없으면 항상 안전하다",
    ],
    answer: 1,
    actions: ["switch-user", "open-private"],
    reproduce: ["switch-user", "open-private"],
    lesson:
      "로그인은 누구인지 확인하는 과정입니다. 접근 권한은 그 사람이 이 글을 읽어도 되는지 확인하는 규칙입니다. 버튼을 숨겨도 직접 요청할 수 있어 서버에서 확인해야 합니다.",
    hint: [
      "사용자를 바꾸고 비공개 글 직접 열기를 누르세요.",
      "화면에서 숨기는 것과 요청을 거절하는 것은 다릅니다.",
      "서버에서 글 주인을 확인하고 주인/다른 사용자 두 경우를 검사하세요.",
    ],
    fixes: accessFixes,
    transfer: {
      question: "팀장이 팀원 문서를 볼 수 있어야 한다면?",
      choices: [
        "로그인한 누구에게나 허용",
        "문서 URL을 어렵게 만들기",
        "서버에 팀과 역할별 허용 규칙을 명시하고 검사",
      ],
      answer: 2,
      explanation:
        "소유자 규칙은 한 가지 예입니다. 제품의 역할에 맞는 허용 범위를 서버에서 검증해야 합니다.",
    },
    code: "if (session.userId !== document.ownerId) {\n  return forbidden();\n}\nreturn document;",
  },
  {
    id: "price-and-rules",
    kind: "foundation",
    title: "수량에 따라 가격 계산하기",
    summary: "입력값과 조건이 계산 결과를 바꾸는 과정을 봅니다.",
    concept: "변수와 조건",
    minutes: 5,
    app: "price",
    task: "한 개에 10,000원, 세 개부터 10% 할인입니다. 수량 3과 잘못된 수량 -1을 넣어 규칙을 확인하세요.",
    prediction: "세 개를 구매하면 얼마여야 할까요?",
    choices: ["30,000원", "27,000원", "9,000원"],
    answer: 1,
    actions: ["quantity", "invalid-quantity"],
    reproduce: ["quantity", "invalid-quantity"],
    lesson:
      "변수는 달라지는 값을 담고, 조건은 어떤 규칙을 적용할지 결정합니다. 정상 입력만 계산하지 말고 허용하지 않는 입력도 확인해야 합니다.",
    hint: [
      "수량 3 넣기와 수량 -1 넣기를 비교하세요.",
      "할인 경계는 3개부터이며 음수는 거절해야 합니다.",
      "할인과 입력 검증을 함께 적용하는 안을 고르세요.",
    ],
    fixes: [
      { id: "discount", title: "3개부터 할인", detail: "가격 계산에 할인 조건을 추가합니다." },
      {
        id: "validated",
        title: "수량 검사 후 할인 계산",
        detail: "양의 정수인지 확인하고 3개부터 할인을 적용합니다.",
      },
      {
        id: "label",
        title: "가격 안내만 수정",
        detail: "3개부터 할인이라는 설명을 화면에 추가합니다.",
      },
    ],
    transfer: {
      question: "무료 배송 기준이 30,000원 이상이라면 꼭 확인할 값은?",
      choices: ["30,000원보다 작은 값, 같은 값, 큰 값", "100,000원만", "버튼 색상"],
      answer: 0,
      explanation:
        "조건이 바뀌는 경계의 바로 아래, 같은 값, 바로 위를 비교하면 포함 여부 오류를 찾기 쉽습니다.",
    },
    code: "if (!Number.isInteger(quantity) || quantity < 1) {\n  return '수량 오류';\n}\nreturn quantity * 10000 * (quantity >= 3 ? 0.9 : 1);",
  },
  {
    id: "lists-and-filters",
    kind: "foundation",
    title: "완료한 할 일만 보고 싶어요",
    summary: "여러 항목에 같은 조건을 적용합니다.",
    concept: "목록과 필터",
    minutes: 4,
    app: "filter",
    task: "완료한 항목만 표시하되, 전체 목록으로 돌아왔을 때 미완료 항목도 남아 있어야 합니다.",
    prediction: "완료 필터로 바꾸면 미완료 할 일은 어떻게 되어야 할까요?",
    choices: ["영구 삭제된다", "모두 완료로 바뀐다", "원본에 남고 현재 화면에서만 숨겨진다"],
    answer: 2,
    actions: ["filter", "refresh"],
    reproduce: ["filter", "refresh"],
    lesson:
      "필터는 목록에서 조건에 맞는 항목을 골라 보여 줍니다. 원본을 삭제하는 것과 다릅니다. 보여줄 목록과 저장된 목록을 구분하면 데이터를 잃지 않습니다.",
    hint: [
      "완료만 보기 후 전체 다시 보기를 눌러 보세요.",
      "원본 목록 수와 화면 항목 수를 비교하세요.",
      "원본을 유지하고 표시 목록만 계산하는 안을 선택하세요.",
    ],
    fixes: [
      {
        id: "delete",
        title: "미완료 항목 지우기",
        detail: "완료 항목만 남도록 원본을 정리합니다.",
      },
      { id: "mark", title: "모두 완료로 변경", detail: "모든 항목을 완료 상태로 맞춥니다." },
      {
        id: "derived",
        title: "표시할 목록만 계산",
        detail: "원본을 보존하고 조건에 맞는 항목만 보여 줍니다.",
      },
    ],
    transfer: {
      question: "쇼핑몰에서 품절 상품 숨기기를 해제하면?",
      choices: [
        "품절 상품은 삭제되어야 한다",
        "원본에 남은 품절 상품이 다시 보여야 한다",
        "재고 수를 강제로 늘린다",
      ],
      answer: 1,
      explanation: "표시 조건을 바꾸는 일과 원본 데이터를 수정하는 일은 구분해야 합니다.",
    },
    code: "const visible = completedOnly\n  ? todos.filter(todo => todo.done)\n  : todos;",
  },
  {
    id: "late-search",
    kind: "foundation",
    title: "나중에 온 결과가 최신일까요?",
    summary: "검색 요청과 응답의 순서가 다를 수 있음을 확인합니다.",
    concept: "비동기와 순서",
    minutes: 6,
    app: "search",
    task: "고양이 다음 강아지를 검색하세요. 강아지 응답을 먼저, 고양이 응답을 나중에 보내 최신 검색어의 결과를 유지하세요.",
    prediction: "먼저 시작한 검색의 응답이 늦게 도착하면 무엇을 보여야 할까요?",
    choices: ["마지막에 도착한 응답", "가장 최근 검색어에 해당하는 응답", "두 응답을 섞어서 표시"],
    answer: 1,
    actions: ["search-old", "search-new", "respond-new", "respond-old"],
    reproduce: ["search-old", "search-new", "respond-new", "respond-old"],
    lesson:
      "요청을 시작한 순서와 끝나는 순서는 다를 수 있습니다. 도착 시각만으로 최신 여부를 결정하지 말고 현재 요청의 식별자와 비교해야 합니다.",
    hint: [
      "검색 두 번 후 강아지 응답부터 보내세요.",
      "검색어와 표시 결과가 같은지 보세요.",
      "현재 요청과 일치하는 응답만 반영하는 안을 선택하세요.",
    ],
    fixes: [
      { id: "delay", title: "모든 응답을 늦게 표시", detail: "응답 표시 전에 잠시 기다립니다." },
      {
        id: "latest",
        title: "현재 요청의 응답만 반영",
        detail: "응답의 요청 번호가 현재 검색 요청 번호인지 확인합니다.",
      },
      { id: "label", title: "검색어 표시 숨기기", detail: "검색어 대신 결과 목록만 보여 줍니다." },
    ],
    transfer: {
      question: "지역을 빠르게 바꾸는 날씨 앱에도 같은 문제가 생길까요?",
      choices: [
        "검색 기능에서만 생긴다",
        "응답이 빠르면 절대 없다",
        "이전 지역의 늦은 응답이 새 지역을 덮을 수 있다",
      ],
      answer: 2,
      explanation: "서로 다른 요청이 같은 화면을 갱신한다면 응답의 소속을 확인해야 합니다.",
    },
    code: "const requestId = ++latestId;\nconst result = await search(query);\nif (requestId === latestId) show(result);",
  },
];
MISSIONS.push(
  {
    ...MISSIONS[1],
    id: "broken-memo",
    kind: "lab",
    title: "메모 저장 오류 해결하기",
    summary: "저장에 실패해도 완료 안내가 뜨는 앱을 점검합니다.",
    minutes: 10,
  },
  {
    ...MISSIONS[2],
    id: "private-board",
    kind: "lab",
    title: "비공개 글의 접근 권한 확인하기",
    summary: "작성자만 자신의 비공개 글을 읽을 수 있도록 접근 권한을 설정합니다.",
    minutes: 10,
  },
  {
    id: "double-booking",
    kind: "lab",
    title: "예약이 중복으로 등록되는 오류 해결하기",
    summary: "중복 요청을 막으면서 새로운 예약은 허용합니다.",
    concept: "중복 처리와 재시도",
    minutes: 12,
    app: "booking",
    task: "같은 예약 요청을 반복해도 한 번만 저장되고, 다른 예약은 새로 저장되어야 합니다. 연결 실패 후 재시도도 확인하세요.",
    prediction: "예약 버튼을 숨기면 중복 요청도 확실히 막힐까요?",
    choices: [
      "버튼을 숨기면 서버도 안전하다",
      "같은 요청을 서버에서 구분해야 한다",
      "모든 추가 예약을 영구 차단하면 된다",
    ],
    answer: 1,
    actions: ["book", "repeat-book", "new-booking", "offline", "online"],
    reproduce: ["book", "repeat-book"],
    lesson:
      "버튼 비활성화는 실수를 줄이지만 중복 요청을 막는 최종 규칙은 서버에 필요합니다. 같은 요청의 재시도는 같은 결과를 돌려주고, 새 요청은 구분해야 합니다.",
    hint: [
      "같은 예약 다시 보내기를 눌러 예약 수를 확인하세요.",
      "중복 방지와 새로운 예약 허용을 함께 검사하세요.",
      "서버에서 요청 번호별 결과를 보관하는 안을 선택하세요.",
    ],
    fixes: [
      { id: "hide", title: "예약 버튼 숨기기", detail: "한 번 누른 뒤 화면의 버튼을 감춥니다." },
      {
        id: "block",
        title: "추가 예약 모두 막기",
        detail: "예약이 하나라도 있으면 새 요청을 거절합니다.",
      },
      {
        id: "idempotent",
        title: "요청 번호별 결과 보관",
        detail: "같은 요청은 기존 결과를 반환하고 새로운 요청은 처리합니다.",
      },
    ],
    transfer: {
      question: "응답을 못 받았을 때 같은 예약을 다시 보내려면?",
      choices: [
        "매번 새로운 요청 번호 사용",
        "서버가 지원하는 동일 요청 번호로 결과 확인 또는 재시도",
        "예약 성공이라고 표시하고 끝내기",
      ],
      answer: 1,
      explanation:
        "응답 유실은 저장 실패와 다릅니다. 서버가 중복 처리를 지원하는 계약 안에서 같은 요청의 결과를 확인해야 합니다.",
    },
    code: "if (results.has(requestId)) return results.get(requestId);\n// 실제 서버에서는 동시 요청도 원자적으로 처리해야 합니다.\nreturn createAndRemember(requestId);",
  },
);
export function missionById(id: string) {
  return MISSIONS.find((m) => m.id === id);
}
export const ACTION_LABELS: Record<Action, string> = {
  save: "메모 저장",
  refresh: "새로고침 실험",
  "other-device": "다른 기기에서 보기",
  offline: "연결 끊기",
  online: "연결 복구",
  "switch-user": "사용자 전환",
  "open-private": "비공개 글 직접 열기",
  quantity: "수량 3 넣기",
  "invalid-quantity": "수량 -1 넣기",
  filter: "완료만 보기",
  "search-old": "고양이 검색",
  "search-new": "강아지 검색",
  "respond-new": "강아지 응답 도착",
  "respond-old": "고양이 응답 도착",
  book: "예약 보내기",
  "repeat-book": "같은 예약 다시 보내기",
  "new-booking": "새 예약 보내기",
};

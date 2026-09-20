import { actionLabel, type Action, type Mission } from "./catalog";

export type ExperimentStep = {
  action: Action;
  purpose: string;
  observe: string;
  optional?: boolean;
};
const instructions: Partial<Record<Action, [string, string]>> = {
  save: ["화면의 문서를 저장해 봅니다.", "저장 안내와 실제 저장 위치를 비교하세요."],
  refresh: [
    "새로 접속했을 때도 데이터가 남는지 실험합니다.",
    "문서 내용이 남아 있는지 확인하세요. 브라우저의 새로고침 대신 이 실험 버튼을 누릅니다.",
  ],
  "other-device": [
    "같은 사용자가 다른 기기로 접속한 상황을 만듭니다.",
    "방금 저장한 문서를 다른 기기에서도 읽을 수 있는지 확인하세요.",
  ],
  offline: [
    "서버에 요청이 도착하지 못하는 상황을 만듭니다.",
    "연결 상태가 오프라인으로 바뀌는지 확인하세요. 실제 인터넷 연결은 바뀌지 않습니다.",
  ],
  online: ["끊어진 연결이 복구된 상황을 만듭니다.", "연결 상태가 온라인으로 바뀌는지 확인하세요."],
  "switch-user": [
    "문서 작성자와 다른 사용자의 접근을 비교합니다.",
    "상단의 현재 사용자 이름이 바뀌는지 확인하세요.",
  ],
  "open-private": [
    "현재 사용자로 비공개 문서에 직접 접근합니다.",
    "사용자 이름과 문서 소유자를 비교하고, 내용이 열리는지 차단되는지 확인하세요.",
  ],
  quantity: [
    "할인이 적용되는 정상 수량을 입력합니다.",
    "수량 3개일 때 주문 금액이 할인 조건과 맞는지 확인하세요.",
  ],
  "invalid-quantity": [
    "화면 밖에서도 잘못된 수량이 전달될 수 있다고 가정합니다.",
    "음수 수량을 거절하는지, 잘못된 주문 금액이 표시되는지 확인하세요.",
  ],
  filter: [
    "완료한 항목만 보도록 화면을 바꿉니다.",
    "표시되지 않는 항목도 원본에는 남아 있어야 하는지 생각해 보세요.",
  ],
  "search-old": [
    "첫 번째 검색 요청을 보냅니다.",
    "아직 응답은 도착하지 않았습니다. 검색어와 대기 상태를 확인하세요.",
  ],
  "search-new": [
    "첫 요청이 끝나기 전에 검색어를 바꿉니다.",
    "마지막으로 입력한 검색어는 강아지입니다. 어떤 결과가 보여야 할까요?",
  ],
  "respond-new": [
    "나중에 보낸 요청의 응답을 먼저 도착시킵니다.",
    "검색 결과에 강아지가 나타나는지 확인하세요.",
  ],
  "respond-old": [
    "느렸던 첫 요청의 응답을 뒤늦게 도착시킵니다.",
    "검색어는 강아지인데 결과가 고양이로 바뀌는지 비교하세요.",
  ],
  book: ["하나의 예약 작업을 서버에 보냅니다.", "내 예약에 추가된 시간과 예약 건수를 확인하세요."],
  "repeat-book": [
    "같은 예약 작업을 같은 요청 번호로 재전송합니다.",
    "새 예약을 의도한 것이 아닙니다. 같은 시간의 예약이 늘어나는지 확인하세요.",
  ],
  "new-booking": [
    "다른 시간에 새 예약을 의도한 상황입니다.",
    "중복 요청을 막으면서도 정상적인 추가 예약은 허용하는지 확인하세요.",
  ],
};
export function experimentSteps(mission: Mission): ExperimentStep[] {
  if (mission.service) {
    const c = mission.service;
    return (["case-edge", "case-standard", "case-other"] as const).flatMap((action, i) => [
      {
        action,
        optional: i > 0,
        purpose: `‘${actionLabel(mission, action)}’ 조건을 선택합니다.`,
        observe: "선택한 요청 정보의 값과 처리 기준을 읽고, 어떤 결과여야 하는지 생각해 보세요.",
      },
      {
        action: "case-submit" as const,
        optional: i > 0,
        purpose: `선택한 조건으로 ‘${c.operation}’을 실행합니다.`,
        observe: `처리 결과를 이용 조건과 비교하세요. ${c.policy}`,
      },
    ]);
  }
  const optional: Partial<Record<Mission["app"], Action[]>> = {
    memo: ["other-device"],
    request: ["online", "save"],
    access: ["switch-user", "open-private"],
    booking: ["new-booking", "offline", "book", "online", "repeat-book"],
  };
  return [...mission.reproduce, ...(optional[mission.app] || [])].map((action, i) => {
    const [purpose, observe] = instructions[action]!;
    return {
      action,
      purpose,
      observe:
        mission.app === "filter" && action === "refresh"
          ? "전체 항목이 다시 보이는지, 필터에서 숨겨진 항목이 사라졌는지 확인하세요."
          : observe,
      optional: i >= mission.reproduce.length,
    };
  });
}
/** Replay actual actions, never advance just because a guide was dismissed. */
export function experimentProgress(
  mission: Mission,
  actions: Action[],
  steps = experimentSteps(mission),
) {
  let index = 0;
  let selected: Action = "case-standard";
  for (const action of actions) {
    if (action.startsWith("case-") && action !== "case-submit") selected = action;
    if (action !== steps[index]?.action) continue;
    if (mission.service && action === "case-submit" && selected !== steps[index - 1]?.action)
      continue;
    index++;
  }
  // A learner may explore a different case while the guide awaits processing.
  if (
    mission.service &&
    steps[index]?.action === "case-submit" &&
    selected !== steps[index - 1]?.action
  )
    return index - 1;
  return index;
}

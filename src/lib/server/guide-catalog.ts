import { MISSIONS } from "../learn/catalog";
import { HANDOFF_TRACKS, handoffId } from "../handoff/catalog";
import type { GuideProfile, GuideRecommendation, GuideReply } from "../guide";

type Entry = GuideRecommendation & { goal: GuideProfile["goal"]; needsCode: boolean };

/** Public curriculum descriptions only. Never send solutions or private progress to the guide. */
export const GUIDE_CATALOG: Entry[] = [
  ...MISSIONS.map((m) => ({
    id: m.id,
    title: m.title,
    description: m.summary,
    href: `/learn/${m.id}`,
    minutes: m.minutes,
    action: "이 미션 시작하기",
    goal: m.kind === "foundation" ? ("understand" as const) : ("fix" as const),
    needsCode: false,
  })),
  ...HANDOFF_TRACKS.map((track) => ({
    id: handoffId(track.key),
    title: track.title,
    description: track.brief,
    href: `/problems/${handoffId(track.key)}?from=%2Fhandoff`,
    minutes: 25,
    action: "코드 분석 시작하기",
    goal: "review" as const,
    needsCode: true,
  })),
  {
    id: "practice",
    title: "내 분야의 코딩 문제 고르기",
    description: "분야와 언어, 난이도를 골라 구현·오류 수정·리팩터링 문제를 찾아보세요.",
    href: "/#problem-library",
    minutes: 5,
    action: "문제 보관함 열기",
    goal: "practice",
    needsCode: true,
  },
];

export function guideCandidates(profile: GuideProfile) {
  return GUIDE_CATALOG.filter((entry) => !entry.needsCode || profile.experience === "developer");
}

export function basicGuide(profile: GuideProfile, notice?: string): GuideReply {
  let id = "where-data-lives";
  if (profile.experience === "developer" && profile.goal === "practice") id = "practice";
  else if (profile.experience === "developer" && profile.goal === "review")
    id = profile.minutes >= 30 ? "handoff-cart" : "late-search";
  else if (profile.goal === "fix" && profile.minutes >= 15) id = "broken-memo";
  else if (profile.goal === "review" && profile.experience !== "developer") id = "price-and-rules";
  const recommendation = GUIDE_CATALOG.find((entry) => entry.id === id)!;
  let reason =
    "코드를 작성하지 않고 서비스를 눌러 보며, 화면에 보이는 값과 저장된 데이터가 어떻게 다른지 확인할 수 있어요.";
  if (id === "practice")
    reason =
      "직접 코딩해 보고 싶다면 익숙한 분야의 쉬운 문제부터 골라 보세요. 5분은 문제를 고르는 시간이며, 풀이 시간은 문제마다 달라요.";
  if (id === "handoff-cart")
    reason =
      "코드를 읽을 수 있고 30분 이상 연습할 수 있다면, 장바구니 코드의 동작을 예상하고 직접 수정하는 훈련이 잘 맞아요.";
  if (id === "late-search")
    reason =
      "지금은 짧은 실습으로 요청 순서를 먼저 살펴보세요. 전체 실습은 약 6분이며, 오늘 일부만 해도 기록을 이어갈 수 있어요.";
  if (id === "broken-memo")
    reason =
      "저장 버튼을 눌렀는데 데이터가 남지 않는 상황을 재현하고, AI의 수정안을 어떻게 확인할지 연습할 수 있어요.";
  if (id === "price-and-rules")
    reason =
      "AI 코드를 이해하고 싶다면 먼저 입력값과 조건에 따라 결과가 달라지는 원리를 익혀 보세요. 이 미션은 코드를 작성하지 않아도 할 수 있어요.";
  return { message: reason, recommendation, source: "basic", ...(notice && { notice }) };
}

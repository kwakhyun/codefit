import { MISSIONS } from "../learn/catalog";
import { HANDOFF_TRACKS, handoffId } from "../handoff/catalog";
import { AI_LESSONS } from "../ai-learning/catalog";
import { AI_PATHS } from "../ai-learning/lesson-paths";
import type { GuideProfile, GuideRecommendation, GuideReply } from "../guide";

type Entry = GuideRecommendation & {
  goal: GuideProfile["goal"];
  needsCode: boolean;
  /** Needs a repository of the visitor's own, so not offered to first-time coders. */
  needsProject?: boolean;
};

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
    action: "분야별 코딩 연습 열기",
    goal: "practice",
    needsCode: true,
  },
  // The first lesson of each recommended AI path, opened inside that path.
  ...AI_PATHS.map((path) => {
    const lesson = AI_LESSONS.find((item) => item.id === path.ids[0])!;
    return {
      id: `ai:${lesson.id}`,
      title: lesson.title,
      description: `${path.title}: ${lesson.summary}`,
      href: `/learn/ai/${lesson.id}?path=${path.id}`,
      minutes: lesson.minutes,
      action: "이 수업 시작하기",
      goal: "ai" as const,
      needsCode: false,
    };
  }),
  {
    id: "ai-workshop",
    title: "내 프로젝트 AI 워크숍",
    description:
      "내 공개 저장소 코드에서 쓰고 있는 AI를 이해하고, 새로 적용할 방법을 작은 실험으로 확인해요. 새 저장소 분석에는 분석 횟수를 사용해요.",
    href: "/learn/ai/project",
    minutes: 20,
    action: "내 프로젝트로 시작하기",
    goal: "ai",
    needsCode: false,
    needsProject: true,
  },
];

export function guideCandidates(profile: GuideProfile) {
  return GUIDE_CATALOG.filter(
    (entry) =>
      (!entry.needsCode || profile.experience === "developer") &&
      (!entry.needsProject || profile.experience !== "new"),
  );
}

function aiGuide(profile: GuideProfile) {
  if (profile.experience !== "new" && profile.minutes >= 15)
    return {
      id: "ai-workshop",
      reason:
        "만들어 둔 프로젝트가 있다면 내 저장소 코드에서 AI가 쓰이는 곳과 새로 적용할 아이디어를 함께 살펴보세요. 단계별로 저장되니 오늘 일부만 해도 이어갈 수 있어요.",
    };
  if (profile.experience === "developer")
    return {
      id: "ai:local-start",
      reason:
        "직접 실행해 보고 싶다면 내 컴퓨터에서 AI를 준비하는 수업부터 시작해 보세요. 설치 없이 원리를 먼저 익히고, 같은 순서로 연결과 채팅 화면까지 이어갈 수 있어요.",
    };
  return {
    id: "ai:prompt-context",
    reason:
      "AI 도구가 처음이라면 AI에게 필요한 맥락을 전달하는 방법부터 익혀 보세요. 코드를 작성하지 않아도 되고, ‘처음이라면’ 순서대로 다음 수업이 이어져요.",
  };
}

export function basicGuide(profile: GuideProfile, notice?: string): GuideReply {
  let id = "where-data-lives";
  let reason =
    "코드를 작성하지 않고 서비스를 눌러 보며, 화면에 보이는 값과 저장된 데이터가 어떻게 다른지 확인할 수 있어요.";
  if (profile.goal === "ai") ({ id, reason } = aiGuide(profile));
  else if (profile.experience === "developer" && profile.goal === "practice") id = "practice";
  else if (profile.experience === "developer" && profile.goal === "review")
    id = profile.minutes >= 30 ? "handoff-cart" : "late-search";
  else if (profile.goal === "fix" && profile.minutes >= 15) id = "broken-memo";
  else if (profile.goal === "review" && profile.experience !== "developer") id = "price-and-rules";
  const recommendation = GUIDE_CATALOG.find((entry) => entry.id === id)!;
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

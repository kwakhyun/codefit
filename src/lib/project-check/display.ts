import type { CheckListItem } from "./types";

type Named = Pick<CheckListItem, "classMetadata" | "analysis" | "page">;
/** The name a learner gave the project, otherwise the analysis title, otherwise the repository. */
export function displayName(check: Named) {
  const name = check.classMetadata?.name?.trim() || check.analysis.title?.trim();
  if (name) return name;
  try {
    const url = new URL(check.page.url);
    return url.hostname === "github.com"
      ? url.pathname.split("/")[2] || url.hostname
      : url.hostname;
  } catch {
    return check.page.url;
  }
}
/** Owner for GitHub repositories, otherwise the host, for a second line under the name. */
export function displayOrigin(check: Pick<CheckListItem, "page">) {
  try {
    const url = new URL(check.page.url);
    return url.hostname === "github.com"
      ? url.pathname.split("/")[1] || url.hostname
      : url.hostname;
  } catch {
    return check.page.url;
  }
}
/** One label set for the 0–4 assessment levels, used by the results grid and the score guide. */
export const assessmentLevels = [
  "근거 없음",
  "기능 식별",
  "흐름 설명",
  "이유와 실패 상황",
  "확인 방법과 대안 비교",
] as const;
/** What deleting a project removes, shared by every delete confirmation. */
export function projectDeletion(name: string) {
  return {
    message: `‘${name}’ 프로젝트와 연결된 기록을 모두 삭제합니다. 삭제한 기록은 복구할 수 없습니다. 원본 저장소와 서비스는 삭제되지 않습니다.`,
    options: {
      title: "프로젝트 삭제",
      confirmLabel: "프로젝트 영구 삭제",
      tone: "danger" as const,
      details: [
        "분석 결과와 설계 질문",
        "답변, 평가와 보완 답변",
        "확인 기록과 코드 대화",
        "코드 이해 훈련과 서비스 동작 실습",
        "내 프로젝트 AI 워크숍과 단계별 생성 기록",
      ],
    },
  };
}
/** "분석 횟수 1회 사용 · 남은 3회 · 11월 7일 15:00 초기화" plus a reason when it is not enough. */
export function allowanceCost(input: {
  label: string;
  cost: number;
  remaining: number;
  resetsAt?: string | null;
  resetLabel?: (iso: string) => string;
}) {
  const reset = input.resetsAt && input.resetLabel ? input.resetLabel(input.resetsAt) : "";
  const summary = [
    `${input.label} ${input.cost}회 사용`,
    `남은 ${input.remaining}회`,
    ...(reset ? [`${reset} 초기화`] : []),
  ].join(" · ");
  const insufficient = input.remaining < input.cost;
  return {
    summary,
    insufficient,
    reason: insufficient
      ? `${input.label}가 ${input.cost}회 필요하지만 ${input.remaining}회 남았습니다.${reset ? ` ${reset}에 다시 채워집니다.` : " 첫 사용부터 정해진 시간이 지나면 다시 채워집니다."}`
      : "",
  };
}
/** Mirrors the server's address detection so the form can say what it will read. */
export function detectSource(raw: string): "repository" | "website" | null {
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    return ["github.com", "gitlab.com", "bitbucket.org", "codeberg.org", "git.sr.ht"].includes(
      url.hostname,
    ) || /\.git\/?$/.test(url.pathname)
      ? "repository"
      : "website";
  } catch {
    return null;
  }
}

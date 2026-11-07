import { DOMAINS } from "./catalog";

type Crumb = { label: string; href?: string };
const pages: Record<string, string> = {
  "/projects": "내 프로젝트",
  "/project-check": "내 프로젝트 점검",
  "/security-check": "서비스 보안 점검",
  "/learn": "서비스 원리 배우기",
  "/learn/ai": "AI 실무 배우기",
  "/handoff": "AI 코드 이해 훈련",
  "/login": "로그인",
  "/profile": "내 프로필",
  "/privacy": "개인정보 안내",
};
const browse = { label: "분야별 코딩 연습", href: "/?view=browse" };

/** Breadcrumb after "CODE:FIT" for every route; unknown paths read as a missing page. */
export function locationTrail(pathname: string, params: URLSearchParams): Crumb[] {
  if (pathname === "/") {
    const view = params.get("view");
    if (view === "bookmarks") return [{ label: "북마크" }];
    if (view === "history") return [{ label: "내 학습 기록" }];
    if (view === "browse") return [{ label: browse.label }];
    const domain = DOMAINS.find((item) => item.id === params.get("domain"));
    if (domain) return [browse, { label: domain.label }];
    return [{ label: "홈" }];
  }
  if (pages[pathname]) return [{ label: pages[pathname] }];
  if (pathname.startsWith("/problems/"))
    return [
      pathname.startsWith("/problems/handoff-")
        ? { label: pages["/handoff"], href: "/handoff" }
        : browse,
      { label: "문제 풀이" },
    ];
  if (pathname === "/project-practice")
    return [
      params.get("mode") === "service"
        ? { label: pages["/learn"], href: "/learn" }
        : { label: pages["/handoff"], href: "/handoff" },
      { label: "내 프로젝트로 연습" },
    ];
  const ai = { label: pages["/learn/ai"], href: "/learn/ai" };
  if (pathname === "/learn/ai/project") return [ai, { label: "내 프로젝트 AI 워크숍" }];
  if (/^\/learn\/ai\/[^/]+$/.test(pathname)) return [ai, { label: "수업" }];
  if (/^\/learn\/[^/]+$/.test(pathname))
    return [{ label: pages["/learn"], href: "/learn" }, { label: "미션" }];
  return [{ label: "페이지를 찾을 수 없음" }];
}

const homeViews = ["bookmarks", "history", "browse"];
/**
 * aria-current for a menu link: "page" for the exact screen, "true" for the menu item that
 * contains the current screen (a lesson, a mission, a problem), otherwise none.
 */
export function navCurrent(
  href: string,
  pathname: string,
  params: URLSearchParams,
): "page" | "true" | undefined {
  const view = params.get("view");
  const domain = DOMAINS.some((item) => item.id === params.get("domain"));
  if (href.startsWith("/?view=")) {
    const target = href.slice("/?view=".length);
    if (pathname === "/" && view === target) return "page";
    if (target !== "browse") return undefined;
    if (pathname === "/" && domain) return "true";
    return pathname.startsWith("/problems/") && !pathname.startsWith("/problems/handoff-")
      ? "true"
      : undefined;
  }
  if (href === "/")
    return pathname === "/" && !homeViews.includes(view || "") && !domain ? "page" : undefined;
  if (pathname === "/project-practice") {
    // Project practice is shown as the track it was opened from.
    const owner = params.get("mode") === "service" ? "/learn" : "/handoff";
    return href === owner ? "page" : undefined;
  }
  if (pathname === href) return "page";
  if (href === "/handoff" && pathname.startsWith("/problems/handoff-")) return "true";
  if (href === "/learn") return /^\/learn\/(?!ai(\/|$))[^/]+$/.test(pathname) ? "true" : undefined;
  if (href === "/learn/ai")
    return /^\/learn\/ai\/[^/]+$/.test(pathname) && pathname !== "/learn/ai/project"
      ? "true"
      : undefined;
  return pathname.startsWith(href + "/") ? "true" : undefined;
}
